/**
 * Raw ingest staging + run log.
 *
 * Every scheduled fetch lands its untouched upstream payload here before
 * transformation, so transforms can be replayed and an object can be traced
 * back to the response it came from.
 */
import { createClient } from '@supabase/supabase-js'

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let adminClient = null

/** Postgres jsonb tolerates more, but keep single rows bounded. */
const MAX_RAW_BYTES = 4_000_000

export function getAdminClient() {
  if (adminClient) return adminClient
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  adminClient = createClient(url, key, { auth: { persistSession: false } })
  return adminClient
}

/**
 * FNV-1a over the serialized payload. Gives `raw_ingest` an idempotency key so
 * a pg_net retry of the same tick does not double-insert.
 * @param {unknown} payload
 * @returns {string}
 */
export function hashPayload(payload) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload ?? null)
  let hash = 0x811c9dc5
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  return `${hash.toString(36)}_${raw.length.toString(36)}`
}

/**
 * Stage a raw upstream payload.
 * @param {string} sourceId
 * @param {unknown} payload
 * @returns {Promise<{ ok: boolean, id?: string, duplicate?: boolean, reason?: string, contentHash: string }>}
 */
export async function stageRawPayload(sourceId, payload) {
  const contentHash = hashPayload(payload)
  const client = getAdminClient()
  if (!client) return { ok: false, reason: 'no_supabase_admin', contentHash }

  const serialized = JSON.stringify(payload ?? null)
  const stored = serialized.length > MAX_RAW_BYTES
    ? { truncated: true, bytes: serialized.length }
    : payload

  const { data, error } = await client
    .from('raw_ingest')
    .insert({ source_id: sourceId, payload: stored, content_hash: contentHash })
    .select('id')
    .single()

  if (error) {
    // 23505 = unique violation on (source_id, content_hash): upstream has not
    // published anything new since the last tick. Not a failure.
    if (error.code === '23505') return { ok: true, duplicate: true, contentHash }
    return { ok: false, reason: error.message, contentHash }
  }

  return { ok: true, id: data?.id, contentHash }
}

/**
 * @param {string} rawId
 * @param {string | null} [error]
 */
export async function markRawProcessed(rawId, error = null) {
  const client = getAdminClient()
  if (!client || !rawId) return
  await client
    .from('raw_ingest')
    .update({ processed_at: new Date().toISOString(), error })
    .eq('id', rawId)
}

/**
 * Record an ingest attempt. pg_net does not retry or alert on failure, so a
 * missing or failed run has to be discoverable by query.
 * @param {{ sourceId: string, status: 'ok'|'error'|'skipped', eventCount?: number, objectCount?: number, durationMs?: number, error?: string | null }} run
 */
export async function logIngestRun(run) {
  const client = getAdminClient()
  if (!client) return
  await client.from('ingest_runs').insert({
    source_id: run.sourceId,
    status: run.status,
    event_count: run.eventCount ?? 0,
    object_count: run.objectCount ?? 0,
    duration_ms: run.durationMs ?? null,
    error: run.error ?? null,
  })
}
