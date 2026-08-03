import { describe, expect, it } from 'vitest'
import {
  NEOTOMA_MAX_SUPPORTED_MA,
  fallbackSitesInWindow,
  isNeotomaAgeSupported,
  maToYearsBp,
  neotomaAgeWindowYears,
  quantizeNeotomaAgeMa,
  siteToPoint,
} from '../../../services/earthHistory/fetchNeotomaSites.js'

describe('neotoma age helpers', () => {
  it('converts Ma to years BP', () => {
    expect(maToYearsBp(0.012)).toBe(12000)
  })

  it('builds a years-BP window', () => {
    const win = neotomaAgeWindowYears(0.012)
    expect(win.minage).toBeLessThan(win.maxage)
    expect(win.center).toBe(12000)
  })

  it('gates Quaternary span', () => {
    expect(isNeotomaAgeSupported(1)).toBe(true)
    expect(isNeotomaAgeSupported(NEOTOMA_MAX_SUPPORTED_MA)).toBe(true)
    expect(isNeotomaAgeSupported(NEOTOMA_MAX_SUPPORTED_MA + 1)).toBe(false)
  })

  it('quantizes finely near present', () => {
    expect(quantizeNeotomaAgeMa(0.0123)).toBe(0.012)
  })
})

describe('siteToPoint / fallback', () => {
  it('maps site records to globe points', () => {
    const pt = siteToPoint({ siteid: 9, sitename: 'Test', lat: 10, long: 20 }, 0)
    expect(pt).toMatchObject({ id: 'neo-9', lat: 10, lng: 20, __ehKind: 'neotoma' })
  })

  it('returns curated fallback sites in window', () => {
    const pts = fallbackSitesInWindow({ minage: 10000, maxage: 20000 })
    expect(pts.length).toBeGreaterThan(0)
    expect(pts[0].source).toBe('fallback')
  })
})
