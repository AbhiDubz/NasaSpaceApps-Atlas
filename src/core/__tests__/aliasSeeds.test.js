import { describe, expect, it } from 'vitest'
import { buildAllSeeds, buildCountrySeeds, buildTickerSeeds } from '../aliasSeeds.js'
import { countryAliases, lookupCountryCentroid } from '../countryCodes.js'

describe('countryCodes', () => {
  it('resolves names, ISO2 codes, and GDELT labels to the same centroid', () => {
    const byName = lookupCountryCentroid('United States')
    const byCode = lookupCountryCentroid('US')
    const byLabel = lookupCountryCentroid('usa')

    expect(byName?.iso).toBe('US')
    expect(byCode?.iso).toBe('US')
    expect(byLabel?.iso).toBe('US')
    expect(byName).toEqual(byCode)
  })

  it('returns null for unknown labels rather than guessing', () => {
    expect(lookupCountryCentroid('Atlantis')).toBeNull()
    expect(lookupCountryCentroid('')).toBeNull()
  })

  it('collects every code and name variant for a country', () => {
    const aliases = countryAliases('GB')
    expect(aliases).toContain('GB')
    expect(aliases).toContain('GBR')
    expect(aliases).toContain('United Kingdom')
    expect(aliases).toContain('uk')
    expect(aliases).toContain('greatbritain')
  })
})

describe('alias seeds', () => {
  it('gives every country a located, uniquely identified object', () => {
    const seeds = buildCountrySeeds()
    expect(seeds.length).toBeGreaterThan(100)

    const ids = new Set(seeds.map((s) => s.canonicalId))
    expect(ids.size).toBe(seeds.length)

    for (const seed of seeds) {
      expect(seed.kind).toBe('country')
      expect(Number.isFinite(seed.lat)).toBe(true)
      expect(Number.isFinite(seed.lng)).toBe(true)
      expect(seed.aliases.length).toBeGreaterThan(1)
    }
  })

  it('pairs ticker symbols with their full names', () => {
    const btc = buildTickerSeeds().find((s) => s.canonicalId === 'asset:crypto-bitcoin')
    expect(btc?.aliases).toContain('BTC')
    expect(btc?.aliases).toContain('Bitcoin')
    expect(btc?.properties.ticker).toBe('BTC')
  })

  it('produces no duplicate canonical ids across all seed families', () => {
    const seeds = buildAllSeeds()
    const ids = new Set(seeds.map((s) => s.canonicalId))
    expect(ids.size).toBe(seeds.length)
  })

  it('maps CAMEO actor codes onto named actors', () => {
    const seeds = buildAllSeeds()
    const usaGov = seeds.find((s) => s.canonicalId === 'actor:usa-gov')
    expect(usaGov?.label).toBe('United States Government')
    expect(usaGov?.aliases).toContain('USAGOV')
  })
})
