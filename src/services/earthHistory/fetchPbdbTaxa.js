/**
 * Paleobiology Database taxon autocomplete + stratigraphic range.
 * Docs: https://paleobiodb.org/data1.2/taxa/auto
 *       https://paleobiodb.org/data1.2/taxa/single
 */

export const PBDB_TAXON_CITATION =
  'Paleobiology Database (data1.2) — taxonomic names, attribution, and first/last appearance ages.'

const AUTO_URL = 'https://paleobiodb.org/data1.2/taxa/auto.json'
const SINGLE_URL = 'https://paleobiodb.org/data1.2/taxa/single.json'
const LIST_URL = 'https://paleobiodb.org/data1.2/taxa/list.json'

/** Compact-vocab numeric ranks → labels (PBDB taxa docs). */
const RANK_BY_CODE = Object.freeze({
  2: 'subspecies',
  3: 'species',
  4: 'subgenus',
  5: 'genus',
  6: 'subtribe',
  7: 'tribe',
  8: 'subfamily',
  9: 'family',
  10: 'superfamily',
  11: 'infraorder',
  12: 'suborder',
  13: 'order',
  14: 'superorder',
  15: 'infraclass',
  16: 'subclass',
  17: 'class',
  18: 'superclass',
  19: 'subphylum',
  20: 'phylum',
  21: 'superphylum',
  22: 'subkingdom',
  23: 'kingdom',
  25: 'unranked clade',
})

function strField(rec, ...keys) {
  for (const k of keys) {
    const v = rec?.[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return ''
}

function numField(rec, ...keys) {
  for (const k of keys) {
    const v = Number(rec?.[k])
    if (Number.isFinite(v)) return v
  }
  return NaN
}

function normalizeOid(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  return s.replace(/^txn:/i, '')
}

function rankLabel(rec) {
  const named = strField(rec, 'taxon_rank', 'accepted_rank', 'rnk')
  if (named && !/^\d+$/.test(named)) return named
  const code = Number(named || rec?.rnk)
  if (Number.isFinite(code) && RANK_BY_CODE[code]) return RANK_BY_CODE[code]
  return named || ''
}

/**
 * @param {object} rec
 */
export function mapAutoRecord(rec) {
  const oid = normalizeOid(strField(rec, 'oid', 'taxon_no', 'orig_no'))
  const name = strField(rec, 'nam', 'taxon_name', 'accepted_name')
  if (!name) return null
  return {
    id: oid ? `txn:${oid}` : name,
    oid: oid || null,
    name,
    rank: rankLabel(rec),
    nOccs: numField(rec, 'noc', 'n_occs'),
    label: rankLabel(rec) ? `${name} (${rankLabel(rec)})` : name,
  }
}

/**
 * @param {object} rec
 */
export function mapTaxonInfo(rec) {
  if (!rec || typeof rec !== 'object') return null
  const oid = normalizeOid(strField(rec, 'oid', 'taxon_no', 'orig_no', 'accepted_no'))
  const name =
    strField(rec, 'accepted_name', 'taxon_name', 'nam') || 'Taxon'
  const firstMax = numField(rec, 'firstapp_max_ma', 'fea')
  const firstMin = numField(rec, 'firstapp_min_ma', 'fla')
  const lastMax = numField(rec, 'lastapp_max_ma', 'lea')
  const lastMin = numField(rec, 'lastapp_min_ma', 'lla')
  const firstMa = Number.isFinite(firstMax)
    ? firstMax
    : Number.isFinite(firstMin)
      ? firstMin
      : NaN
  const lastMa = Number.isFinite(lastMin)
    ? lastMin
    : Number.isFinite(lastMax)
      ? lastMax
      : NaN

  return {
    id: oid ? `txn:${oid}` : name,
    oid: oid || null,
    name,
    rank: rankLabel(rec),
    attribution: strField(rec, 'taxon_attr', 'att'),
    nOccs: numField(rec, 'n_occs', 'noc'),
    firstAppMaxMa: Number.isFinite(firstMax) ? firstMax : null,
    firstAppMinMa: Number.isFinite(firstMin) ? firstMin : null,
    lastAppMaxMa: Number.isFinite(lastMax) ? lastMax : null,
    lastAppMinMa: Number.isFinite(lastMin) ? lastMin : null,
    /** Oldest bound of first appearance (Ma). */
    firstMa: Number.isFinite(firstMa) ? firstMa : null,
    /** Youngest bound of last appearance (Ma). */
    lastMa: Number.isFinite(lastMa) ? lastMa : null,
    earlyInterval: strField(rec, 'early_interval', 'tei') || null,
    lateInterval: strField(rec, 'late_interval', 'tli') || null,
    isExtant: strField(rec, 'is_extant', 'ext') || null,
  }
}

/**
 * @param {string} query
 * @param {{ signal?: AbortSignal, limit?: number }} [opts]
 */
export async function searchTaxa(query, opts = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) {
    return { ok: true, query: q, suggestions: [] }
  }

  const limit = Math.min(20, Math.max(1, Number(opts.limit) || 8))
  const url = new URL(AUTO_URL)
  url.searchParams.set('name', q)
  url.searchParams.set('limit', String(limit))

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, query: q, suggestions: [], reason: err.message || 'PBDB taxa network error' }
  }

  if (!res.ok) {
    return { ok: false, query: q, suggestions: [], reason: `PBDB HTTP ${res.status}` }
  }

  let data
  try {
    data = await res.json()
  } catch (err) {
    return { ok: false, query: q, suggestions: [], reason: err.message || 'Invalid PBDB JSON' }
  }

  const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
  const suggestions = []
  for (const rec of records) {
    const mapped = mapAutoRecord(rec)
    if (mapped) suggestions.push(mapped)
  }

  return { ok: true, query: q, suggestions }
}

/**
 * @param {string} nameOrOid — taxon name or oid / txn:id
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchTaxonInfo(nameOrOid, opts = {}) {
  const raw = String(nameOrOid || '').trim()
  if (!raw) {
    return { ok: false, reason: 'Empty taxon query', info: null }
  }

  const oid = normalizeOid(raw.startsWith('txn:') || /^\d+$/.test(raw) ? raw : '')
  const looksLikeId = Boolean(oid) && (raw.startsWith('txn:') || /^\d+$/.test(raw))

  const tryUrl = (base, params) => {
    const url = new URL(base)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set('show', 'attr,app')
    url.searchParams.set('vocab', 'pbdb')
    return url
  }

  const urls = looksLikeId
    ? [
        tryUrl(SINGLE_URL, { id: `txn:${oid}` }),
        tryUrl(LIST_URL, { taxon_id: `txn:${oid}` }),
      ]
    : [
        tryUrl(SINGLE_URL, { name: raw }),
        tryUrl(LIST_URL, { name: raw }),
      ]

  let lastReason = 'Taxon not found'
  for (const url of urls) {
    let res
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        signal: opts.signal,
        headers: { Accept: 'application/json' },
      })
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      lastReason = err.message || 'PBDB taxa network error'
      continue
    }
    if (!res.ok) {
      lastReason = `PBDB HTTP ${res.status}`
      continue
    }
    let data
    try {
      data = await res.json()
    } catch (err) {
      lastReason = err.message || 'Invalid PBDB JSON'
      continue
    }
    const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
    const info = mapTaxonInfo(records[0])
    if (info) return { ok: true, info }
    lastReason = 'Empty taxon record'
  }

  return { ok: false, reason: lastReason, info: null }
}
