import { describe, expect, it } from 'vitest'
import { summarizeScan } from '../scan.js'
import { POWER_VARIABLE_CODES } from '../variables.js'

const SEASON_IDS = ['winter', 'spring', 'summer', 'fall']

/** A whole-year trend result, with all four seasons copying it unless overridden. */
function result({ slope, p, seasons = {}, opposite = null }) {
  const test = (s, pv) => ({
    slopePerDecade: s,
    pValue: pv,
    significant: pv < 0.05 && s !== 0,
    direction: s > 0 ? 'rising' : s < 0 ? 'falling' : 'flat',
  })
  return {
    data: {
      ...test(slope, p),
      seasons: SEASON_IDS.map((id) => ({ id, ...test(...(seasons[id] || [slope, p])) })),
      oppositeSeasons: opposite,
    },
  }
}

const flat = result({ slope: 0.01, p: 0.6 })
const everything = (overrides) => Object.fromEntries(POWER_VARIABLE_CODES.map((c) => [c, overrides[c] || flat]))

describe('place scan', () => {
  it('keeps the catalog order and reports progress while results arrive', () => {
    const scan = summarizeScan({ T2M: result({ slope: 0.3, p: 0.001 }), SNODP: { error: 'NASA POWER is not responding right now' } })
    expect(scan.rows.map((r) => r.code)).toEqual(POWER_VARIABLE_CODES)
    expect(scan).toMatchObject({ done: 2, total: POWER_VARIABLE_CODES.length, complete: false, significantCount: 1 })
    expect(scan.rows.find((r) => r.code === 'SNODP')).toMatchObject({ status: 'error', error: 'NASA POWER is not responding right now' })
    expect(scan.rows.find((r) => r.code === 'RH2M').status).toBe('loading')
  })

  it('puts what is changing first once everything has loaded', () => {
    const scan = summarizeScan(
      everything({
        RH2M: result({ slope: -1.4, p: 0.0001 }),
        T2M: result({ slope: 0.3, p: 0.01 }),
        AOD_55: result({ slope: -0.002, p: 0.48, opposite: { rising: 'summer', falling: 'spring', crossYear: 2018 } }),
        SNODP: { data: { slopePerDecade: null, pValue: null, significant: false, direction: 'none', seasons: [] } },
      }),
    )
    expect(scan.complete).toBe(true)
    expect(scan.rows.slice(0, 3).map((r) => r.code)).toEqual(['RH2M', 'T2M', 'AOD_55'])
    expect(scan.rows.at(-1)).toMatchObject({ code: 'SNODP', status: 'short' })
    expect(scan.significantCount).toBe(2)
    // Haze has no whole-year trend, but its seasons pull in opposite directions.
    expect(scan.hiddenCount).toBe(1)
    expect(scan.rows[2]).toMatchObject({ significant: false, opposite: { rising: 'summer', falling: 'spring' } })
  })

  it('reports one season when a season is chosen', () => {
    const scan = summarizeScan(
      everything({
        AOD_55: result({
          slope: -0.002,
          p: 0.48,
          seasons: { summer: [0.014, 0.0004], spring: [-0.02, 0.00003] },
          opposite: { rising: 'summer', falling: 'spring' },
        }),
      }),
      'summer',
    )
    expect(scan.rows[0]).toMatchObject({ code: 'AOD_55', significant: true, direction: 'rising', slopePerDecade: 0.014, opposite: null })
    expect(scan.significantCount).toBe(1)
    expect(scan.hiddenCount).toBe(0)
  })

  it('treats an unknown season as the whole year', () => {
    const scan = summarizeScan(everything({ T2M: result({ slope: 0.3, p: 0.01, seasons: { winter: [0, 1] } }) }), 'monsoon')
    expect(scan.rows[0]).toMatchObject({ code: 'T2M', significant: true })
  })
})
