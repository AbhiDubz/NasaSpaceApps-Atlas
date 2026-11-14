/**
 * Trend statistics for monthly climate series. Pure functions, no I/O.
 *
 *   1. Remove the seasonal cycle (subtract each calendar month's long-term mean).
 *   2. Rate of change: Sen's slope, reported per decade.
 *   3. Significance: Mann-Kendall with the Hamed & Rao (1998) variance
 *      correction for autocorrelation.
 *   4. Second check: ordinary least squares with a 95% confidence interval
 *      (standard error widened for lag-1 autocorrelation).
 *
 * Null months are skipped in every calculation.
 */
import { POWER_VARIABLES } from './variables.js'

const MONTHS_PER_DECADE = 120
const Z95 = 1.959963984540054
export const MIN_MONTHS_FOR_TREND = 120

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x)
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf)
}

const twoSidedP = (z) => (z === 0 ? 1 : Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z))))))

function median(sorted) {
  const n = sorted.length
  if (!n) return NaN
  const mid = n >> 1
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Subtract each calendar month's long-term mean.
 * @param {(number|null)[]} values — aligned to consecutive months
 * @param {number} [firstMonthIndex] — calendar month (0–11) of values[0]
 */
export function deseasonalize(values, firstMonthIndex = 0) {
  const sum = new Array(12).fill(0)
  const count = new Array(12).fill(0)
  values.forEach((v, i) => {
    if (v == null) return
    const m = (firstMonthIndex + i) % 12
    sum[m] += v
    count[m] += 1
  })
  const climatology = sum.map((s, m) => (count[m] ? s / count[m] : null))
  const anomalies = values.map((v, i) => {
    if (v == null) return null
    const c = climatology[(firstMonthIndex + i) % 12]
    return c == null ? null : v - c
  })
  return { anomalies, climatology }
}

/** Average ranks (ties share the mean rank). */
function rank(xs) {
  const order = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const ranks = new Array(xs.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[order[k][1]] = r
    i = j + 1
  }
  return ranks
}

/**
 * Sen's slope + Mann-Kendall (Hamed-Rao corrected).
 * @param {number[]} t — time of each observation (months)
 * @param {number[]} x — observations (no nulls)
 */
export function mannKendallSen(t, x) {
  const n = x.length
  const slopes = new Float64Array((n * (n - 1)) / 2)
  let s = 0
  let k = 0
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = x[j] - x[i]
      s += d > 0 ? 1 : d < 0 ? -1 : 0
      slopes[k++] = d / (t[j] - t[i])
    }
  }
  slopes.sort()
  const slope = median(slopes)

  // Variance of S with the tie correction.
  const tieCounts = new Map()
  for (const v of x) tieCounts.set(v, (tieCounts.get(v) || 0) + 1)
  let tieTerm = 0
  for (const c of tieCounts.values()) if (c > 1) tieTerm += c * (c - 1) * (2 * c + 5)
  const varS = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18

  // Hamed-Rao: autocorrelation of the ranks of the detrended series; only
  // lags significant at the 5% level inflate (or deflate) the variance.
  const detrended = x.map((v, i) => v - slope * t[i])
  const r = rank(detrended)
  const rMean = (n + 1) / 2
  let denom = 0
  for (let i = 0; i < n; i++) denom += (r[i] - rMean) ** 2
  let correction = 1
  if (denom > 0 && n > 3) {
    const bound = Z95 / Math.sqrt(n)
    let acc = 0
    for (let lag = 1; lag < n - 2; lag++) {
      let num = 0
      for (let i = 0; i < n - lag; i++) num += (r[i] - rMean) * (r[i + lag] - rMean)
      const rho = num / denom
      if (Math.abs(rho) > bound) acc += (n - lag) * (n - lag - 1) * (n - lag - 2) * rho
    }
    correction = 1 + (2 / (n * (n - 1) * (n - 2))) * acc
    if (!(correction > 0)) correction = 1
  }
  const varCorrected = varS * correction

  let z = 0
  if (varCorrected > 0) {
    if (s > 0) z = (s - 1) / Math.sqrt(varCorrected)
    else if (s < 0) z = (s + 1) / Math.sqrt(varCorrected)
  }

  // Sen's nonparametric 95% interval, using the corrected variance.
  const N = slopes.length
  const c = Z95 * Math.sqrt(Math.max(varCorrected, 0))
  const lo = Math.min(N - 1, Math.max(0, Math.round((N - c) / 2) - 1))
  const hi = Math.min(N - 1, Math.max(0, Math.round((N + c) / 2)))
  const ci = [slopes[lo], slopes[hi]]

  const residuals = detrended.slice().sort((a, b) => a - b)
  return { slope, intercept: median(residuals), s, z, pValue: twoSidedP(z), ci, varianceCorrection: correction }
}

/** OLS slope with a 95% CI; standard error widened for lag-1 autocorrelation. */
export function linearRegression(t, x) {
  const n = x.length
  let st = 0
  let sx = 0
  for (let i = 0; i < n; i++) {
    st += t[i]
    sx += x[i]
  }
  const mt = st / n
  const mx = sx / n
  let stt = 0
  let stx = 0
  for (let i = 0; i < n; i++) {
    stt += (t[i] - mt) ** 2
    stx += (t[i] - mt) * (x[i] - mx)
  }
  const slope = stt > 0 ? stx / stt : 0
  const intercept = mx - slope * mt

  const res = x.map((v, i) => v - (intercept + slope * t[i]))
  let sse = 0
  let lagNum = 0
  for (let i = 0; i < n; i++) {
    sse += res[i] ** 2
    if (i > 0) lagNum += res[i] * res[i - 1]
  }
  const r1 = sse > 0 ? Math.min(0.95, Math.max(0, lagNum / sse)) : 0
  const nEff = Math.max(3, (n * (1 - r1)) / (1 + r1))
  const se = stt > 0 ? Math.sqrt(sse / Math.max(1, nEff - 2) / stt) : 0
  const z = se > 0 ? slope / se : 0
  return { slope, intercept, se, ci: [slope - Z95 * se, slope + Z95 * se], pValue: se > 0 ? twoSidedP(z) : 1, lag1: r1 }
}

function fmtRate(v, decimals) {
  const abs = Math.abs(v)
  return abs.toFixed(abs >= 1 ? Math.min(decimals, 2) : decimals)
}

export function fmtP(p) {
  if (p < 0.001) return 'p < 0.001'
  return `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`
}

/**
 * Full analysis for one variable at one place.
 * @param {{ code: string, months: string[], values: (number|null)[] }} input
 */
export function analyzeTrend({ code, months, values }) {
  const meta = POWER_VARIABLES[code]
  const firstMonthIndex = Number(months[0]?.slice(5, 7)) - 1 || 0
  const { anomalies, climatology } = deseasonalize(values, firstMonthIndex)

  const t = []
  const x = []
  anomalies.forEach((a, i) => {
    if (a == null) return
    t.push(i)
    x.push(a)
  })

  const base = {
    variable: code,
    label: meta?.label || code,
    unit: meta?.unit || '',
    months,
    values,
    anomalies,
    climatology,
    monthsUsed: x.length,
    firstMonth: t.length ? months[t[0]] : null,
    lastMonth: t.length ? months[t[t.length - 1]] : null,
  }

  if (x.length < MIN_MONTHS_FOR_TREND) {
    return {
      ...base,
      trendLine: anomalies.map(() => null),
      slopePerDecade: null,
      ci95: null,
      pValue: null,
      significant: false,
      direction: 'none',
      ols: null,
      verdict: `Not enough data here to test a trend (${x.length} usable months; at least ${MIN_MONTHS_FOR_TREND} needed).`,
    }
  }

  const mk = mannKendallSen(t, x)
  const ols = linearRegression(t, x)
  const firstT = t[0]
  const trendLine = anomalies.map((_, i) => (i < firstT ? null : mk.intercept + mk.slope * i))

  const slopePerDecade = mk.slope * MONTHS_PER_DECADE
  const ci95 = [mk.ci[0] * MONTHS_PER_DECADE, mk.ci[1] * MONTHS_PER_DECADE]
  const significant = mk.pValue < 0.05 && slopePerDecade !== 0
  const direction = slopePerDecade > 0 ? 'rising' : slopePerDecade < 0 ? 'falling' : 'flat'
  const decimals = meta?.decimals ?? 2
  const unit = meta?.unit && !meta.unit.startsWith('(') ? ` ${meta.unit}` : ''
  const rate = `${fmtRate(slopePerDecade, decimals)}${unit} per decade`

  let verdict
  if (significant) {
    const word = direction === 'rising' ? meta?.rising || 'Rising' : meta?.falling || 'Falling'
    verdict = `${word}: ${rate}, statistically significant (${fmtP(mk.pValue)}).`
  } else if (direction === 'flat') {
    verdict = `No trend detected: the typical change is zero (${fmtP(mk.pValue)}).`
  } else {
    const sign = slopePerDecade > 0 ? '+' : '−'
    verdict = `Not significant yet: ${sign}${rate}, which could still be natural ups and downs (${fmtP(mk.pValue)}).`
  }

  return {
    ...base,
    trendLine,
    slopePerDecade,
    ci95,
    pValue: mk.pValue,
    significant,
    direction,
    mannKendall: { s: mk.s, z: mk.z, varianceCorrection: mk.varianceCorrection },
    ols: {
      slopePerDecade: ols.slope * MONTHS_PER_DECADE,
      ci95: [ols.ci[0] * MONTHS_PER_DECADE, ols.ci[1] * MONTHS_PER_DECADE],
      pValue: ols.pValue,
    },
    verdict,
  }
}
