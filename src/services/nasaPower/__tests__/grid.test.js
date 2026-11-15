import { describe, expect, it } from 'vitest'
import { gridCell, gridCellRing } from '../grid.js'

// Boundaries confirmed against the live NASA POWER API (July 2020 values
// change exactly at these edges).
describe('NASA POWER grid cell', () => {
  it('finds the MERRA-2 cell around Seattle', () => {
    const c = gridCell(47.61, -122.33, 'T2M')
    expect(c).toMatchObject({ south: 47.25, north: 47.75, west: -122.8125, east: -122.1875, source: 'MERRA-2' })
    expect(c.kmNS).toBe(56)
    expect(c.kmEW).toBe(47)
  })

  it.each([
    [47.5, -122.2, -122.8125],
    [47.5, -122.18, -122.1875],
    [47.74, -122.5, -122.8125],
    [47.26, -122.5, -122.8125],
  ])('puts (%s, %s) in the cell starting at west %s', (lat, lng, west) => {
    expect(gridCell(lat, lng, 'PRECTOTCORR').west).toBe(west)
  })

  it('moves to the next row across 47.75°N', () => {
    expect(gridCell(47.74, -122.5, 'T2M').north).toBe(47.75)
    expect(gridCell(47.76, -122.5, 'T2M').south).toBe(47.75)
  })

  it('uses whole-degree 1° cells for sunlight', () => {
    expect(gridCell(47.61, -122.33, 'ALLSKY_SFC_SW_DWN')).toMatchObject({
      south: 47,
      north: 48,
      west: -123,
      east: -122,
      source: 'CERES SYN1deg',
    })
    expect(gridCell(47.99, -121.99, 'ALLSKY_SFC_SW_DWN').west).toBe(-122)
  })

  it('builds a closed, densified ring', () => {
    const ring = gridCellRing(gridCell(47.61, -122.33, 'T2M'))
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(ring.length).toBeGreaterThan(20)
    for (const [x, y] of ring) {
      expect(x).toBeGreaterThanOrEqual(-122.8125)
      expect(x).toBeLessThanOrEqual(-122.1875)
      expect(y).toBeGreaterThanOrEqual(47.25)
      expect(y).toBeLessThanOrEqual(47.75)
    }
  })
})
