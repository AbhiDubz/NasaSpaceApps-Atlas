/**
 * /api/annotations — object writeback (flag / note).
 *
 * GET  ?entity_id=           → caller's annotations for one object
 * GET  ?flag_status=watching → caller's flagged objects
 * POST { entity_id, note?, flag_status? } → upsert
 * DELETE ?id=                → remove one annotation
 *
 * Requires a signed-in Supabase user; RLS enforces ownership.
 */
import { createClient } from '@supabase/supabase-js'

export const config = {
  maxDuration: 15,
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization',
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function userClient(req) {
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

async function authenticate(client) {
  const { data, error } = await client.auth.getUser()
  if (error) return null
  return data?.user || null
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }

  const client = userClient(req)
  if (!client) return json({ ok: false, error: 'Unauthorized' }, 401)

  const user = await authenticate(client)
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401)

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const entityId = url.searchParams.get('entity_id')
    const flagStatus = url.searchParams.get('flag_status')

    let q = client
      .from('object_annotations')
      .select('id, entity_id, note, flag_status, created_at, updated_at, entities(id, canonical_id, label, kind, lat, lng, domain)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(200)

    if (entityId) q = q.eq('entity_id', entityId)
    if (flagStatus) q = q.eq('flag_status', flagStatus)

    const { data, error } = await q
    if (error) return json({ ok: false, reason: error.message, annotations: [] }, 503)
    return json({ ok: true, annotations: data || [] })
  }

  if (req.method === 'POST') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    const entityId = body?.entity_id
    if (!entityId) return json({ ok: false, error: 'entity_id required' }, 400)

    const flagStatus = body.flag_status ?? null
    if (flagStatus && !['watching', 'escalated', 'resolved'].includes(flagStatus)) {
      return json({ ok: false, error: 'invalid flag_status' }, 400)
    }

    const now = new Date().toISOString()

    // One annotation row per user+entity — upsert by looking up first.
    const { data: existing } = await client
      .from('object_annotations')
      .select('id')
      .eq('user_id', user.id)
      .eq('entity_id', entityId)
      .maybeSingle()

    if (existing?.id) {
      const { data, error } = await client
        .from('object_annotations')
        .update({
          note: body.note ?? null,
          flag_status: flagStatus,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('id, entity_id, note, flag_status, created_at, updated_at')
        .single()
      if (error) return json({ ok: false, reason: error.message }, 503)
      return json({ ok: true, annotation: data })
    }

    const { data, error } = await client
      .from('object_annotations')
      .insert({
        entity_id: entityId,
        user_id: user.id,
        note: body.note ?? null,
        flag_status: flagStatus,
        created_at: now,
        updated_at: now,
      })
      .select('id, entity_id, note, flag_status, created_at, updated_at')
      .single()

    if (error) return json({ ok: false, reason: error.message }, 503)
    return json({ ok: true, annotation: data })
  }

  if (req.method === 'DELETE') {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return json({ ok: false, error: 'id required' }, 400)

    const { error } = await client
      .from('object_annotations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return json({ ok: false, reason: error.message }, 503)
    return json({ ok: true })
  }

  return json({ error: 'Method not allowed' }, 405)
}
