/**
 * /api/investigations — cloud persistence for investigation canvas documents.
 *
 * GET  ?workspace_id=  → load document for a workspace (caller must own it)
 * PUT  { workspace_id, document } → upsert
 *
 * Requires a signed-in Supabase user; RLS enforces ownership.
 */
import { createClient } from '@supabase/supabase-js'
import { parseInvestigation } from '../../../src/core/investigationSchema.js'

export const config = {
  maxDuration: 20,
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
    const workspaceId = new URL(req.url).searchParams.get('workspace_id')
    if (!workspaceId) return json({ ok: false, error: 'workspace_id required' }, 400)

    const { data, error } = await client
      .from('investigations')
      .select('id, workspace_id, document, revision, updated_at')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return json({ ok: false, reason: error.message }, 503)
    if (!data) return json({ ok: true, investigation: null })

    const parsed = parseInvestigation(data.document)
    if (!parsed.success) {
      return json({ ok: false, reason: 'Stored investigation failed validation' }, 500)
    }
    return json({
      ok: true,
      investigation: parsed.data,
      revision: data.revision,
      updatedAt: data.updated_at,
    })
  }

  if (req.method === 'PUT') {
    let body
    try {
      body = await req.json()
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400)
    }

    const workspaceId = body?.workspace_id
    if (!workspaceId) return json({ ok: false, error: 'workspace_id required' }, 400)

    const parsed = parseInvestigation(body.document)
    if (!parsed.success) {
      return json({ ok: false, error: parsed.error || 'Invalid investigation' }, 400)
    }

    const now = new Date().toISOString()
    const revision = parsed.data.audit?.revision || 1

    const { data, error } = await client
      .from('investigations')
      .upsert({
        workspace_id: workspaceId,
        user_id: user.id,
        document: parsed.data,
        revision,
        updated_at: now,
      }, { onConflict: 'workspace_id' })
      .select('id, revision, updated_at')
      .single()

    if (error) return json({ ok: false, reason: error.message }, 503)
    return json({ ok: true, id: data.id, revision: data.revision, updatedAt: data.updated_at })
  }

  return json({ error: 'Method not allowed' }, 405)
}
