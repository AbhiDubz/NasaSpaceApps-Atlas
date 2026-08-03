/**
 * GDELT CAMEO 15-minute event export adapter — Tier A, no key.
 *
 * Yields two products from one fetch:
 *   1. `aggregate()` — per-country FIPS rollups over ALL rows (choropleth + surge baseline)
 *   2. `normalize()` — high-confidence pins only (multi-source OR severe)
 *
 * https://www.gdeltproject.org
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth } from './shared.js'
import { fetchGdeltCameoEvents } from '../services/gdelt/eventService.js'

/** GDELT publishes a new export every quarter hour; poll on that cadence. */
const POLL_MS = 900_000

/** Pin gate: a CAMEO row pins only when multiple independent sources OR high severity. */
const PIN_MIN_SOURCES = 3
const PIN_MIN_SEVERITY = 4

/**
 * Keep CAMEO pins alive for 2 hours — matches the "Live" HUD window
 * (`TIME_FILTER_MAX_AGE_MS.live`) across 8 consecutive 15-minute polls.
 */
const PIN_TTL_SECONDS = 7200

export function cameoRowIsPinWorthy(row) {
  return (row.numSources || 0) >= PIN_MIN_SOURCES
    || (row.severity || 1) >= PIN_MIN_SEVERITY
}

/**
 * Reduce ALL parsed CAMEO rows to per-country aggregates keyed by FIPS 10-4
 * (`ActionGeo_CountryCode`, which joins directly to Natural Earth `FIPS_10`).
 * @param {object[]} rows
 * @returns {Record<string, { events: number, avgTone: number, avgGoldstein: number, quad: Record<string, number> }>}
 */
export function buildCameoCountryAggregates(rows) {
  const sums = {}
  for (const row of rows) {
    const fips = row.countryCode
    if (!fips || fips === '-99') continue
    let s = sums[fips]
    if (!s) {
      s = { events: 0, toneSum: 0, goldsteinSum: 0, quad: { 1: 0, 2: 0, 3: 0, 4: 0 } }
      sums[fips] = s
    }
    s.events++
    if (Number.isFinite(row.toneScore)) s.toneSum += row.toneScore
    if (Number.isFinite(row.goldstein)) s.goldsteinSum += row.goldstein
    if (s.quad[row.quadClass] != null) s.quad[row.quadClass]++
  }
  const out = {}
  for (const [fips, s] of Object.entries(sums)) {
    out[fips] = {
      events: s.events,
      avgTone: s.toneSum / s.events,
      avgGoldstein: s.goldsteinSum / s.events,
      quad: s.quad,
    }
  }
  return out
}

/** @type {import('./types.js').SourceAdapter} */
export const gdeltCameoAdapter = {
  id: 'gdelt-cameo',
  tier: SOURCE_TIERS.A,
  pollIntervalMs: POLL_MS,

  metadata() {
    return {
      label: 'GDELT CAMEO Events',
      module: 'conflict',
      dimension: 'safety',
      tier: SOURCE_TIERS.A,
      coverage: 'global',
      authoritative: false,
      requiresKey: false,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://www.gdeltproject.org',
    }
  },

  buildPollConfig() {
    return { format: 'json', pollInterval: POLL_MS, custom: true }
  },

  async fetchRaw(_config, ctx = {}) {
    // Off the browser the same-origin proxy hop buys nothing, so go direct.
    return await fetchGdeltCameoEvents({ direct: ctx.serverSide === true })
  },

  aggregate(rows) {
    if (!Array.isArray(rows) || !rows.length) return null
    const aggregates = buildCameoCountryAggregates(rows)
    if (!Object.keys(aggregates).length) return null
    return {
      aggregates,
      exportTsMs: rows[0]?._exportTsMs ?? Date.now(),
      totalRows: rows.length,
    }
  },

  normalize(rows, { createEventId, makeEvent }) {
    if (!Array.isArray(rows)) return []
    return rows.filter(cameoRowIsPinWorthy).map((row) => {
      const ts = typeof row._exportTsMs === 'number' && Number.isFinite(row._exportTsMs)
        ? row._exportTsMs
        : Date.now()
      const sev = Math.min(5, Math.max(1, row.severity || 1))
      return makeEvent({
        id: createEventId(row.lat, row.lng, ts, 'gdelt-cameo', row.title),
        dimension: row.dimension,
        lat: row.lat,
        lng: row.lng,
        latApproximate: row.latApproximate === true,
        severity: sev,
        corroborationCount: row.corroborationCount || 1,
        corroborationSources: ['gdelt-cameo'],
        title: row.title,
        detail: `${row.detail} SQLDATE: ${row.sqlDate || '—'}. Mentions: ${row.numMentions}. Actors: ${[row.actor1, row.actor2].filter(Boolean).join(' → ') || 'n/a'}.`,
        source: 'GDELT',
        sourceUrl: row.sourceUrl || 'https://www.gdeltproject.org',
        tags: ['gdelt', 'cameo', `cameo${row.cameoRoot || ''}`, typeof row.quadClass === 'number' ? `qc${row.quadClass}` : ''].filter(Boolean),
        toneScore: row.toneScore,
        actor1: row.actor1,
        actor2: row.actor2,
        locationName: row.locationName,
        timestamp: new Date(ts).toISOString(),
        ttl: PIN_TTL_SECONDS,
      })
    })
  },

  health: defaultHealth('GDELT CAMEO'),
}
