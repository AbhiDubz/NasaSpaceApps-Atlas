/**
 * POST /api/seed-ontology
 *
 * Loads the reference objects entity resolution needs to do its job: ISO
 * countries with every code and name variant, CAMEO actor codes, and the
 * ticker symbols ATLAS's own adapters emit.
 *
 * Idempotent — re-running only refreshes `last_seen_at`. Uses the same bearer
 * token as /api/ingest.
 */
import { buildAllSeeds } from '../../../src/core/aliasSeeds.js'
import { upsertObjects } from '../objectStore.js'

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

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = process.env.INGEST_SECRET
  if (!secret) return json({ error: 'Unauthorized' }, 401)
  const header = req.headers.get('authorization') || ''
  if (header !== `Bearer ${secret}`) return json({ error: 'Unauthorized' }, 401)

  const startedAt = Date.now()
  const seeds = buildAllSeeds()
  const result = await upsertObjects(seeds)

  if (!result.ok) return json({ ok: false, reason: result.reason }, 503)

  return json({
    ok: true,
    seeds: seeds.length,
    created: result.created,
    matched: result.matched,
    durationMs: Date.now() - startedAt,
  })
}
