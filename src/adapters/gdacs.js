/**
 * GDACS global disaster alerts adapter — Tier A, no key.
 * Browser: same-origin `/api/gdacs-rss` proxy (GDACS has no CORS).
 * Server ingest: fetch the upstream RSS directly — Node has no CORS, and a
 * relative `/api/*` URL throws "Failed to parse URL" under undici.
 * https://www.gdacs.org
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth, getXmlTag, parseRssItems, resolveUrl } from './shared.js'

const POLL_MS = 300_000
const GDACS_RSS_URL = 'https://www.gdacs.org/xml/rss.xml'
const GDACS_PROXY_PATH = '/api/gdacs-rss'

/** @type {import('./types.js').SourceAdapter} */
export const gdacsAdapter = {
  id: 'gdacs',
  tier: SOURCE_TIERS.A,
  pollIntervalMs: POLL_MS,

  metadata() {
    return {
      label: 'GDACS Disaster Alerts',
      module: 'seismic',
      dimension: 'environment',
      tier: SOURCE_TIERS.A,
      coverage: 'global',
      authoritative: true,
      requiresKey: false,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://www.gdacs.org',
    }
  },

  buildPollConfig() {
    return { format: 'text', pollInterval: POLL_MS, custom: true }
  },

  async fetchRaw(_config, ctx = {}) {
    const url = ctx.serverSide
      ? GDACS_RSS_URL
      : resolveUrl(GDACS_PROXY_PATH, ctx.baseUrl)
    return ctx.fetchText(url)
  },

  normalize(xmlText, { createEventId, makeEvent }) {
    if (!xmlText) return []
    const events = []
    for (const item of parseRssItems(xmlText)) {
      const title = getXmlTag(item, 'title')
      const description = getXmlTag(item, 'description')
      const link = getXmlTag(item, 'link')
      const pubDate = getXmlTag(item, 'pubDate')

      const latM = item.match(/<geo:lat>([^<]+)/)
      const lngM = item.match(/<geo:long>([^<]+)/)
      if (!latM || !lngM) continue
      const lat = parseFloat(latM[1])
      const lng = parseFloat(lngM[1])
      if (isNaN(lat) || isNaN(lng)) continue

      const alertM = item.match(/<gdacs:alertlevel>([^<]+)/)
      const alertLevel = alertM ? alertM[1].trim().toLowerCase() : ''
      let severity = 2
      if (alertLevel === 'red') { severity = 5 }
      else if (alertLevel === 'orange') { severity = 3 }

      events.push(makeEvent({
        id: createEventId(lat, lng, Date.parse(pubDate || Date.now()), 'gdacs', title),
        dimension: 'environment',
        lat,
        lng,
        severity,
        corroborationSources: ['gdacs'],
        authoritative: true,
        ttl: 600,
        title,
        detail: description,
        source: 'GDACS',
        sourceUrl: link || 'https://www.gdacs.org',
        tags: ['disaster'],
        timestamp: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      }))
    }
    return events
  },

  health: defaultHealth('GDACS'),
}
