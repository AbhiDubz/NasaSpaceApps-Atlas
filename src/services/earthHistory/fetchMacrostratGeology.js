/**
 * Macrostrat stratigraphic columns overlapping a geologic age.
 * Docs: https://macrostrat.org/api/v2
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'

export const MACROSTRAT_CITATION =
  'Macrostrat (UW-Madison) — stratigraphic columns / rock record (CC-BY 4.0).'

export const MACROSTRAT_MAX_SUPPORTED_MA = 2500
export const MACROSTRAT_FEATURE_LIMIT = 180

const COLUMNS_URL = 'https://macrostrat.org/api/v2/columns'

/** @type {Map<string, object[]>} */
const cache = new Map()
const CACHE_MAX = 12

/**
 * @param {number} ageMa
 */
export function quantizeMacrostratAgeMa(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  if (t <= 66) return Math.round(t)
  if (t <= 541) return Math.round(t / 5) * 5
  return Math.round(t / 25) * 25
}

export function isMacrostratAgeSupported(ageMa) {
  return Number(ageMa) <= MACROSTRAT_MAX_SUPPORTED_MA + 1e-6
}

function memKey(ageMa) {
  return `ms:${quantizeMacrostratAgeMa(ageMa)}`
}

function idbKey(ageMa) {
  return `macrostrat:cols:v1:${memKey(ageMa)}`
}

function touchCache(key, value) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}

const LITH_COLORS = {
  sedimentary: 'rgba(196, 165, 116, 0.45)',
  igneous: 'rgba(180, 90, 90, 0.42)',
  metamorphic: 'rgba(150, 120, 170, 0.42)',
  default: 'rgba(160, 140, 100, 0.38)',
}

/**
 * @param {object} feature
 */
export function columnFeatureStyle(feature) {
  const lith = feature?.properties?.lith
  const cls = Array.isArray(lith) && lith[0]?.class ? lith[0].class : 'default'
  return {
    cap: LITH_COLORS[cls] || LITH_COLORS.default,
    stroke: 'rgba(210, 190, 140, 0.55)',
  }
}

/**
 * Normalize Macrostrat GeoJSON features for Globe.GL.
 * @param {object[]} features
 * @param {number} ageMa
 */
export function normalizeMacrostratFeatures(features, ageMa) {
  const list = Array.isArray(features) ? features : []
  return list.slice(0, MACROSTRAT_FEATURE_LIMIT).map((f, i) => {
    const props = f.properties || {}
    const style = columnFeatureStyle(f)
    return {
      ...f,
      properties: {
        ...props,
        __ehId: `ms-${props.col_id ?? i}`,
        __ehKind: 'geology',
        __ehCap: style.cap,
        __ehStroke: style.stroke,
        __ehLabel: props.col_name || `Column ${props.col_id ?? i}`,
      },
      __ehKind: 'geology',
    }
  })
}

/**
 * @param {number} ageMa
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchMacrostratGeology(ageMa, opts = {}) {
  const q = quantizeMacrostratAgeMa(ageMa)

  if (!isMacrostratAgeSupported(q)) {
    return {
      ok: false,
      reason: `Geology overlay focuses on ≤${MACROSTRAT_MAX_SUPPORTED_MA} Ma (Macrostrat rock record).`,
      ageMa: q,
    }
  }

  const key = memKey(q)
  if (cache.has(key)) {
    return { ok: true, ageMa: q, source: 'memory', features: cache.get(key) }
  }

  const persisted = await ehCacheGet(idbKey(q))
  if (Array.isArray(persisted) && persisted.length) {
    touchCache(key, persisted)
    return { ok: true, ageMa: q, source: 'idb', features: persisted }
  }

  const url = new URL(COLUMNS_URL)
  url.searchParams.set('age', String(q))
  url.searchParams.set('format', 'geojson')
  url.searchParams.set('response', 'long')

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, reason: err.message || 'Macrostrat network error', ageMa: q }
  }
  if (!res.ok) {
    return { ok: false, reason: `Macrostrat HTTP ${res.status}`, ageMa: q }
  }

  const body = await res.json()
  const collection = body?.success?.data
  if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    return { ok: false, reason: 'Macrostrat returned unexpected GeoJSON.', ageMa: q }
  }

  const features = normalizeMacrostratFeatures(collection.features, q)
  touchCache(key, features)
  ehCacheSet(idbKey(q), features).catch(() => {})
  return { ok: true, ageMa: q, source: 'live', features }
}

export function clearMacrostratCache() {
  cache.clear()
}
