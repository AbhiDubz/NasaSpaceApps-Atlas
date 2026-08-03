import { describe, expect, it } from 'vitest'
import {
  localPolityMatchTolerance,
  pickNearestPolityFrame,
  playheadToPolityYear,
  quantizePolityYear,
} from '../../../services/earthHistory/fetchHistoricalPolities.js'
import { calendarYearToYbp } from '../../core/calendarYear.js'
import { slicePolitiesForYear, polityColor } from '../../../../scripts/earth-history/bake-cliopatria-polities.mjs'

describe('quantizePolityYear', () => {
  it('uses 25-year steps in medieval showcase band', () => {
    expect(quantizePolityYear(1007)).toBe(1000)
    expect(quantizePolityYear(1013)).toBe(1025)
    expect(quantizePolityYear(1000)).toBe(1000)
  })

  it('uses 50-year steps for early modern', () => {
    expect(quantizePolityYear(1523)).toBe(1500)
  })
})

describe('pickNearestPolityFrame', () => {
  const frames = [
    { year: 900, path: 'a' },
    { year: 1000, path: 'b' },
    { year: 1100, path: 'c' },
  ]

  it('picks closest year', () => {
    expect(pickNearestPolityFrame(frames, 980)?.year).toBe(1000)
    expect(pickNearestPolityFrame(frames, 910)?.year).toBe(900)
  })

  it('tolerance covers medieval density', () => {
    expect(localPolityMatchTolerance(1000)).toBe(30)
  })
})

describe('playheadToPolityYear', () => {
  it('maps ~1000 CE playhead to quantized year near 1000', () => {
    const ybp = calendarYearToYbp(1000)
    const year = playheadToPolityYear(ybp)
    expect(year).toBeGreaterThanOrEqual(975)
    expect(year).toBeLessThanOrEqual(1025)
  })
})

describe('slicePolitiesForYear', () => {
  const sample = [
    {
      type: 'Feature',
      properties: { Name: 'Byzantine Empire', FromYear: 395, ToYear: 1453, Area: 1_000_000, Type: 'POLITY' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [25, 40],
            [30, 40],
            [30, 42],
            [25, 42],
            [25, 40],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { Name: 'Tiny', FromYear: 900, ToYear: 1100, Area: 10, Type: 'POLITY' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { Name: 'Fatimid Caliphate', FromYear: 909, ToYear: 1171, Area: 500_000, Type: 'POLITY' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 20],
            [40, 20],
            [40, 35],
            [10, 35],
            [10, 20],
          ],
        ],
      },
    },
  ]

  it('filters to year 1000 and ranks by area', () => {
    const hits = slicePolitiesForYear(sample, 1000)
    expect(hits).toHaveLength(3)
    expect(hits[0].properties.name).toBe('Byzantine Empire')
    expect(hits[0].properties.color).toBe(polityColor('Byzantine Empire'))
  })

  it('excludes out-of-range polities', () => {
    const hits = slicePolitiesForYear(sample, 500)
    expect(hits.map((h) => h.properties.name)).toEqual(['Byzantine Empire'])
  })
})
