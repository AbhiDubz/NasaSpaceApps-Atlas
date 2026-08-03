/**
 * Alias seeds for entity resolution.
 *
 * Resolution can only collapse "Apple Inc." and "AAPL" if something told it
 * they are the same thing. These seeds come from reference data ATLAS already
 * carries — ISO codes, CAMEO actor codes, and the ticker symbols its own
 * adapters emit — so the graph starts with the joins it can prove rather than
 * guessing them from string similarity.
 */
import {
  COUNTRY_CENTROIDS,
  ISO2_TO_ISO3,
  ISO_TO_COUNTRY_NAME,
  countryAliases,
} from './countryCodes.js'

/**
 * CAMEO actor role codes that appear as suffixes on GDELT Actor1Code /
 * Actor2Code. Seeded as `actor` objects so "USAGOV" and "United States
 * Government" converge.
 */
export const CAMEO_ROLE_CODES = {
  GOV: 'Government',
  MIL: 'Military',
  REB: 'Rebels',
  COP: 'Police',
  JUD: 'Judiciary',
  SPY: 'Intelligence',
  LEG: 'Legislature',
  OPP: 'Opposition',
  BUS: 'Business',
  CVL: 'Civilians',
  MED: 'Media',
  EDU: 'Education',
  HLH: 'Health',
  ENV: 'Environmental',
  IGO: 'Intergovernmental Organization',
  NGO: 'Non-Governmental Organization',
  UAF: 'Unidentified Armed Forces',
  REF: 'Refugees',
}

/** Currency codes the Finnhub FX adapter quotes. */
export const CURRENCY_SEEDS = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'Pound Sterling' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
]

/** CoinGecko ids paired with the ticker the same asset trades under. */
export const CRYPTO_SEEDS = [
  { id: 'bitcoin', ticker: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', ticker: 'ETH', name: 'Ethereum' },
  { id: 'tether', ticker: 'USDT', name: 'Tether' },
]

/**
 * @returns {import('./objectMapping.js').MappedObject[]}
 */
export function buildCountrySeeds() {
  const out = []
  for (const [iso2, centroid] of Object.entries(COUNTRY_CENTROIDS)) {
    const name = ISO_TO_COUNTRY_NAME[iso2]
    if (!name) continue
    out.push({
      canonicalId: `country:${iso2.toLowerCase()}`,
      label: name,
      kind: 'country',
      iso: iso2,
      lat: centroid[0],
      lng: centroid[1],
      domain: 'governance',
      confidence: 1.0,
      aliases: countryAliases(iso2),
      sourceIds: ['iso-3166'],
      properties: { iso2, iso3: ISO2_TO_ISO3[iso2] || null },
    })
  }
  return out
}

/**
 * CAMEO country actor codes are ISO3, so `USAGOV` splits into a country we
 * already have and a role we can name.
 * @returns {import('./objectMapping.js').MappedObject[]}
 */
export function buildActorRoleSeeds() {
  const out = []
  for (const [iso2, iso3] of Object.entries(ISO2_TO_ISO3)) {
    const country = ISO_TO_COUNTRY_NAME[iso2]
    if (!country) continue
    for (const [code, role] of Object.entries(CAMEO_ROLE_CODES)) {
      // Only the roles that are actually common enough to be worth a row.
      if (!['GOV', 'MIL', 'REB', 'COP', 'OPP', 'LEG', 'JUD'].includes(code)) continue
      out.push({
        canonicalId: `actor:${iso3.toLowerCase()}-${code.toLowerCase()}`,
        label: `${country} ${role}`,
        kind: 'actor',
        iso: iso2,
        domain: 'governance',
        confidence: 1.0,
        aliases: [`${iso3}${code}`, `${iso2}${code}`],
        sourceIds: ['cameo'],
        properties: { cameoCode: `${iso3}${code}`, role, iso2, iso3 },
      })
    }
  }
  return out
}

/**
 * @returns {import('./objectMapping.js').MappedObject[]}
 */
export function buildTickerSeeds() {
  const out = []

  for (const { code, name } of CURRENCY_SEEDS) {
    out.push({
      canonicalId: `asset:currency-${code.toLowerCase()}`,
      label: name,
      kind: 'asset',
      domain: 'economy',
      confidence: 1.0,
      aliases: [code, name],
      sourceIds: ['iso-4217'],
      properties: { assetClass: 'currency', ticker: code },
    })
  }

  for (const { id, ticker, name } of CRYPTO_SEEDS) {
    out.push({
      canonicalId: `asset:crypto-${id}`,
      label: name,
      kind: 'asset',
      domain: 'economy',
      confidence: 1.0,
      aliases: [ticker, id, name, ticker.toLowerCase()],
      sourceIds: ['coingecko'],
      properties: { assetClass: 'crypto', ticker, coingeckoId: id },
    })
  }

  return out
}

/**
 * Every seed object, ready to hand to the object store.
 * @returns {import('./objectMapping.js').MappedObject[]}
 */
export function buildAllSeeds() {
  return [
    ...buildCountrySeeds(),
    ...buildActorRoleSeeds(),
    ...buildTickerSeeds(),
  ]
}
