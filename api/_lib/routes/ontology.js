/**
 * /api/ontology — object graph read/write for the app.
 *
 * GET  ?kind=&domain=&since=&bbox=w,s,e,n&limit=  → persisted objects
 * POST { events: [...] }                          → map + persist a batch
 *
 * The POST side is how browser-side collection reaches the graph: events that
 * crossSourceMerge has already corroborated get written as objects and links
 * instead of dying with the tab. It requires a signed-in Supabase user; writes
 * themselves go through the service role because `entities` has no client
 * insert policy by design.
 */
import { createClient } from '@supabase/supabase-js'
import { mapEventsToObjects } from '../../../src/core/objectMapping.js'
import { persistObjectGraph } from '../objectStore.js'
import { getAdminClient } from '../rawIngestStore.js'

export const config = {
  maxDuration: 30,
}

/** Cap per request so one tab cannot queue an unbounded write. */
const MAX_EVENTS_PER_POST = 500
const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2000

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

/**
 * Verify the caller's Supabase session. Returns the user or null.
 */
async function authenticate(req) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

function parseBbox(raw) {
  if (!raw) return null
  const parts = raw.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [west, south, east, north] = parts
  return { west, south, east, north }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  const client = getAdminClient()
  if (!client) return json({ ok: false, reason: 'no_supabase_admin', objects: [] }, 503)

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
      MAX_LIMIT,
    )

    let q = client
      .from('entities')
      .select('id, canonical_id, label, kind, iso, lat, lng, domain, confidence, resolution_method, properties, first_seen_at, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(limit)

    const kind = url.searchParams.get('kind')
    if (kind) q = q.in('kind', kind.split(',').map((k) => k.trim()).filter(Boolean))

    const domain = url.searchParams.get('domain')
    if (domain) q = q.in('domain', domain.split(',').map((d) => d.trim()).filter(Boolean))

    const since = url.searchParams.get('since')
    if (since) q = q.gte('last_seen_at', since)

    if (url.searchParams.get('located') !== 'false') {
      q = q.not('lat', 'is', null)
    }

    const bbox = parseBbox(url.searchParams.get('bbox'))
    if (bbox) {
      q = q.gte('lat', bbox.south).lte('lat', bbox.north)
      // A bbox that crosses the antimeridian is two ranges, not one.
      if (bbox.west <= bbox.east) {
        q = q.gte('lng', bbox.west).lte('lng', bbox.east)
      } else {
        q = q.or(`lng.gte.${bbox.west},lng.lte.${bbox.east}`)
      }
    }

    const { data, error } = await q
    if (error) return json({ ok: false, reason: error.message, objects: [] }, 503)
    return json({ ok: true, objects: data || [], count: data?.length || 0 })
  }

  if (req.method === 'POST') {
    const user = await authenticate(req)
    if (!user) return json({ ok: false, error: 'Unauthorized' }, 401)

    let body
    try {
      body = await req.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    const events = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS_PER_POST) : []
    if (!events.length) return json({ ok: true, objects: 0, links: 0, skipped: true })

    const graph = mapEventsToObjects(events)
    const result = await persistObjectGraph(graph)
    if (!result.ok) return json({ ok: false, reason: result.reason }, 503)

    return json({
      ok: true,
      events: events.length,
      objects: { created: result.created, matched: result.matched },
      links: result.links,
    })
  }

  return json({ error: 'Method not allowed' }, 405)
}
