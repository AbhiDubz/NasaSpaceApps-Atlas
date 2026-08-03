import { describe, expect, it } from 'vitest'
import {
  CIV_MAX_SUPPORTED_YBP,
  fetchCivilizationPlaces,
  isCivilizationAgeSupported,
  placesAtYbp,
} from '../civilizationPlaces.js'

describe('isCivilizationAgeSupported', () => {
  it('supports Holocene window', () => {
    expect(isCivilizationAgeSupported(0)).toBe(true)
    expect(isCivilizationAgeSupported(CIV_MAX_SUPPORTED_YBP)).toBe(true)
    expect(isCivilizationAgeSupported(CIV_MAX_SUPPORTED_YBP + 1000)).toBe(false)
  })
})

describe('placesAtYbp', () => {
  it('returns Rome near present', () => {
    const pts = placesAtYbp(100)
    expect(pts.some((p) => p.id === 'rome')).toBe(true)
  })

  it('returns Uruk in the mid-Holocene urban window', () => {
    const pts = placesAtYbp(4500)
    expect(pts.some((p) => p.id === 'uruk')).toBe(true)
  })

  it('returns empty deep outside Holocene', () => {
    expect(placesAtYbp(100_000)).toEqual([])
  })
})

describe('fetchCivilizationPlaces', () => {
  it('returns ok payload in Holocene', () => {
    const r = fetchCivilizationPlaces(2000)
    expect(r.ok).toBe(true)
    expect(r.count).toBeGreaterThan(0)
  })

  it('rejects deep time', () => {
    const r = fetchCivilizationPlaces(50_000)
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/Holocene/i)
  })
})
