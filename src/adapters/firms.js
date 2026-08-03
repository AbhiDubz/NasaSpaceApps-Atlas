/**
 * NASA FIRMS active fire detections adapter — Tier B, keyed.
 * https://firms.modaps.eosdis.nasa.gov
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth } from './shared.js'

const POLL_MS = 600_000

/** @type {import('./types.js').SourceAdapter} */
export const firmsAdapter = {
  id: 'firms',
  tier: SOURCE_TIERS.B,
  pollIntervalMs: POLL_MS,
  requiredEnv: ['FIRMS_MAP_KEY'],

  metadata() {
    return {
      label: 'NASA FIRMS Active Fires',
      module: 'environment',
      dimension: 'environment',
      tier: SOURCE_TIERS.B,
      coverage: 'global',
      authoritative: true,
      requiresKey: true,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://firms.modaps.eosdis.nasa.gov',
      apiKeyHelpUrl: 'https://firms.modaps.eosdis.nasa.gov/api/map_key/',
    }
  },

  buildPollConfig(envKeys) {
    const key = envKeys.FIRMS_MAP_KEY || envKeys.FIRMS_KEY
    if (!key) return null
    return {
      url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/world/1`,
      format: 'text',
      pollInterval: POLL_MS,
    }
  },

  normalize(csvText, { createEventId, makeEvent }) {
    if (!csvText) return []
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',')
    const latIdx = headers.indexOf('latitude')
    const lngIdx = headers.indexOf('longitude')
    const confIdx = headers.indexOf('confidence')
    const frpIdx = headers.indexOf('frp')
    const dateIdx = headers.indexOf('acq_date')
    if (latIdx < 0 || lngIdx < 0) return []

    return lines.slice(1, 30).map((line) => {
      const cols = line.split(',')
      const lat = parseFloat(cols[latIdx])
      const lng = parseFloat(cols[lngIdx])
      if (isNaN(lat) || isNaN(lng)) return null
      const conf = cols[confIdx] || 'nominal'
      const frp = parseFloat(cols[frpIdx]) || 0
      let severity = 1
      if (frp > 100) { severity = 3 }
      if (conf === 'high' || frp > 500) { severity = 4 }
      return makeEvent({
        id: createEventId(lat, lng, Date.now(), 'firms', `fire-${lat.toFixed(2)}-${lng.toFixed(2)}`),
        dimension: 'environment',
        lat,
        lng,
        severity,
        corroborationSources: ['firms'],
        authoritative: true,
        ttl: 600,
        title: `Active Fire — FRP ${Math.round(frp)} MW`,
        detail: `Confidence: ${conf}. Fire radiative power: ${frp.toFixed(1)} MW.`,
        source: 'NASA FIRMS',
        sourceUrl: 'https://firms.modaps.eosdis.nasa.gov',
        tags: ['fire', 'wildfire'],
        timestamp: cols[dateIdx] ? new Date(cols[dateIdx]).toISOString() : new Date().toISOString(),
      })
    }).filter(Boolean)
  },

  health: defaultHealth('FIRMS'),
}
