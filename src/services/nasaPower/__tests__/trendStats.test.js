import { describe, expect, it } from 'vitest'
import { analyzeTrend, deseasonalize, linearRegression, mannKendallSen, normalCdf, seasonalMeans, SEASONS } from '../trendStats.js'
import { buildMonthAxis, cleanSeries } from '../fetchPower.js'
import { normalizeLatLng, parseVarList } from '../variables.js'

/** Deterministic pseudo-random noise in [-0.5, 0.5). */
function lcg(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296 - 0.5
  }
}

const months = buildMonthAxis(1981, 2025)

function synthetic({ slopePerDecade, noise = 1, seed = 7 }) {
  const rnd = lcg(seed)
  return months.map((_, i) => 10 + 8 * Math.sin((2 * Math.PI * (i % 12)) / 12) + (slopePerDecade / 120) * i + noise * rnd())
}

describe('fetchPower helpers', () => {
  it('builds a 540-month axis and drops month 13 / fill values', () => {
    expect(months).toHaveLength(540)
    expect(months[0]).toBe('1981-01')
    expect(months.at(-1)).toBe('2025-12')
    const cleaned = cleanSeries({ 198101: 1.5, 198102: -999, 198113: 4 }, months.slice(0, 3))
    expect(cleaned).toEqual([1.5, null, null])
  })

  it('parses variable lists and normalizes coordinates', () => {
    expect(parseVarList('t2m, snodp,bogus')).toEqual(['T2M', 'SNODP'])
    expect(parseVarList('')).toHaveLength(9)
    // Instrument variables are not served by NASA POWER.
    expect(parseVarList('ndvi,t2m')).toEqual(['T2M'])
    expect(parseVarList('')).not.toContain('NDVI')
    expect(normalizeLatLng(47.4234, 238.59)).toEqual({ lat: 47.42, lng: -121.41 })
    expect(normalizeLatLng(95, 0)).toBeNull()
  })
})

describe('trend statistics', () => {
  it('normalCdf matches known values', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 4)
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 4)
  })

  it('deseasonalize removes a pure seasonal cycle', () => {
    const values = months.map((_, i) => 5 + 3 * Math.cos((2 * Math.PI * (i % 12)) / 12))
    const { anomalies, climatology } = deseasonalize(values)
    expect(climatology).toHaveLength(12)
    expect(Math.max(...anomalies.map(Math.abs))).toBeLessThan(1e-9)
  })

  it('Mann-Kendall matches a hand-computed case', () => {
    // x = 1,3,2,5,4 → 8 concordant pairs, 2 discordant → S = 6.
    // Sorted pairwise slopes: -1,-1,1/3,1/2,3/4,1,1,4/3,2,3 → median 0.875
    const { s, slope } = mannKendallSen([0, 1, 2, 3, 4], [1, 3, 2, 5, 4])
    expect(s).toBe(6)
    expect(slope).toBeCloseTo(0.875, 9)
  })

  it('recovers a known warming trend and calls it significant', () => {
    const out = analyzeTrend({ code: 'T2M', months, values: synthetic({ slopePerDecade: 0.3 }) })
    expect(out.slopePerDecade).toBeCloseTo(0.3, 1)
    expect(out.ci95[0]).toBeLessThan(0.3)
    expect(out.ci95[1]).toBeGreaterThan(0.3)
    expect(out.significant).toBe(true)
    expect(out.verdict).toMatch(/^Warming: 0\.\d+ °C per decade, statistically significant/)
    expect(out.ols.slopePerDecade).toBeCloseTo(0.3, 1)
    expect(out.trendLine).toHaveLength(540)
  })

  it('does not call pure noise significant', () => {
    const out = analyzeTrend({ code: 'PRECTOTCORR', months, values: synthetic({ slopePerDecade: 0, noise: 4, seed: 99 }) })
    expect(out.significant).toBe(false)
    expect(out.verdict).toMatch(/Not significant yet|No trend detected/)
  })

  it('skips null months and handles a late start', () => {
    const values = synthetic({ slopePerDecade: -0.5 }).map((v, i) => (i < 36 || i % 17 === 0 ? null : v))
    const out = analyzeTrend({ code: 'ALLSKY_SFC_SW_DWN', months, values })
    expect(out.firstMonth).toBe('1984-01')
    expect(out.anomalies[0]).toBeNull()
    expect(out.trendLine[0]).toBeNull()
    expect(out.slopePerDecade).toBeCloseTo(-0.5, 1)
    expect(out.direction).toBe('falling')
  })

  it('handles an all-zero series (no snow) without NaN', () => {
    const out = analyzeTrend({ code: 'SNODP', months, values: months.map(() => 0) })
    expect(out.slopePerDecade).toBe(0)
    expect(out.pValue).toBe(1)
    expect(out.significant).toBe(false)
    expect(out.verdict).toMatch(/No trend detected/)
  })

  it('reports when there is too little data', () => {
    const out = analyzeTrend({ code: 'T2M', months, values: months.map((_, i) => (i < 50 ? 1 : null)) })
    expect(out.slopePerDecade).toBeNull()
    expect(out.verdict).toMatch(/Not enough data/)
  })

  it('autocorrelation widens the OLS interval', () => {
    const rnd = lcg(3)
    const t = months.map((_, i) => i)
    const white = t.map(() => rnd())
    const red = []
    white.forEach((w, i) => red.push(i ? 0.8 * red[i - 1] + w : w))
    expect(linearRegression(t, red).lag1).toBeGreaterThan(0.5)
    expect(mannKendallSen(t, red).varianceCorrection).toBeGreaterThan(1.5)
  })
})

describe('season trends', () => {
  const spring = SEASONS.find((x) => x.id === 'spring')
  const winter = SEASONS.find((x) => x.id === 'winter')
  const hazeMonths = buildMonthAxis(2001, 2025)

  /** Spring falls by 0.02 per decade, summer rises by 0.03; spring starts higher. */
  function flipSeries(seed = 11) {
    const rnd = lcg(seed)
    return hazeMonths.map((ym, i) => {
      const m = Number(ym.slice(5, 7))
      const years = i / 12
      const base = m >= 3 && m <= 5 ? 0.17 - 0.002 * years : m >= 6 && m <= 8 ? 0.1 + 0.003 * years : 0.08
      return base + 0.01 * rnd()
    })
  }

  it('averages the three months of a season, one value per year', () => {
    const axis = buildMonthAxis(2001, 2003)
    const values = axis.map((_, i) => i) // Jan 2001 = 0 … Dec 2003 = 35
    const s = seasonalMeans(axis, values, spring)
    expect(s.years).toEqual([2001, 2002, 2003])
    expect(s.values).toEqual([3, 15, 27])
  })

  it('counts December toward the next winter and skips incomplete seasons', () => {
    const axis = buildMonthAxis(2001, 2003)
    const values = axis.map((_, i) => (i === 13 ? null : i)) // Feb 2002 missing
    const w = seasonalMeans(axis, values, winter)
    // 2001 has no December before it; 2002 is missing February; 2003 = Dec 2002, Jan 2003, Feb 2003.
    expect(w.values).toEqual([null, null, (23 + 24 + 25) / 3])
  })

  it('tests one season on yearly averages', () => {
    const out = analyzeTrend({ code: 'AOD_55', months: hazeMonths, values: flipSeries(), season: 'spring' })
    expect(out.step).toBe('year')
    expect(out.season).toBe('spring')
    expect(out.months).toHaveLength(25)
    expect(out.months[0]).toBe('2001')
    expect(out.monthsUsed).toBe(25)
    expect(out.slopePerDecade).toBeCloseTo(-0.02, 2)
    expect(out.significant).toBe(true)
    expect(out.verdict).toMatch(/^Air getting clearer in spring: 0\.0\d+ per decade, statistically significant/)
    expect(out.trendLine).toHaveLength(25)
  })

  it('scans all four seasons and flags opposite trends', () => {
    const out = analyzeTrend({ code: 'AOD_55', months: hazeMonths, values: flipSeries() })
    expect(out.season).toBe('all')
    expect(out.step).toBe('month')
    expect(out.seasons.map((x) => x.id)).toEqual(['winter', 'spring', 'summer', 'fall'])
    const byId = Object.fromEntries(out.seasons.map((x) => [x.id, x]))
    expect(byId.spring.direction).toBe('falling')
    expect(byId.summer.direction).toBe('rising')
    expect(byId.summer.slopePerDecade).toBeCloseTo(0.03, 2)
    expect(byId.winter.significant).toBe(false)
    expect(byId.winter.yearsUsed).toBe(24)
    // Trend lines are in the variable's own units, so they can be charted with the yearly averages.
    expect(byId.spring.trendLine[0]).toBeCloseTo(0.17, 1)
    expect(out.oppositeSeasons).toMatchObject({ rising: 'summer', falling: 'spring' })
    // 0.17 − 0.002·y = 0.10 + 0.003·y → y = 14 → crosses about 2015.
    expect(out.oppositeSeasons.crossYear).toBeGreaterThanOrEqual(2013)
    expect(out.oppositeSeasons.crossYear).toBeLessThanOrEqual(2017)
  })

  it('does not flag opposite trends when every season moves the same way', () => {
    const out = analyzeTrend({ code: 'T2M', months, values: synthetic({ slopePerDecade: 0.3 }) })
    expect(out.seasons.every((x) => x.direction === 'rising')).toBe(true)
    expect(out.oppositeSeasons).toBeNull()
  })

  it('reports when a season has too few years', () => {
    const short = buildMonthAxis(2001, 2008)
    const out = analyzeTrend({ code: 'AOD_55', months: short, values: short.map(() => 0.1), season: 'summer' })
    expect(out.slopePerDecade).toBeNull()
    expect(out.verdict).toMatch(/Not enough data here to test a summer trend \(8 usable years/)
  })

  it('ignores an unknown season', () => {
    const out = analyzeTrend({ code: 'T2M', months, values: synthetic({ slopePerDecade: 0.3 }), season: 'monsoon' })
    expect(out.season).toBe('all')
    expect(out.months).toHaveLength(540)
  })
})

