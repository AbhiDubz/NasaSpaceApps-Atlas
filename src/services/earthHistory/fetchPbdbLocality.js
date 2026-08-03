/**
 * PBDB collection localities + occurrence detail for Earth History.
 * Docs: https://paleobiodb.org/data1.2/colls/list
 *       https://paleobiodb.org/data1.2/occs/list
 */

import {
  PBDB_CITATION,
  PBDB_MAX_SUPPORTED_MA,
  PBDB_PALEO_AGE,
  PBDB_PALEO_MODEL,
  PBDB_POINT_LIMIT,
  colorForPhylum,
  isPbdbAgeSupported,
  pbdbAgeWindow,
  quantizePbdbAgeMa,
} from './fetchPbdbLife.js'

export { PBDB_CITATION }

const COLLS_URL = 'https://paleobiodb.org/data1.2/colls/list.json'
const OCCS_URL = 'https://paleobiodb.org/data1.2/occs/list.json'
const MACROSTRAT_POINT_URL = 'https://macrostrat.org/api/v2/geologic_units/map'

function numField(rec, ...keys) {
  for (const k of keys) {
    const v = Number(rec?.[k])
    if (Number.isFinite(v)) return v
  }
  return NaN
}

function strField(rec, ...keys) {
  for (const k of keys) {
    const v = rec?.[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return ''
}

/**
 * Phylopic silhouette URL via PBDB taxa thumb (string only; no fetch).
 * @param {string|number|null|undefined} taxonOid
 */
export function fetchPhylopicThumb(taxonOid) {
  if (taxonOid == null || taxonOid === '') return ''
  const id = String(taxonOid).replace(/^txn:/i, '').trim()
  if (!id) return ''
  return `https://paleobiodb.org/data1.2/taxa/thumb.png?id=txn:${encodeURIComponent(id)}`
}

/**
 * Map a PBDB collection record into a life point (same shape as occs where possible).
 * @param {object} rec
 * @param {number} index
 */
export function collectionToLifePoint(rec, index) {
  const paleolat = numField(rec, 'paleolat', 'pla')
  const paleolng = numField(rec, 'paleolng', 'pln')
  const lat = numField(rec, 'lat')
  const lng = numField(rec, 'lng')
  const usePaleo = Number.isFinite(paleolat) && Number.isFinite(paleolng)
  const useModern = Number.isFinite(lat) && Number.isFinite(lng)
  if (!usePaleo && !useModern) return null

  const collectionNo = strField(rec, 'collection_no', 'oid', 'cid')
  const name =
    strField(rec, 'collection_name', 'nam', 'collection_aka') ||
    (collectionNo ? `Collection ${collectionNo}` : 'Locality')
  const phylum = strField(rec, 'phylum', 'phl')
  const nOccs = numField(rec, 'n_occs', 'noc')

  return {
    id: String(collectionNo || `coll-${index}`),
    lat: usePaleo ? paleolat : lat,
    lng: usePaleo ? paleolng : lng,
    modernLat: useModern ? lat : null,
    modernLng: useModern ? lng : null,
    paleoLat: usePaleo ? paleolat : null,
    paleoLng: usePaleo ? paleolng : null,
    paleo: usePaleo,
    name,
    phylum,
    className: strField(rec, 'class', 'cll'),
    collectionNo: collectionNo || null,
    taxonId: null,
    maxMa: numField(rec, 'max_ma', 'eag'),
    minMa: numField(rec, 'min_ma', 'lag'),
    nOccs: Number.isFinite(nOccs) ? nOccs : null,
    color: colorForPhylum(phylum),
    __ehKind: 'life',
  }
}

/**
 * @param {object} rec
 * @param {number} index
 */
export function mapOccurrence(rec, index) {
  const taxonOid = strField(rec, 'accepted_no', 'taxon_no', 'tid', 'oid')
  const name =
    strField(rec, 'accepted_name', 'identified_name', 'taxon_name', 'tna', 'idn') ||
    'Occurrence'
  return {
    id: String(rec.occurrence_no || rec.oid || `occ-${index}`),
    name,
    rank: strField(rec, 'accepted_rank', 'taxon_rank', 'rnk') || null,
    phylum: strField(rec, 'phylum', 'phl') || null,
    className: strField(rec, 'class', 'cll') || null,
    family: strField(rec, 'family', 'fml') || null,
    genus: strField(rec, 'genus', 'gnl') || null,
    taxonOid: taxonOid ? taxonOid.replace(/^txn:/i, '') : null,
    attribution: strField(rec, 'taxon_attr', 'att') || null,
    thumbUrl: taxonOid ? fetchPhylopicThumb(taxonOid) : '',
  }
}

/**
 * @param {number} ageMa
 * @param {{ signal?: AbortSignal, baseName?: string | null, limit?: number }} [opts]
 */
export async function fetchCollections(ageMa, opts = {}) {
  const center = quantizePbdbAgeMa(ageMa)
  const baseName = opts.baseName || null
  if (!isPbdbAgeSupported(center)) {
    return {
      ok: false,
      reason: `Life overlay focuses on ≤${PBDB_MAX_SUPPORTED_MA} Ma (sparse earlier).`,
      ageMa: center,
      points: [],
    }
  }

  const window = pbdbAgeWindow(center)
  const limit = opts.limit ?? PBDB_POINT_LIMIT
  const url = new URL(COLLS_URL)
  url.searchParams.set('min_ma', String(window.minMa))
  url.searchParams.set('max_ma', String(window.maxMa))
  url.searchParams.set('show', 'coords,paleoloc,ref')
  url.searchParams.set('pgm', PBDB_PALEO_MODEL)
  url.searchParams.set('pgs', PBDB_PALEO_AGE)
  url.searchParams.set('vocab', 'pbdb')
  url.searchParams.set('limit', String(limit))
  if (baseName) url.searchParams.set('base_name', baseName)

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, reason: err.message || 'PBDB collections network error', ageMa: center, points: [] }
  }

  if (!res.ok) {
    return { ok: false, reason: `PBDB HTTP ${res.status}`, ageMa: center, points: [] }
  }

  const data = await res.json()
  const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
  const points = []
  for (let i = 0; i < records.length && points.length < limit; i += 1) {
    const pt = collectionToLifePoint(records[i], i)
    if (pt) points.push(pt)
  }

  return { ok: true, ageMa: center, window, points, baseName }
}

/**
 * @param {string|number} collectionNo
 * @param {{ signal?: AbortSignal, limit?: number }} [opts]
 */
export async function fetchCollectionOccurrences(collectionNo, opts = {}) {
  const cid = String(collectionNo || '').trim()
  if (!cid) {
    return { ok: false, reason: 'Missing collection id', occurrences: [] }
  }

  const url = new URL(OCCS_URL)
  url.searchParams.set('coll_id', cid)
  url.searchParams.set('show', 'class,attr')
  url.searchParams.set('vocab', 'pbdb')
  url.searchParams.set('limit', String(opts.limit ?? 200))

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, reason: err.message || 'PBDB occs network error', occurrences: [] }
  }

  if (!res.ok) {
    return { ok: false, reason: `PBDB HTTP ${res.status}`, occurrences: [] }
  }

  const data = await res.json()
  const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
  const occurrences = records.map((rec, i) => mapOccurrence(rec, i))
  return { ok: true, collectionNo: cid, occurrences }
}

/**
 * Bedrock / map units at a modern lat/lng via Macrostrat.
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchMacrostratAtPoint(lat, lng, opts = {}) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    return { ok: false, reason: 'Invalid coordinates', units: [] }
  }

  const url = new URL(MACROSTRAT_POINT_URL)
  url.searchParams.set('lat', String(la))
  url.searchParams.set('lng', String(ln))

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, reason: err.message || 'Macrostrat network error', units: [] }
  }

  if (!res.ok) {
    return { ok: false, reason: `Macrostrat HTTP ${res.status}`, units: [] }
  }

  const data = await res.json()
  const raw = data?.success?.data ?? data?.data ?? data
  const list = Array.isArray(raw) ? raw : []
  const units = list
    .filter((u) => u && (u.name || u.strat_name || u.best_int_name))
    .slice(0, 6)
    .map((u) => ({
      name: u.name || u.strat_name || 'Unit',
      lith: u.lith || '',
      interval: u.best_int_name || u.t_int_name || '',
      tAge: u.t_age ?? u.t_int_age ?? null,
      bAge: u.b_age ?? u.b_int_age ?? null,
      color: u.color || '',
      descrip: u.descrip || '',
    }))

  return { ok: true, lat: la, lng: ln, units }
}
