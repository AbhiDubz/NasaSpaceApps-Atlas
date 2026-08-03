/**
 * GPlates paleocoastlines — prefers self-hosted bake, falls back to live GWS.
 * Docs: https://gwsdoc.gplates.org/reconstruction/reconstruct-coastlines/
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'

/** Deep-time default (≤1800 Ma). Prefer PALEOMAP for Phanerozoic live fetches to match PBDB pgm=scotese. */
export const GWS_MODEL_ID = 'CAO2024'
export const GWS_PALEO_MATCH_MODEL = 'PALEOMAP'
export const GWS_PALEO_MATCH_MAX_MA = 750
export const GWS_MODEL_MAX_MA = 1800
export const GWS_MODEL_CITATION =
  "Cao et al. (2024) via GPlates Web Service — Earth's tectonic evolution over 1.8 Ga. Phanerozoic live coastlines prefer PALEOMAP to match PBDB pgm=scotese."

/**
 * Choose coastline reconstruction model for an age.
 * Phanerozoic/live: PALEOMAP (matches PBDB paleocoords). Older: CAO2024.
 * @param {number} ageMa
 * @param {{ preferPaleoMatch?: boolean }} [opts]
 */
export function coastlineModelForAge(ageMa, opts = {}) {
  const t = Math.max(0, Number(ageMa) || 0)
  const preferMatch = opts.preferPaleoMatch !== false
  if (preferMatch && t <= GWS_PALEO_MATCH_MAX_MA + 1e-6) return GWS_PALEO_MATCH_MODEL
  return GWS_MODEL_ID
}

const GWS_COASTLINES_URL = 'https://gws.gplates.org/reconstruct/coastlines/'
const LOCAL_INDEX_URL = '/geo/earth-history/coastlines/index.json'

/** @type {Map<string, { type: string, features: object[] }>} */
const cache = new Map()
const CACHE_MAX = 14

/** @type {{ frames: { ageMa: number, path: string }[] } | null | undefined} */
let localIndex = undefined
/** @type {Promise<{ frames: { ageMa: number, path: string }[] } | null> | null} */
let localIndexPromise = null

/**
 * Quantize age to cut redundant GWS calls while scrubbing settles.
 * @param {number} ageMa
 */
export function quantizeCoastlineAgeMa(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  if (t <= 66) return Math.round(t * 2) / 2
  if (t <= 541) return Math.round(t / 5) * 5
  return Math.round(t / 25) * 25
}

export function isCoastlineAgeSupported(ageMa) {
  return Number(ageMa) <= GWS_MODEL_MAX_MA + 1e-6
}

/**
 * Nearest baked coastline frame to ageMa (absolute years).
 * @param {{ ageMa: number, path: string }[]} frames
 * @param {number} ageMa
 */
export function pickNearestCoastlineFrame(frames, ageMa) {
  if (!frames?.length) return null
  const t = Math.max(0, Number(ageMa) || 0)
  let best = frames[0]
  let bestDist = Math.abs(frames[0].ageMa - t)
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs(frames[i].ageMa - t)
    if (d < bestDist) {
      best = frames[i]
      bestDist = d
    }
  }
  return best
}

/**
 * Max acceptable distance (Ma) between playhead and a baked frame before falling back to GWS.
 * @param {number} ageMa
 */
export function localCoastlineMatchToleranceMa(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  if (t <= 66) return 3
  if (t <= 541) return 20
  return 80
}

function memKey(ageMa, model, source) {
  return `${source}:${model}:${quantizeCoastlineAgeMa(ageMa)}`
}

function idbKey(ageMa, model) {
  return `gws:coast:v1:${model}:${quantizeCoastlineAgeMa(ageMa)}`
}

function touchCache(key, value) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}

async function loadLocalIndex(signal) {
  if (localIndex !== undefined) return localIndex
  if (!localIndexPromise) {
    localIndexPromise = (async () => {
      try {
        const res = await fetch(LOCAL_INDEX_URL, {
          method: 'GET',
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!data?.frames?.length) return null
        return data
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        return null
      } finally {
        localIndexPromise = null
      }
    })()
  }
  localIndex = await localIndexPromise
  return localIndex
}

/**
 * @param {number} ageMa
 * @param {{ model?: string, signal?: AbortSignal, preferLive?: boolean }} [opts]
 */
async function tryLocalCoastlines(ageMa, opts = {}) {
  const index = await loadLocalIndex(opts.signal)
  if (!index?.frames?.length) return null

  const nearest = pickNearestCoastlineFrame(index.frames, ageMa)
  if (!nearest) return null
  const tol = localCoastlineMatchToleranceMa(ageMa)
  if (Math.abs(nearest.ageMa - ageMa) > tol) return null

  const model = opts.model || index.modelId || GWS_MODEL_ID
  const key = memKey(nearest.ageMa, model, 'local')
  if (cache.has(key)) {
    return {
      ok: true,
      ageMa: nearest.ageMa,
      model,
      source: 'local',
      collection: cache.get(key),
    }
  }

  const res = await fetch(nearest.path, {
    method: 'GET',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    return null
  }
  touchCache(key, data)
  return { ok: true, ageMa: nearest.ageMa, model, source: 'local', collection: data }
}

/**
 * @param {number} ageMa
 * @param {{ model?: string, signal?: AbortSignal, preferLive?: boolean }} [opts]
 */
export async function fetchPaleocoastlines(ageMa, opts = {}) {
  const q = quantizeCoastlineAgeMa(ageMa)
  // Local bake is CAO2024; for live GWS use PALEOMAP ≤750 Ma so fossils match shorelines.
  const model =
    opts.model ||
    (opts.preferLive ? coastlineModelForAge(q) : GWS_MODEL_ID)

  if (!isCoastlineAgeSupported(q)) {
    return {
      ok: false,
      reason: `Coastlines unavailable before ${GWS_MODEL_MAX_MA} Ma (${model}).`,
      ageMa: q,
    }
  }

  if (!opts.preferLive) {
    try {
      const local = await tryLocalCoastlines(q, opts)
      if (local?.ok) return local
    } catch (err) {
      if (err?.name === 'AbortError') throw err
    }
  }

  const key = memKey(q, model, 'gws')
  if (cache.has(key)) {
    return { ok: true, ageMa: q, model, source: 'gws-memory', collection: cache.get(key) }
  }

  const persisted = await ehCacheGet(idbKey(q, model))
  if (persisted?.type === 'FeatureCollection' && Array.isArray(persisted.features)) {
    touchCache(key, persisted)
    return { ok: true, ageMa: q, model, source: 'gws-idb', collection: persisted }
  }

  const url = new URL(GWS_COASTLINES_URL)
  url.searchParams.set('time', String(q))
  url.searchParams.set('model', model)

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, reason: err.message || 'GWS network error', ageMa: q }
  }
  if (!res.ok) {
    return { ok: false, reason: `GWS coastlines HTTP ${res.status}`, ageMa: q }
  }

  const data = await res.json()
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    return { ok: false, reason: 'GWS returned unexpected GeoJSON.', ageMa: q }
  }

  const collection = {
    type: 'FeatureCollection',
    features: data.features.slice(0, 400).map((f, i) => ({
      ...f,
      properties: { ...(f.properties || {}), __ehId: `${q}-${i}` },
    })),
  }
  touchCache(key, collection)
  ehCacheSet(idbKey(q, model), collection).catch(() => {})
  return { ok: true, ageMa: q, model, source: 'gws', collection }
}

export function clearPaleocoastlineCache() {
  cache.clear()
  localIndex = undefined
  localIndexPromise = null
}

/** Test helper — inject a local index without fetching. */
export function __setLocalCoastlineIndexForTests(index) {
  localIndex = index
  localIndexPromise = null
}
