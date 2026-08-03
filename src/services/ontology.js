/**
 * Client for the ontology plane — persisted objects, graph neighborhood,
 * annotations, and investigation documents.
 */
import { supabase } from './supabase.js'

function authHeaders() {
  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json' }
  // Session is async in supabase-js v2; callers that need auth should pass
  // the access token explicitly via `withAuth`.
  return headers
}

async function withAuth() {
  const headers = authHeaders()
  if (!supabase) return { headers, token: null }
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token || null
  if (token) headers.Authorization = `Bearer ${token}`
  return { headers, token }
}

/**
 * Load persisted objects with location for globe rendering.
 * @param {{ kind?: string, domain?: string, since?: string, bbox?: string, limit?: number }} [params]
 */
export async function fetchOntologyObjects(params = {}) {
  const qs = new URLSearchParams()
  if (params.kind) qs.set('kind', params.kind)
  if (params.domain) qs.set('domain', params.domain)
  if (params.since) qs.set('since', params.since)
  if (params.bbox) qs.set('bbox', params.bbox)
  if (params.limit) qs.set('limit', String(params.limit))
  qs.set('located', 'true')

  const res = await fetch(`/api/ontology?${qs}`)
  if (!res.ok) return { ok: false, objects: [] }
  return res.json()
}

/**
 * Persist a batch of live events into the object graph (signed-in only).
 * @param {object[]} events
 */
export async function persistEventsToOntology(events) {
  const { headers, token } = await withAuth()
  if (!token) return { ok: false, reason: 'not_signed_in' }

  const res = await fetch('/api/ontology', {
    method: 'POST',
    headers,
    body: JSON.stringify({ events }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, reason: body.error || body.reason || res.statusText }
  }
  return res.json()
}

/**
 * Entity graph neighborhood (from /api/entities).
 * @param {string} entityId
 * @param {number} [depth]
 */
export async function fetchEntityGraph(entityId, depth = 2) {
  const qs = new URLSearchParams({ id: entityId, depth: String(depth) })
  const res = await fetch(`/api/entities?${qs}`)
  if (!res.ok) return { ok: false, nodes: [], links: [] }
  return res.json()
}

/**
 * Search entities by kind / query.
 */
export async function searchEntities(params = {}) {
  const qs = new URLSearchParams()
  if (params.kind) qs.set('kind', params.kind)
  if (params.iso) qs.set('iso', params.iso)
  if (params.query) qs.set('query', params.query)
  if (params.limit) qs.set('limit', String(params.limit))
  const res = await fetch(`/api/entities?${qs}`)
  if (!res.ok) return { ok: false, entities: [] }
  return res.json()
}

/**
 * @param {string} [entityId]
 * @param {string} [flagStatus]
 */
export async function fetchAnnotations({ entityId, flagStatus } = {}) {
  const { headers, token } = await withAuth()
  if (!token) return { ok: false, annotations: [], reason: 'not_signed_in' }

  const qs = new URLSearchParams()
  if (entityId) qs.set('entity_id', entityId)
  if (flagStatus) qs.set('flag_status', flagStatus)

  const res = await fetch(`/api/annotations?${qs}`, { headers })
  if (!res.ok) return { ok: false, annotations: [] }
  return res.json()
}

/**
 * Upsert a flag/note on an object.
 * @param {{ entityId: string, note?: string | null, flagStatus?: 'watching' | 'escalated' | 'resolved' | null }} args
 */
export async function upsertAnnotation({ entityId, note, flagStatus }) {
  const { headers, token } = await withAuth()
  if (!token) return { ok: false, reason: 'not_signed_in' }

  const res = await fetch('/api/annotations', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      entity_id: entityId,
      note: note ?? null,
      flag_status: flagStatus ?? null,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, reason: body.error || body.reason || res.statusText }
  }
  return res.json()
}

/**
 * @param {string} annotationId
 */
export async function deleteAnnotation(annotationId) {
  const { headers, token } = await withAuth()
  if (!token) return { ok: false, reason: 'not_signed_in' }

  const res = await fetch(`/api/annotations?id=${encodeURIComponent(annotationId)}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) return { ok: false }
  return res.json()
}

/**
 * Convert a persisted ontology row into a globe-compatible event-like object.
 * @param {object} row
 */
export function ontologyRowToGlobeEvent(row) {
  const props = row.properties || {}
  return {
    id: props.eventId || row.canonical_id || row.id,
    title: row.label,
    detail: props.detail || '',
    dimension: row.domain || props.dimension || 'narrative',
    domain: row.domain || 'narrative',
    lat: row.lat,
    lng: row.lng,
    severity: props.severity || 2,
    source: props.sourceLabel || row.kind,
    sourceUrl: props.sourceUrl || '',
    timestamp: props.timestamp || row.last_seen_at || row.first_seen_at,
    fetchedAt: props.fetchedAt || row.last_seen_at,
    corroborationCount: props.corroborationCount || 1,
    corroborationSources: props.corroborationSources || [],
    corroborationScore: props.corroborationScore || 0,
    authoritative: props.authoritative || false,
    disputed: props.disputed || false,
    tags: props.tags || [],
    actor1: props.actor1 || '',
    actor2: props.actor2 || '',
    locationName: props.locationName || '',
    // Ontology provenance
    ontologyId: row.id,
    ontologyKind: row.kind,
    ontologyCanonicalId: row.canonical_id,
    resolutionMethod: row.resolution_method,
    confidence: row.confidence,
    persisted: true,
  }
}
