/**
 * Ontology persistence — resolve mapped objects to canonical rows and write
 * the link graph.
 *
 * Resolution order: exact canonical id → alias → trigram fuzzy → new.
 * Every row records how it was resolved so guesses stay distinguishable
 * from certainties.
 */
import { getAdminClient } from './rawIngestStore.js'
import { FUZZY_MATCH_THRESHOLD, resolveEntity } from '../../src/core/entityResolution.js'

const SELECT_COLUMNS = 'id, canonical_id, label, kind, iso, lat, lng, domain, confidence, resolution_method, properties'

/**
 * @param {import('../../src/core/objectMapping.js').MappedObject} obj
 */
function toRow(obj, resolutionMethod) {
  const now = new Date().toISOString()
  return {
    canonical_id: obj.canonicalId,
    label: obj.label,
    kind: obj.kind,
    iso: obj.iso || null,
    lat: obj.lat ?? null,
    lng: obj.lng ?? null,
    domain: obj.domain || null,
    properties: obj.properties || {},
    confidence: obj.confidence ?? 1.0,
    resolution_method: resolutionMethod,
    source_ids: obj.sourceIds || [],
    last_seen_at: now,
    updated_at: now,
  }
}

/**
 * Look for an existing object by alias string.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
async function findByAlias(client, label, kind) {
  const { data } = await client
    .from('entity_aliases')
    .select(`entity_id, entities!inner(${SELECT_COLUMNS})`)
    .eq('alias', label)
    .limit(5)

  if (!data?.length) return null
  const match = data.find((r) => r.entities?.kind === kind)
  return match?.entities || null
}

/**
 * Trigram similarity search via the `resolve_entity_fuzzy` SQL function
 * (migration 010). Returns null when the function is not installed yet, so an
 * un-migrated database degrades to exact + alias instead of failing.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
async function findByFuzzy(client, label, kind, threshold) {
  const { data, error } = await client.rpc('resolve_entity_fuzzy', {
    p_label: label,
    p_kind: kind,
    p_threshold: threshold,
  })
  if (error || !data?.length) return null
  return data[0]
}

/**
 * Postgres-backed lookups for the shared resolution ladder.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @returns {import('../../src/core/entityResolution.js').ResolutionLookups}
 */
function dbLookups(client) {
  return {
    async byCanonicalId(canonicalId) {
      const { data } = await client
        .from('entities')
        .select(SELECT_COLUMNS)
        .eq('canonical_id', canonicalId)
        .maybeSingle()
      return data || null
    },
    byAlias: (label, kind) => findByAlias(client, label, kind),
    byFuzzy: (label, kind, threshold) => findByFuzzy(client, label, kind, threshold),
  }
}

/**
 * Persist a mapped object graph.
 * @param {import('../../src/core/objectMapping.js').MappedObject[]} objects
 * @returns {Promise<{ ok: boolean, reason?: string, idMap: Record<string, string>, created: number, matched: number }>}
 */
export async function upsertObjects(objects) {
  const client = getAdminClient()
  if (!client) return { ok: false, reason: 'no_supabase_admin', idMap: {}, created: 0, matched: 0 }

  /** @type {Record<string, string>} */
  const idMap = {}
  const lookups = dbLookups(client)
  let created = 0
  let matched = 0

  for (const obj of objects) {
    try {
      const { match: row, method, confidence } = await resolveEntity(obj, lookups, {
        threshold: FUZZY_MATCH_THRESHOLD,
      })

      if (row) {
        matched++
        idMap[obj.canonicalId] = row.id
        // Manual resolutions are authoritative; never let an automated pass
        // overwrite a human decision.
        if (method === 'manual') {
          await client
            .from('entities')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', row.id)
        } else {
          const update = toRow(obj, method)
          delete update.canonical_id
          // Merge rather than replace so earlier sources' fields survive.
          update.properties = { ...(row.properties || {}), ...(obj.properties || {}) }
          // A fuzzy hit caps how sure we can be, regardless of what the source
          // claimed about the record it came from.
          update.confidence = Math.min(
            confidence,
            Math.max(row.confidence ?? 0, obj.confidence ?? 0),
          )
          if (update.lat == null) { delete update.lat; delete update.lng }
          if (!update.domain) delete update.domain
          await client.from('entities').update(update).eq('id', row.id)
        }
        await recordAliases(client, row.id, obj)
        continue
      }

      const { data, error } = await client
        .from('entities')
        .upsert(toRow(obj, 'new'), { onConflict: 'canonical_id' })
        .select('id')
        .single()

      if (error || !data) continue
      created++
      idMap[obj.canonicalId] = data.id
      await recordAliases(client, data.id, obj)
    } catch {
      // One bad object must not abort the batch.
    }
  }

  return { ok: true, idMap, created, matched }
}

/**
 * Record the object's own label plus any declared aliases, so the next pass can
 * resolve by alias instead of guessing again.
 */
async function recordAliases(client, entityId, obj) {
  const aliases = [...new Set([obj.label, ...(obj.aliases || [])])].filter(Boolean)
  if (!aliases.length) return
  const source = obj.sourceIds?.[0] || null
  await client
    .from('entity_aliases')
    .upsert(
      aliases.map((alias) => ({ entity_id: entityId, alias, source, is_manual: false })),
      { onConflict: 'alias,source', ignoreDuplicates: true },
    )
}

/**
 * Batch canonical_id → uuid lookup, chunked to keep the `in` list a sane size.
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} canonicalIds
 * @returns {Promise<Record<string, string>>}
 */
async function lookupIdsByCanonicalId(client, canonicalIds) {
  /** @type {Record<string, string>} */
  const out = {}
  const CHUNK = 200
  for (let i = 0; i < canonicalIds.length; i += CHUNK) {
    const chunk = canonicalIds.slice(i, i + CHUNK)
    if (!chunk.length) continue
    const { data } = await client
      .from('entities')
      .select('id, canonical_id')
      .in('canonical_id', chunk)
    for (const row of data || []) out[row.canonical_id] = row.id
  }
  return out
}

/**
 * Write link rows for a resolved object graph.
 * @param {import('../../src/core/objectMapping.js').MappedLink[]} links
 * @param {Record<string, string>} idMap — canonicalId → uuid
 */
export async function upsertObjectLinks(links, idMap) {
  const client = getAdminClient()
  if (!client) return { ok: false, reason: 'no_supabase_admin', written: 0 }

  // Corroboration edges can point at objects written by an earlier batch, so
  // resolve anything the current batch did not create before giving up on it.
  const unresolved = new Set()
  for (const link of links) {
    if (!idMap[link.fromId]) unresolved.add(link.fromId)
    if (!idMap[link.toId]) unresolved.add(link.toId)
  }
  const resolved = { ...idMap, ...(await lookupIdsByCanonicalId(client, [...unresolved])) }

  const rows = []
  for (const link of links) {
    const from = resolved[link.fromId]
    const to = resolved[link.toId]
    if (!from || !to || from === to) continue
    rows.push({
      from_entity: from,
      to_entity: to,
      link_type: link.type,
      // Empty string, not null: the uniqueness constraint counts label as part
      // of the edge identity and nulls never compare equal.
      label: link.label || '',
      source: link.source || null,
      event_id: link.eventId || null,
      confidence: link.confidence ?? 0.5,
    })
  }

  if (!rows.length) return { ok: true, written: 0 }

  const { error } = await client
    .from('entity_links')
    .upsert(rows, { onConflict: 'from_entity,to_entity,link_type,label', ignoreDuplicates: true })

  if (error) return { ok: false, reason: error.message, written: 0 }
  return { ok: true, written: rows.length }
}

/**
 * Persist a full mapped graph in one call.
 * @param {{ objects: import('../../src/core/objectMapping.js').MappedObject[], links: import('../../src/core/objectMapping.js').MappedLink[] }} graph
 */
export async function persistObjectGraph(graph) {
  const objectResult = await upsertObjects(graph.objects || [])
  if (!objectResult.ok) return { ...objectResult, links: 0 }
  const linkResult = await upsertObjectLinks(graph.links || [], objectResult.idMap)
  return {
    ok: true,
    created: objectResult.created,
    matched: objectResult.matched,
    links: linkResult.written || 0,
  }
}
