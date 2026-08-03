/**
 * POST /api/ingest?source=<id>
 *
 * Server-side scheduled ingestion. Runs one source adapter end to end:
 * fetch → stage raw payload → normalize → map to objects → persist graph.
 *
 * Called by pg_cron via pg_net (see supabase/migrations/009_ingest_schedule.sql).
 * pg_net is fire-and-forget, so this route is idempotent and logs every attempt
 * to `ingest_runs` — a missed tick has to be discoverable by query.
 */
import { ADAPTERS_BY_ID, getAdapter } from '../../../src/adapters/index.js'
import { resolveUrl } from '../../../src/adapters/shared.js'
import { createEvent } from '../../../src/core/eventSchema.js'
import { mapEventsToObjects } from '../../../src/core/objectMapping.js'
import { logIngestRun, markRawProcessed, stageRawPayload } from '../rawIngestStore.js'
import { persistObjectGraph } from '../objectStore.js'
import { upsertFeedSnapshot, L2_FEED_SOURCES } from '../feedSnapshotStore.js'

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Env keys the adapters may need. Read server-side only; never returned.
 */
function collectEnvKeys() {
  const keys = {}
  for (const name of [
    'FIRMS_MAP_KEY', 'FIRMS_KEY', 'ACLED_KEY', 'ACLED_EMAIL',
    'FINNHUB_KEY', 'FRED_KEY', 'EIA_KEY',
  ]) {
    const value = process.env[name] || process.env[`VITE_${name}`]
    if (value) keys[name] = value
  }
  return keys
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json()
}

async function fetchText(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

/**
 * Adapters that proxy through same-origin `/api/*` routes need an absolute
 * origin when running outside the browser.
 */
function originFrom(req) {
  if (process.env.INGEST_BASE_URL) return process.env.INGEST_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  try {
    return new URL(req.url).origin
  } catch {
    return undefined
  }
}

function isAuthorized(req) {
  const secret = process.env.INGEST_SECRET
  // Without a configured secret the route stays closed rather than open.
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return token === secret
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!isAuthorized(req)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(req.url, 'https://atlas-osint.vercel.app')
  const sourceId = url.searchParams.get('source')
  if (!sourceId) {
    return json({ error: 'Missing ?source', available: Object.keys(ADAPTERS_BY_ID) }, 400)
  }

  const adapter = getAdapter(sourceId)
  if (!adapter) {
    return json({ error: `No adapter for "${sourceId}"`, available: Object.keys(ADAPTERS_BY_ID) }, 404)
  }

  const startedAt = Date.now()
  const pollConfig = adapter.buildPollConfig(collectEnvKeys())
  if (!pollConfig) {
    await logIngestRun({
      sourceId,
      status: 'skipped',
      durationMs: Date.now() - startedAt,
      error: `Missing env: ${(adapter.requiredEnv || []).join(', ')}`,
    })
    return json({ ok: false, skipped: true, reason: 'missing_required_env', sourceId }, 200)
  }

  const ctx = { baseUrl: originFrom(req), serverSide: true, fetchJson, fetchText }

  try {
    // ── Fetch ─────────────────────────────────────────────────────────────
    const fetchOpts = pollConfig.headers ? { headers: pollConfig.headers } : {}
    // Same-origin `/api/*` poll URLs are fine in the browser worker; undici
    // requires an absolute URL. Resolve against the deploy origin when needed.
    const fetchUrl = pollConfig.url
      ? resolveUrl(pollConfig.url, ctx.baseUrl)
      : null
    if (fetchUrl?.startsWith('/')) {
      throw new Error(
        `Relative ingest URL "${fetchUrl}" — set INGEST_BASE_URL or VERCEL_URL`,
      )
    }
    let raw
    if (adapter.fetchRaw) {
      raw = await adapter.fetchRaw(pollConfig, ctx)
    } else if (pollConfig.format === 'text') {
      raw = await fetchText(fetchUrl, fetchOpts)
    } else {
      raw = await fetchJson(fetchUrl, fetchOpts)
    }

    // ── Stage raw ─────────────────────────────────────────────────────────
    const staged = await stageRawPayload(sourceId, raw)
    if (staged.duplicate) {
      await logIngestRun({
        sourceId,
        status: 'skipped',
        durationMs: Date.now() - startedAt,
        error: 'unchanged_payload',
      })
      return json({ ok: true, sourceId, unchanged: true }, 200)
    }

    // ── Normalize ─────────────────────────────────────────────────────────
    const events = adapter.normalize(raw, { createEventId, makeEvent })
    const aggregates = adapter.aggregate?.(raw) || null

    // ── Map + persist the object graph ────────────────────────────────────
    // Retention filter: only corroboration clusters, high-severity, or
    // registry-keyed objects (vessels/assets/indicators) become durable rows.
    const graph = mapEventsToObjects(events, { filterPersistable: true })
    const persisted = await persistObjectGraph(graph)

    // Keep the browser's L2 warm cache in step with server ingestion.
    if (L2_FEED_SOURCES.has(sourceId) && events.length) {
      await upsertFeedSnapshot(
        sourceId,
        { events, aggregates: aggregates?.aggregates || null },
        events.length,
        'fresh',
      )
    }

    if (staged.id) await markRawProcessed(staged.id)

    const durationMs = Date.now() - startedAt
    await logIngestRun({
      sourceId,
      status: 'ok',
      eventCount: events.length,
      objectCount: (persisted.created || 0) + (persisted.matched || 0),
      durationMs,
    })

    return json({
      ok: true,
      sourceId,
      events: events.length,
      objects: { created: persisted.created || 0, matched: persisted.matched || 0 },
      links: persisted.links || 0,
      durationMs,
    })
  } catch (err) {
    const durationMs = Date.now() - startedAt
    await logIngestRun({
      sourceId,
      status: 'error',
      durationMs,
      error: err.message || String(err),
    })
    return json({ ok: false, sourceId, error: err.message || 'Ingest failed' }, 500)
  }
}

// ── Event factory (server mirror of the worker's) ─────────────────────────
// Adapters receive the same `createEventId` / `makeEvent` deps in both runtimes.

function createEventId(lat, lng, timestamp, source, title) {
  const raw = `${lat}|${lng}|${timestamp}|${source}|${title}`
  let hash = 0x811c9dc5
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return `${hash.toString(36)}_${timestamp.toString(36)}`
}

function makeEvent(fields) {
  const event = createEvent(fields)
  // Track/extra fields live outside the canonical schema but carry the
  // identifiers object mapping keys on (MMSI, NORAD, ICAO24).
  for (const key of [
    'trackKind', 'mmsi', 'sog', 'cog', 'shipName', 'noradId', 'satelliteGroup',
    'satellitePurpose', 'satellitePurposeLabel', 'satelliteOperator',
    'tleLine1', 'tleLine2', 'isMilitary', 'icao24', 'callsign',
    'stormId', 'stormCategory', 'trackCoords', 'coneCoords', 'priority',
  ]) {
    if (fields[key] != null) event[key] = fields[key]
  }
  return event
}
