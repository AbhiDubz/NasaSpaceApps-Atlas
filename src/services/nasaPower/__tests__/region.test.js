import { describe, expect, it } from 'vitest'
import { isInRegion } from '../region.js'
import { demoPlaces, TIP_PLACES } from '../demos.js'

describe('Washington study region', () => {
  it.each([
    ['Seattle', 47.61, -122.33],
    ['Puget Sound water', 47.7, -122.45],
    ['Hood Canal', 47.6, -122.95],
    ['Friday Harbor', 48.53, -123.02],
    ['Spokane', 47.66, -117.43],
    ['Vancouver, WA', 45.64, -122.66],
    ['Clarkston', 46.42, -117.05],
    ['Forks', 47.95, -124.39],
  ])('includes %s', (_name, lat, lng) => {
    expect(isInRegion(lat, lng)).toBe(true)
  })

  it.each([
    ['Portland, OR', 45.52, -122.68],
    ['Lewiston, ID', 46.42, -117.0],
    ['Victoria, BC', 48.43, -123.37],
    ['Vancouver, BC', 49.28, -123.12],
    ['the open Pacific', 47.0, -125.0],
    ['Dhaka', 23.81, 90.41],
  ])('excludes %s', (_name, lat, lng) => {
    expect(isInRegion(lat, lng)).toBe(false)
  })

  it('rejects non-numbers', () => {
    expect(isInRegion('x', -122)).toBe(false)
    expect(isInRegion(null, undefined)).toBe(false)
  })

  it('keeps every saved case and news-tip place inside Washington', () => {
    for (const p of [...demoPlaces(), ...Object.values(TIP_PLACES)]) expect(isInRegion(p.lat, p.lng)).toBe(true)
  })
})
