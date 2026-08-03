/**
 * NOAA NHC active tropical cyclones adapter — Tier B, no key.
 * Transport is a multi-feed RSS + KML bundle, so it runs through `fetchRaw`.
 * https://www.nhc.noaa.gov
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth } from './shared.js'
import { fetchNhcStormsBundle } from '../core/fetchNhcStorms.js'

const POLL_MS = 300_000

/** @type {import('./types.js').SourceAdapter} */
export const noaaNhcAdapter = {
  id: 'noaa-nhc',
  tier: SOURCE_TIERS.B,
  pollIntervalMs: POLL_MS,

  metadata() {
    return {
      label: 'NOAA NHC Cyclones',
      module: 'weather',
      dimension: 'environment',
      tier: SOURCE_TIERS.B,
      coverage: 'regional',
      authoritative: true,
      requiresKey: false,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://www.nhc.noaa.gov',
    }
  },

  buildPollConfig() {
    return { format: 'json', pollInterval: POLL_MS, custom: true }
  },

  async fetchRaw() {
    const storms = await fetchNhcStormsBundle()
    return { storms }
  },

  normalize(data, { createEventId, makeEvent }) {
    const storms = data?.storms
    if (!Array.isArray(storms) || storms.length === 0) return []
    return storms.map((s) => {
      const track = s.trackCoords || []
      const cone = s.coneCoords || []
      const centerLat = s.centerLat ?? track[track.length - 1]?.lat ?? 0
      const centerLng = s.centerLng ?? track[track.length - 1]?.lng ?? 0
      const cat = s.category || 'TC'
      const sev = /hurricane|typhoon/i.test(cat) ? 4 : /storm/i.test(cat) ? 3 : 2
      return makeEvent({
        id: createEventId(centerLat, centerLng, Date.now(), 'noaa-nhc', s.stormId || s.name),
        dimension: 'environment',
        lat: centerLat,
        lng: centerLng,
        severity: sev,
        corroborationSources: ['noaa-nhc'],
        ttl: 3600,
        title: `${s.name || s.stormId} (${cat})`,
        detail: `NOAA/NHC active cyclone · ${track.length} track points · ${cone.length ? 'cone available' : 'track only'}`,
        source: 'NOAA NHC',
        sourceUrl: 'https://www.nhc.noaa.gov',
        tags: ['weather', 'hurricane', 'nhc', cat.toLowerCase()],
        trackKind: 'storm',
        stormId: s.stormId,
        stormCategory: cat,
        trackCoords: track,
        coneCoords: cone,
      })
    })
  },

  health: defaultHealth('NOAA NHC'),
}
