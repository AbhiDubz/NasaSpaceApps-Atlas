/**
 * USGS earthquakes adapter — Tier A, no key.
 * https://earthquake.usgs.gov
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth } from './shared.js'

const POLL_MS = 120_000

/** @type {import('./types.js').SourceAdapter} */
export const usgsAdapter = {
  id: 'usgs',
  tier: SOURCE_TIERS.A,
  pollIntervalMs: POLL_MS,

  metadata() {
    return {
      label: 'USGS Earthquakes',
      module: 'seismic',
      dimension: 'environment',
      tier: SOURCE_TIERS.A,
      coverage: 'global',
      authoritative: true,
      requiresKey: false,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://earthquake.usgs.gov',
    }
  },

  buildPollConfig() {
    return {
      url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&orderby=time&limit=50',
      format: 'json',
      pollInterval: POLL_MS,
    }
  },

  normalize(data, { createEventId, makeEvent }) {
    if (!data?.features) return []
    return data.features
      .filter((f) => f.geometry?.coordinates && f.properties?.mag)
      .map((f) => {
        const p = f.properties
        const [lng, lat] = f.geometry.coordinates
        const mag = p.mag
        let severity = 1
        if (mag >= 7.0) { severity = 5 }
        else if (mag >= 6.0) { severity = 4 }
        else if (mag >= 5.5) { severity = 3 }
        else if (mag >= 5.0) { severity = 2 }
        return makeEvent({
          id: createEventId(lat, lng, p.time, 'usgs', p.title || ''),
          dimension: 'environment',
          lat,
          lng,
          severity,
          corroborationSources: ['usgs'],
          authoritative: true,
          ttl: 360,
          title: p.title || `M${mag} Earthquake`,
          detail: `Magnitude ${mag} at depth ${f.geometry.coordinates[2] || 0}km. ${p.place || ''}`.trim(),
          source: 'USGS',
          sourceUrl: p.url || 'https://earthquake.usgs.gov',
          tags: ['earthquake', `M${mag.toFixed(1)}`],
          timestamp: new Date(p.time).toISOString(),
        })
      })
  },

  health: defaultHealth('USGS'),
}
