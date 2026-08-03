/**
 * Paleobiology Database occurrence overlay for Earth History.
 * Docs: https://paleobiodb.org/data1.2/occs/list
 *
 * Points prefer paleocoordinates (pgm=scotese, pgs=mid) when present; else modern lat/lng.
 * pgm=scotese matches PALEOMAP / PaleoDEM-lineage reconstructions so fossils sit on
 * the same rotation model as Phanerozoic paleogeography textures.
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'

export const PBDB_CITATION =
  'Paleobiology Database (data1.2) — fossil occurrences; paleocoords via Scotese PALEOMAP (pgm=scotese) when available.'

/** Must match the paleogeography / coastline model family used for Phanerozoic. */
export const PBDB_PALEO_MODEL = 'scotese'
/** early | mid | late — which end of the collection age range to rotate. */
export const PBDB_PALEO_AGE = 'mid'

export const PBDB_MAX_SUPPORTED_MA = 540
export const PBDB_POINT_LIMIT = 500

/** @type {{ id: string, label: string, baseName: string | null }[]} */
export const LIFE_TAXON_FILTERS = Object.freeze([
  { id: 'all', label: 'All', baseName: null },
  { id: 'chordata', label: 'Chordates', baseName: 'Chordata' },
  { id: 'mollusca', label: 'Molluscs', baseName: 'Mollusca' },
  { id: 'arthropoda', label: 'Arthropods', baseName: 'Arthropoda' },
  { id: 'brachiopoda', label: 'Brachiopods', baseName: 'Brachiopoda' },
  { id: 'plantae', label: 'Plants', baseName: 'Plantae' },
  { id: 'dinosauria', label: 'Dinosaurs', baseName: 'Dinosauria' },
])

const PBDB_LIST_URL = 'https://paleobiodb.org/data1.2/occs/list.json'

/** @type {Map<string, object[]>} */
const cache = new Map()
const CACHE_MAX = 16

/**
 * Age window around playhead for PBDB query.
 * @param {number} ageMa
 * @returns {{ minMa: number, maxMa: number, centerMa: number }}
 */
export function pbdbAgeWindow(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  let half
  if (t <= 0.05) half = 0.02
  else if (t <= 2.58) half = 0.15
  else if (t <= 66) half = 1.5
  else if (t <= 252) half = 4
  else half = 8

  const minMa = Math.max(0, t - half)
  const maxMa = Math.min(PBDB_MAX_SUPPORTED_MA + 20, t + half)
  return { minMa, maxMa, centerMa: t }
}

/**
 * Quantize center age for cache keys / fewer refetches.
 * @param {number} ageMa
 */
export function quantizePbdbAgeMa(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  if (t <= 2.58) return Math.round(t * 10) / 10
  if (t <= 66) return Math.round(t)
  if (t <= 252) return Math.round(t / 2) * 2
  return Math.round(t / 5) * 5
}

export function isPbdbAgeSupported(ageMa) {
  return Number(ageMa) <= PBDB_MAX_SUPPORTED_MA + 1e-6
}

export function lifeFilterById(id) {
  return LIFE_TAXON_FILTERS.find((f) => f.id === id) || LIFE_TAXON_FILTERS[0]
}

function memKey(centerMa, baseName) {
  return `${quantizePbdbAgeMa(centerMa)}:${baseName || 'all'}`
}

function idbKey(centerMa, baseName) {
  return `pbdb:occs:v1:${memKey(centerMa, baseName)}`
}

function touchCache(key, value) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}

function numField(rec, ...keys) {
  for (const k of keys) {
    const v = Number(rec[k])
    if (Number.isFinite(v)) return v
  }
  return NaN
}

function strField(rec, ...keys) {
  for (const k of keys) {
    const v = rec[k]
    if (v != null && String(v).trim()) return String(v)
  }
  return ''
}

export function recordToLifePoint(rec, index) {
  const paleolat = numField(rec, 'paleolat', 'pla')
  const paleolng = numField(rec, 'paleolng', 'pln')
  const lat = numField(rec, 'lat')
  const lng = numField(rec, 'lng')
  const usePaleo = Number.isFinite(paleolat) && Number.isFinite(paleolng)
  const useModern = Number.isFinite(lat) && Number.isFinite(lng)
  if (!usePaleo && !useModern) return null

  const phylum = strField(rec, 'phylum', 'phl')
  const className = strField(rec, 'class', 'cll')
  const name =
    strField(rec, 'accepted_name', 'identified_name', 'taxon_name', 'tna', 'idn') || 'Occurrence'
  const collectionNo = strField(rec, 'collection_no', 'cid', 'collection_id')
  const taxonId = strField(rec, 'accepted_no', 'taxon_no', 'tid', 'oid')

  return {
    id: String(rec.occurrence_no || rec.oid || `pbdb-${index}`),
    lat: usePaleo ? paleolat : lat,
    lng: usePaleo ? paleolng : lng,
    modernLat: useModern ? lat : null,
    modernLng: useModern ? lng : null,
    paleoLat: usePaleo ? paleolat : null,
    paleoLng: usePaleo ? paleolng : null,
    paleo: usePaleo,
    name,
    phylum,
    className,
    collectionNo: collectionNo || null,
    taxonId: taxonId || null,
    maxMa: numField(rec, 'max_ma', 'eag'),
    minMa: numField(rec, 'min_ma', 'lag'),
    color: colorForPhylum(phylum),
    __ehKind: 'life',
  }
}

/** Soft palette by broad clade — labels remain the a11y cue. */
export function colorForPhylum(phylum) {
  const p = String(phylum || '').toLowerCase()
  if (p.includes('chordata')) return 'rgba(250, 204, 21, 0.9)'
  if (p.includes('mollusca')) return 'rgba(125, 211, 252, 0.88)'
  if (p.includes('arthropoda')) return 'rgba(251, 146, 60, 0.88)'
  if (p.includes('cnidaria')) return 'rgba(244, 114, 182, 0.85)'
  if (p.includes('brachiopoda')) return 'rgba(167, 139, 250, 0.88)'
  if (p.includes('echinodermata')) return 'rgba(52, 211, 153, 0.88)'
  if (p.includes('plantae') || p.includes('tracheophyta')) return 'rgba(74, 222, 128, 0.88)'
  return 'rgba(226, 232, 240, 0.75)'
}

/**
 * @param {number} ageMa
 * @param {{ signal?: AbortSignal, baseName?: string | null }} [opts]
 */
export async function fetchPbdbLife(ageMa, opts = {}) {
  const center = quantizePbdbAgeMa(ageMa)
  const baseName = opts.baseName || null
  if (!isPbdbAgeSupported(center)) {
    return {
      ok: false,
      reason: `Life overlay focuses on ≤${PBDB_MAX_SUPPORTED_MA} Ma (sparse earlier).`,
      ageMa: center,
    }
  }

  const key = memKey(center, baseName)
  if (cache.has(key)) {
    return {
      ok: true,
      ageMa: center,
      window: pbdbAgeWindow(center),
      points: cache.get(key),
      baseName,
    }
  }

  const persisted = await ehCacheGet(idbKey(center, baseName))
  if (Array.isArray(persisted) && persisted.length) {
    touchCache(key, persisted)
    return {
      ok: true,
      ageMa: center,
      window: pbdbAgeWindow(center),
      points: persisted,
      baseName,
    }
  }

  const window = pbdbAgeWindow(center)
  const url = new URL(PBDB_LIST_URL)
  url.searchParams.set('min_ma', String(window.minMa))
  url.searchParams.set('max_ma', String(window.maxMa))
  url.searchParams.set('show', 'coords,paleoloc,class,ref,coll')
  url.searchParams.set('pgm', PBDB_PALEO_MODEL)
  url.searchParams.set('pgs', PBDB_PALEO_AGE)
  url.searchParams.set('vocab', 'pbdb')
  url.searchParams.set('limit', String(opts.limit ?? PBDB_POINT_LIMIT))
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
    return { ok: false, reason: err.message || 'PBDB network error', ageMa: center }
  }
  if (!res.ok) {
    if (res.status === 400 && url.searchParams.has('limit')) {
      url.searchParams.delete('limit')
      const retry = await fetch(url.toString(), {
        method: 'GET',
        signal: opts.signal,
        headers: { Accept: 'application/json' },
      })
      if (!retry.ok) {
        return { ok: false, reason: `PBDB HTTP ${retry.status}`, ageMa: center }
      }
      res = retry
    } else {
      return { ok: false, reason: `PBDB HTTP ${res.status}`, ageMa: center }
    }
  }

  const data = await res.json()
  const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
  const points = []
  const step = Math.max(1, Math.ceil(records.length / PBDB_POINT_LIMIT))
  for (let i = 0; i < records.length && points.length < PBDB_POINT_LIMIT; i += step) {
    const pt = recordToLifePoint(records[i], i)
    if (pt) points.push(pt)
  }

  touchCache(key, points)
  ehCacheSet(idbKey(center, baseName), points).catch(() => {})
  return { ok: true, ageMa: center, window, points, baseName }
}

export function clearPbdbLifeCache() {
  cache.clear()
}
