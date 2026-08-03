/**
 * NASA EONET natural events adapter — Tier A, no key.
 * https://eonet.gsfc.nasa.gov
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth } from './shared.js'

const POLL_MS = 600_000
const SEVERE_CATEGORIES = ['volcanoes', 'severeStorms', 'floods', 'landslides']

/** @type {import('./types.js').SourceAdapter} */
export const eonetAdapter = {
  id: 'eonet',
  tier: SOURCE_TIERS.A,
  pollIntervalMs: POLL_MS,

  metadata() {
    return {
      label: 'NASA EONET',
      module: 'weather',
      dimension: 'environment',
      tier: SOURCE_TIERS.A,
      coverage: 'global',
      authoritative: true,
      requiresKey: false,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://eonet.gsfc.nasa.gov',
    }
  },

  buildPollConfig() {
    return {
      url: 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=3',
      format: 'json',
      pollInterval: POLL_MS,
    }
  },

  normalize(data, { createEventId, makeEvent }) {
    if (!data?.events) return []
    return data.events
      .filter((e) => e.geometry?.length > 0)
      .map((e) => {
        const geo = e.geometry[e.geometry.length - 1]
        if (!geo.coordinates) return null
        const [lng, lat] = geo.coordinates
        const catId = e.categories?.[0]?.id || ''
        const isSevere = SEVERE_CATEGORIES.includes(catId)
        return makeEvent({
          id: createEventId(lat, lng, Date.parse(geo.date || Date.now()), 'eonet', e.title),
          dimension: 'environment',
          lat,
          lng,
          severity: isSevere ? 3 : 1,
          corroborationSources: ['eonet'],
          authoritative: true,
          ttl: 1800,
          title: e.title || 'Natural Event',
          detail: `Category: ${catId}. Source: NASA EONET.`,
          source: 'NASA EONET',
          sourceUrl: e.link || 'https://eonet.gsfc.nasa.gov',
          tags: [catId, 'natural-event'],
          timestamp: geo.date || new Date().toISOString(),
        })
      })
      .filter(Boolean)
  },

  health: defaultHealth('EONET'),
}
