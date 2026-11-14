import { describe, expect, it } from 'vitest'
import { buildWindGridCoords, makeWindSampler, windToUV } from '../windGrid.js'

function grid(fn) {
  const { lats, lngs } = buildWindGridCoords()
  return lats.map((lat, i) => ({ lat, lng: lngs[i], ...fn(lat, lngs[i]) }))
}

describe('wind grid', () => {
  it('converts a "from" direction into where the wind is going', () => {
    const west = windToUV(36, 270) // 10 m/s blowing from the west
    expect(west.u).toBeCloseTo(10, 5)
    expect(west.v).toBeCloseTo(0, 5)
    const north = windToUV(36, 0)
    expect(north.v).toBeCloseTo(-10, 5)
  })

  it('returns grid values exactly at grid points and blends between them', () => {
    const sample = makeWindSampler(grid((lat, lng) => ({ u: lat, v: lng })))
    expect(sample(20, -100)).toMatchObject({ u: 20, v: -100 })
    const mid = sample(30, -90)
    expect(mid.u).toBeCloseTo(30, 4)
    expect(mid.v).toBeCloseTo(-90, 4)
  })

  it('wraps across the date line and clamps beyond the grid edge', () => {
    const sample = makeWindSampler(grid((lat, lng) => ({ u: lng === 160 ? 8 : lng === -180 ? 4 : 0, v: lat })))
    expect(sample(0, 170).u).toBeCloseTo(6, 4) // halfway between 160°E and 180°
    expect(sample(0, -175).u).toBeCloseTo(3, 4)
    expect(sample(85, 0).v).toBeCloseTo(60, 4)
    expect(sample(-85, 0).v).toBeCloseTo(-60, 4)
  })

  it('falls back to nearest-point lookup for an irregular grid', () => {
    const sample = makeWindSampler([{ lat: 0, lng: 0, u: 1, v: 2 }, { lat: 10, lng: 50, u: 3, v: 4 }])
    expect(sample(9, 45)).toMatchObject({ u: 3, v: 4 })
  })
})
