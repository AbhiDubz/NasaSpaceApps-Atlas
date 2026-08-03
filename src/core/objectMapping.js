/**
 * Canonical event → ontology object graph.
 *
 * Turns the flat event stream into typed objects connected by semantic links,
 * so the graph accumulates across sessions instead of living only in memory.
 * Runs in the worker and in the server ingest route, so no DOM or Node APIs.
 */
import { buildCanonicalId } from './entityResolution.js'
import { ISO_TO_COUNTRY_NAME, lookupCountryCentroid } from './countryCodes.js'

/**
 * @typedef {object} MappedObject
 * @property {string} canonicalId
 * @property {string} label
 * @property {string} kind
 * @property {string} [iso]
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {string} [domain]
 * @property {Record<string, unknown>} [properties]
 * @property {number} [confidence]
 * @property {string[]} aliases
 * @property {string[]} sourceIds
 */

/**
 * @typedef {object} MappedLink
 * @property {string} fromId — canonicalId
 * @property {string} toId — canonicalId
 * @property {string} type
 * @property {string} [label]
 * @property {string} [source]
 * @property {string} [eventId]
 * @property {number} [confidence]
 */

/**
 * Which object type a source's records become. Sources absent from this map
 * produce generic `event` objects.
 */
export const SOURCE_OBJECT_KIND = {
  // Incident feeds
  usgs: 'event',
  gdacs: 'event',
  eonet: 'event',
  firms: 'event',
  acled: 'event',
  ucdp: 'event',
  'gdelt-cameo': 'event',
  'noaa-nhc': 'event',
  'open-meteo': 'event',
  'cisa-kev': 'event',
  reliefweb: 'event',
  'who-don': 'event',
  promed: 'event',

  // Moving assets
  aisstream: 'vessel',
  opensky: 'asset',
  'celestrak-tle': 'asset',
  celestrak: 'asset',
  cameras: 'asset',

  // Narrative
  gdelt: 'news_item',
  'gdelt-vgkg': 'news_item',
  bluesky: 'news_item',
  'fact-check': 'news_item',
  'loc-legal': 'news_item',

  // Economic series
  fred: 'economic_indicator',
  eia: 'economic_indicator',
  finnhub: 'economic_indicator',
  coingecko: 'economic_indicator',
  'alt-fng': 'economic_indicator',
  'electricity-maps': 'energy_asset',
  entsoe: 'energy_asset',

  // Governance
  'ofac-sdn': 'event',
}

/** Link type from the root object back to the place it happened at. */
const PLACE_LINK_BY_KIND = {
  event: 'occurred_near',
  vessel: 'located_in',
  asset: 'located_in',
  news_item: 'mentioned_in',
  economic_indicator: 'measures',
  energy_asset: 'located_in',
}

/**
 * Best-effort source id for an event. Events carry a display `source` name and
 * a machine id in `corroborationSources`.
 * @param {object} event
 * @returns {string}
 */
export function eventSourceId(event) {
  return event?.corroborationSources?.[0] || event?.source || 'unknown'
}

/**
 * Stable registry identifier when the event carries one (MMSI, NORAD, ICAO24,
 * storm id). Returns null for one-shot incidents that should key on event id.
 * @param {object} event
 * @param {string} kind
 * @returns {string | null}
 */
export function registryCanonicalId(event, kind) {
  if (!event) return null
  if (kind === 'vessel' && event.mmsi) return `vessel:mmsi-${event.mmsi}`
  if (kind === 'asset') {
    if (event.noradId != null && event.noradId !== '') return `asset:norad-${event.noradId}`
    if (event.icao24) return `asset:icao-${String(event.icao24).toLowerCase()}`
  }
  if (event.stormId) return `event:storm-${event.stormId}`
  if (kind === 'economic_indicator') {
    const series = event.seriesId || event.tags?.find((t) => /^[A-Z0-9.]+$/.test(t))
    if (series) return `economic_indicator:${String(series).toLowerCase()}`
  }
  return null
}

/**
 * Alternate labels that should resolve back to this object on the next pass.
 * @param {object} event
 * @returns {string[]}
 */
export function registryAliases(event) {
  if (!event) return []
  const aliases = []
  if (event.shipName) aliases.push(event.shipName)
  if (event.mmsi) aliases.push(`MMSI ${event.mmsi}`)
  if (event.callsign) aliases.push(event.callsign)
  if (event.noradId != null && event.noradId !== '') aliases.push(`NORAD ${event.noradId}`)
  if (event.icao24) aliases.push(String(event.icao24).toUpperCase())
  if (event.stormId) aliases.push(event.stormId)
  return [...new Set(aliases.filter(Boolean))]
}

/**
 * Whether an event should be written into the persistent object graph.
 * Single-source, low-severity noise would drown the free-tier DB; keep
 * corroboration clusters and high-severity incidents only.
 * @param {object} event
 * @returns {boolean}
 */
export function shouldPersistEvent(event) {
  if (!event?.id) return false
  const kind = objectKindForEvent(event)
  // Registry-keyed objects (ships, sats, indicators) are durable by nature.
  if (registryCanonicalId(event, kind)) return true
  if ((event.corroborationCount || 1) > 1) return true
  if ((event.severity || 1) >= 3) return true
  if (event.authoritative && (event.severity || 1) >= 2) return true
  return false
}

/**
 * @param {object} event
 * @returns {string}
 */
export function objectKindForEvent(event) {
  return SOURCE_OBJECT_KIND[eventSourceId(event)] || 'event'
}

function hasCoords(event) {
  return Number.isFinite(event?.lat) && Number.isFinite(event?.lng)
    && !(event.lat === 0 && event.lng === 0)
}

/**
 * Find the country an event belongs to from the labels it already carries.
 * Only claims a country it can name — no reverse geocoding guesswork.
 * @param {object} event
 * @returns {{ iso: string, name: string, lat: number, lng: number } | null}
 */
export function deriveCountry(event) {
  const candidates = [
    event?.originCountry,
    ...(event?.tags || []),
    ...String(event?.locationName || '').split(',').map((p) => p.trim()).reverse(),
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue
    const hit = lookupCountryCentroid(candidate)
    if (!hit) continue
    const name = ISO_TO_COUNTRY_NAME[hit.iso]
    if (!name) continue
    return { iso: hit.iso, name, lat: hit.lat, lng: hit.lng }
  }
  return null
}

/**
 * Confidence for the root object. Corroboration is the honest signal we
 * already compute; fall back to a low prior for single-source records.
 * @param {object} event
 */
function rootConfidence(event) {
  if (Number.isFinite(event?.corroborationScore) && event.corroborationScore > 0) {
    return Math.min(1, 0.5 + event.corroborationScore * 0.5)
  }
  if (event?.authoritative) return 0.9
  return 0.5
}

/**
 * Map one canonical event into objects plus the links between them.
 * @param {object} event
 * @returns {{ objects: MappedObject[], links: MappedLink[] }}
 */
export function mapEventToObjects(event) {
  if (!event?.id) return { objects: [], links: [] }

  const sourceId = eventSourceId(event)
  const kind = objectKindForEvent(event)
  const domain = event.dimension || event.domain || null

  /** @type {MappedObject[]} */
  const objects = []
  /** @type {MappedLink[]} */
  const links = []
  const seen = new Set()

  const add = (obj) => {
    if (!obj.canonicalId || seen.has(obj.canonicalId)) return obj.canonicalId
    seen.add(obj.canonicalId)
    objects.push(obj)
    return obj.canonicalId
  }

  // ── Root object ─────────────────────────────────────────────────────────
  // Registry identifiers beat event ids: the same ship reported an hour later
  // is the same object, whereas the same earthquake reported twice is not.
  const rootId = registryCanonicalId(event, kind) || `${kind}:${event.id}`
  add({
    canonicalId: rootId,
    label: (event.title || 'Untitled').slice(0, 300),
    kind,
    lat: hasCoords(event) ? event.lat : undefined,
    lng: hasCoords(event) ? event.lng : undefined,
    domain,
    confidence: rootConfidence(event),
    aliases: registryAliases(event),
    sourceIds: [sourceId],
    properties: pruneUndefined({
      eventId: event.id,
      severity: event.severity,
      detail: event.detail || undefined,
      sourceLabel: event.source || undefined,
      sourceUrl: event.sourceUrl || undefined,
      timestamp: event.timestamp,
      fetchedAt: event.fetchedAt,
      latApproximate: event.latApproximate || undefined,
      authoritative: event.authoritative || undefined,
      disputed: event.disputed || undefined,
      corroborationCount: event.corroborationCount,
      corroborationSources: event.corroborationSources,
      corroborationScore: event.corroborationScore,
      sourceReportCount: event.sourceReports?.length || undefined,
      toneDisagreement: event.toneDisagreement || undefined,
      threadId: event.threadId || undefined,
      toneScore: event.toneScore ?? undefined,
      tags: event.tags?.length ? event.tags : undefined,
      trackKind: event.trackKind || undefined,
      mmsi: event.mmsi || undefined,
      noradId: event.noradId ?? undefined,
      icao24: event.icao24 || undefined,
      stormId: event.stormId || undefined,
    }),
  })

  // ── Place ───────────────────────────────────────────────────────────────
  if (event.locationName) {
    const placeId = add({
      canonicalId: buildCanonicalId(event.locationName, 'place'),
      label: event.locationName,
      kind: 'place',
      lat: hasCoords(event) ? event.lat : undefined,
      lng: hasCoords(event) ? event.lng : undefined,
      domain,
      confidence: event.latApproximate ? 0.5 : 0.8,
      aliases: [],
      sourceIds: [sourceId],
      properties: {},
    })
    links.push({
      fromId: rootId,
      toId: placeId,
      type: PLACE_LINK_BY_KIND[kind] || 'located_in',
      label: event.locationName,
      source: sourceId,
      eventId: event.id,
      confidence: event.latApproximate ? 0.5 : 0.85,
    })
  }

  // ── Country ─────────────────────────────────────────────────────────────
  // Links into the seeded ISO country objects, which is what turns per-source
  // records into a graph rather than a pile of disconnected points.
  const country = deriveCountry(event)
  if (country) {
    const countryId = add({
      canonicalId: `country:${country.iso.toLowerCase()}`,
      label: country.name,
      kind: 'country',
      iso: country.iso,
      lat: country.lat,
      lng: country.lng,
      domain: 'governance',
      confidence: 0.9,
      aliases: [country.iso],
      sourceIds: [sourceId],
      properties: { iso2: country.iso },
    })
    links.push({
      fromId: rootId,
      // An indicator measures its country; everything else sits inside it.
      toId: countryId,
      type: kind === 'economic_indicator' ? 'measures' : 'located_in',
      label: country.name,
      source: sourceId,
      eventId: event.id,
      confidence: 0.8,
    })
  }

  // ── Corroboration ───────────────────────────────────────────────────────
  // crossSourceMerge already decided these describe the same happening. Write
  // that out as edges so the judgement survives the session.
  for (const correlatedId of event.correlatedEventIds || []) {
    if (!correlatedId || correlatedId === event.id) continue
    links.push({
      fromId: rootId,
      toId: `${kind}:${correlatedId}`,
      type: 'correlation',
      label: event.threadId || '',
      source: sourceId,
      eventId: event.id,
      confidence: Number.isFinite(event.corroborationScore) ? event.corroborationScore : 0.5,
    })
  }

  // ── Actors ──────────────────────────────────────────────────────────────
  const actorLink = kind === 'news_item' ? 'mentioned_in' : 'involved_in'
  for (const actorName of [event.actor1, event.actor2]) {
    if (!actorName || actorName.length < 2) continue
    const actorId = add({
      canonicalId: buildCanonicalId(actorName, 'actor'),
      label: actorName,
      kind: 'actor',
      domain,
      confidence: 0.6,
      aliases: [],
      sourceIds: [sourceId],
      properties: {},
    })
    links.push({
      fromId: actorId,
      toId: rootId,
      type: actorLink,
      label: actorName,
      source: sourceId,
      eventId: event.id,
      confidence: 0.6,
    })
  }

  // ── Vessels keyed by MMSI ───────────────────────────────────────────────
  // MMSI is a real registry identifier, so it beats a slug of the ship name.
  if (event.mmsi) {
    const vesselId = `vessel:mmsi-${event.mmsi}`
    if (vesselId !== rootId) {
      add({
        canonicalId: vesselId,
        label: event.shipName || `MMSI ${event.mmsi}`,
        kind: 'vessel',
        lat: hasCoords(event) ? event.lat : undefined,
        lng: hasCoords(event) ? event.lng : undefined,
        domain,
        confidence: 0.95,
        aliases: event.shipName ? [event.shipName] : [],
        sourceIds: [sourceId],
        properties: { mmsi: event.mmsi },
      })
      links.push({
        fromId: rootId,
        toId: vesselId,
        type: 'transporting',
        source: sourceId,
        eventId: event.id,
        confidence: 0.95,
      })
    } else {
      // Root already is the vessel — record the registry id as an alias.
      objects[0].canonicalId = vesselId
      objects[0].aliases = event.shipName ? [event.shipName, `MMSI ${event.mmsi}`] : [`MMSI ${event.mmsi}`]
      objects[0].confidence = 0.95
      remapLinks(links, rootId, vesselId)
    }
  }

  return { objects, links }
}

/**
 * Map a batch of events, merging duplicate objects and de-duplicating links.
 * @param {object[]} events
 * @returns {{ objects: MappedObject[], links: MappedLink[] }}
 */
/**
 * @param {object[]} events
 * @param {{ filterPersistable?: boolean }} [opts]
 * @returns {{ objects: MappedObject[], links: MappedLink[] }}
 */
export function mapEventsToObjects(events, opts = {}) {
  /** @type {Map<string, MappedObject>} */
  const objectsById = new Map()
  /** @type {Map<string, MappedLink>} */
  const linksByKey = new Map()

  for (const event of events || []) {
    if (opts.filterPersistable && !shouldPersistEvent(event)) continue
    const { objects, links } = mapEventToObjects(event)

    for (const obj of objects) {
      const existing = objectsById.get(obj.canonicalId)
      if (!existing) {
        objectsById.set(obj.canonicalId, {
          ...obj,
          aliases: [...(obj.aliases || [])],
          sourceIds: [...(obj.sourceIds || [])],
        })
        continue
      }
      existing.sourceIds = [...new Set([...existing.sourceIds, ...obj.sourceIds])]
      existing.aliases = [...new Set([...existing.aliases, ...(obj.aliases || [])])]
      existing.confidence = Math.max(existing.confidence ?? 0, obj.confidence ?? 0)
      if (existing.lat == null && obj.lat != null) {
        existing.lat = obj.lat
        existing.lng = obj.lng
      }
      existing.properties = { ...(existing.properties || {}), ...(obj.properties || {}) }
    }

    for (const link of links) {
      const key = `${link.fromId}|${link.toId}|${link.type}`
      const existing = linksByKey.get(key)
      if (!existing || (link.confidence ?? 0) > (existing.confidence ?? 0)) {
        linksByKey.set(key, link)
      }
    }
  }

  return {
    objects: [...objectsById.values()],
    links: [...linksByKey.values()],
  }
}

function remapLinks(links, fromId, toId) {
  for (const link of links) {
    if (link.fromId === fromId) link.fromId = toId
    if (link.toId === fromId) link.toId = toId
  }
}

function pruneUndefined(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v
  }
  return out
}
