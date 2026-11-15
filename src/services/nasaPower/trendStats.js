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
 *
 * A season test (`season: 'spring'`) uses one value per year instead: the
 * average of that season's three months. The same two tests then run on the
 * yearly values. The whole-year result also carries a quick scan of all four
 * seasons, because one place can trend in opposite directions in different
 * seasons and the whole-year average hides it.
 */
import { POWER_VARIABLES } from './variables.js'

const MONTHS_PER_DECADE = 120
const YEARS_PER_DECADE = 10
const Z95 = 1.959963984540054
export const MIN_MONTHS_FOR_TREND = 120
export const MIN_YEARS_FOR_SEASON_TREND = 10

/** Meteorological seasons. `months` are calendar months, 0 = January. Winter is named for the year of its January. */
export const SEASONS = [
  { id: 'winter', label: 'Winter', span: 'Dec–Feb', months: [11, 0, 1] },
  { id: 'spring', label: 'Spring', span: 'Mar–May', months: [2, 3, 4] },
  { id: 'summer', label: 'Summer', span: 'Jun–Aug', months: [5, 6, 7] },
  { id: 'fall', label: 'Fall', span: 'Sep–Nov', months: [8, 9, 10] },
]
export const SEASON_IDS = SEASONS.map((s) => s.id)

/** 'all' (or anything unknown) → null; otherwise the season definition. */
export function seasonById(id) {
  return SEASONS.find((s) => s.id === id) || null
}

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
 * One value per year for a season: the mean of its three months. A year
 * with any of the three missing is null.
 * @param {string[]} months — consecutive 'YYYY-MM' labels
 * @param {(number|null)[]} values
 * @param {{ months: number[] }} season
 */
export function seasonalMeans(months, values, season) {
  const byMonth = new Map()
  months.forEach((ym, i) => byMonth.set(ym, values[i]))
  const firstYear = Number(months[0]?.slice(0, 4))
  const lastYear = Number(months[months.length - 1]?.slice(0, 4))
  const years = []
  const means = []
  if (!Number.isFinite(firstYear) || !Number.isFinite(lastYear)) return { years, values: means }
  for (let y = firstYear; y <= lastYear; y++) {
    let sum = 0
    let ok = true
    for (const m of season.months) {
      // December belongs to the winter of the following year.
      const year = m === 11 && season.months.includes(0) ? y - 1 : y
      const v = byMonth.get(`${year}-${String(m + 1).padStart(2, '0')}`)
      if (v == null) {
        ok = false
        break
      }
      sum += v
    }
    years.push(y)
    means.push(ok ? sum / season.months.length : null)
  }
  return { years, values: means }
}

/** Both tests on one series, plus the plain-language verdict. `where` is e.g. ' in spring'. */
function testTrend({ t, x, stepsPerDecade, meta, where = '' }) {
  const mk = mannKendallSen(t, x)
  const ols = linearRegression(t, x)

  const slopePerDecade = mk.slope * stepsPerDecade
  const ci95 = [mk.ci[0] * stepsPerDecade, mk.ci[1] * stepsPerDecade]
  const significant = mk.pValue < 0.05 && slopePerDecade !== 0
  const direction = slopePerDecade > 0 ? 'rising' : slopePerDecade < 0 ? 'falling' : 'flat'
  const decimals = meta?.decimals ?? 2
  const unit = meta?.unit && !meta.unit.startsWith('(') ? ` ${meta.unit}` : ''
  const rate = `${fmtRate(slopePerDecade, decimals)}${unit} per decade`

  let verdict
  if (significant) {
    const word = direction === 'rising' ? meta?.rising || 'Rising' : meta?.falling || 'Falling'
    verdict = `${word}${where}: ${rate}, statistically significant (${fmtP(mk.pValue)}).`
  } else if (direction === 'flat') {
    verdict = `No trend detected${where}: the typical change is zero (${fmtP(mk.pValue)}).`
  } else {
    const sign = slopePerDecade > 0 ? '+' : '−'
    verdict = `Not significant yet${where}: ${sign}${rate}, which could still be natural ups and downs (${fmtP(mk.pValue)}).`
  }

  return {
    mk,
    fields: {
      slopePerDecade,
      ci95,
      pValue: mk.pValue,
      significant,
      direction,
      mannKendall: { s: mk.s, z: mk.z, varianceCorrection: mk.varianceCorrection },
      ols: {
        slopePerDecade: ols.slope * stepsPerDecade,
        ci95: [ols.ci[0] * stepsPerDecade, ols.ci[1] * stepsPerDecade],
        pValue: ols.pValue,
      },
      verdict,
    },
  }
}

const NO_TREND = { slopePerDecade: null, ci95: null, pValue: null, significant: false, direction: 'none', ols: null }

/**
 * Trend test on one season's yearly averages. Same result shape as the
 * whole-year test, except each point is a year: `months` holds 'YYYY' labels
 * and `monthsUsed` counts years.
 */
function analyzeSeason({ code, months, values, season }) {
  const meta = POWER_VARIABLES[code]
  const { years, values: means } = seasonalMeans(months, values, season)

  const t = []
  const x = []
  means.forEach((v, i) => {
    if (v == null) return
    t.push(i)
    x.push(v)
  })
  const normal = x.length ? x.reduce((a, b) => a + b, 0) / x.length : null
  const anomalies = means.map((v) => (v == null ? null : v - normal))

  const base = {
    variable: code,
    label: meta?.label || code,
    unit: meta?.unit || '',
    season: season.id,
    seasonLabel: season.label,
    seasonSpan: season.span,
    step: 'year',
    months: years.map(String),
    values: means,
    anomalies,
    climatology: [normal],
    monthsUsed: x.length,
    firstMonth: t.length ? String(years[t[0]]) : null,
    lastMonth: t.length ? String(years[t[t.length - 1]]) : null,
  }

  if (x.length < MIN_YEARS_FOR_SEASON_TREND) {
    return {
      ...base,
      trendLine: anomalies.map(() => null),
      ...NO_TREND,
      verdict: `Not enough data here to test a ${season.label.toLowerCase()} trend (${x.length} usable years; at least ${MIN_YEARS_FOR_SEASON_TREND} needed).`,
    }
  }

  const { mk, fields } = testTrend({
    t,
    x: x.map((v) => v - normal),
    stepsPerDecade: YEARS_PER_DECADE,
    meta,
    where: ` in ${season.label.toLowerCase()}`,
  })
  const firstT = t[0]
  const trendLine = anomalies.map((_, i) => (i < firstT ? null : mk.intercept + mk.slope * i))
  return { ...base, trendLine, ...fields }
}

/**
 * The year where two straight trend lines cross, or null when they do not
 * cross inside the record.
 */
function crossingYear(a, b) {
  const pts = a.years
    .map((year, i) => ({ year, diff: a.trendLine[i] == null || b.trendLine[i] == null ? null : a.trendLine[i] - b.trendLine[i] }))
    .filter((p) => p.diff != null)
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].diff === 0) return pts[i - 1].year
    if (pts[i - 1].diff > 0 !== pts[i].diff > 0) return pts[i].year
  }
  return null
}

/**
 * Quick test of all four seasons, for spotting opposite trends at one place.
 * Each entry carries the yearly averages and trend line in the variable's
 * own units, ready to chart.
 */
function scanSeasons({ code, months, values }) {
  const seasons = SEASONS.map((season) => {
    const r = analyzeSeason({ code, months, values, season })
    const normal = r.climatology[0]
    return {
      id: season.id,
      label: season.label,
      span: season.span,
      years: r.months.map(Number),
      values: r.values,
      trendLine: r.trendLine.map((v) => (v == null ? null : v + normal)),
      yearsUsed: r.monthsUsed,
      slopePerDecade: r.slopePerDecade,
      pValue: r.pValue,
      significant: r.significant,
      direction: r.direction,
    }
  })

  // Opposite trends: the strongest significant rise against the strongest significant fall.
  const strongest = (dir) =>
    seasons
      .filter((s) => s.significant && s.direction === dir)
      .sort((a, b) => Math.abs(b.slopePerDecade) - Math.abs(a.slopePerDecade))[0]
  const rising = strongest('rising')
  const falling = strongest('falling')
  const oppositeSeasons =
    rising && falling ? { rising: rising.id, falling: falling.id, crossYear: crossingYear(rising, falling) } : null

  return { seasons, oppositeSeasons }
}

/**
 * Full analysis for one variable at one place.
 * @param {{ code: string, months: string[], values: (number|null)[], season?: string }} input
 *   `season`: 'winter' | 'spring' | 'summer' | 'fall' tests that season's
 *   yearly averages; omitted or 'all' tests every month with the seasons removed.
 */
export function analyzeTrend({ code, months, values, season }) {
  const chosen = seasonById(season)
  if (chosen) return analyzeSeason({ code, months, values, season: chosen })

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
    season: 'all',
    step: 'month',
    months,
    values,
    anomalies,
    climatology,
    monthsUsed: x.length,
    firstMonth: t.length ? months[t[0]] : null,
    lastMonth: t.length ? months[t[t.length - 1]] : null,
    ...scanSeasons({ code, months, values }),
  }

  if (x.length < MIN_MONTHS_FOR_TREND) {
    return {
      ...base,
      trendLine: anomalies.map(() => null),
      ...NO_TREND,
      verdict: `Not enough data here to test a trend (${x.length} usable months; at least ${MIN_MONTHS_FOR_TREND} needed).`,
    }
  }

  const { mk, fields } = testTrend({ t, x, stepsPerDecade: MONTHS_PER_DECADE, meta })
  const firstT = t[0]
  const trendLine = anomalies.map((_, i) => (i < firstT ? null : mk.intercept + mk.slope * i))
  return { ...base, trendLine, ...fields }
}
