/**
 * Province mosaic architecture: shared geometry + per-year attribute joins.
 * Falls back to year-slice GeoJSON via fetchHistoricalPolities when mosaic is absent.
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'
import {
  fetchHistoricalPolities,
  isPolityAgeSupported,
  pickNearestPolityFrame,
  playheadToPolityYear,
  POLITY_CITATION,
  localPolityMatchTolerance,
} from './fetchHistoricalPolities.js'

const MOSAIC_URL = '/geo/earth-history/polities/mosaic.json'
const ATTRS_BASE = '/geo/earth-history/polities/attrs'
const CACHE_MAX = 16

/** @type {object | null | undefined} */
let mosaicGeom = undefined
/** @type {Promise<object | null> | null} */
let mosaicPromise = null

/** @type {Map<string, object>} */
const attrMem = new Map()

const DIMENSIONS = ['ruler', 'religion', 'culture', 'population']

function touch(map, key, value, max = CACHE_MAX) {
  if (map.has(key)) map.delete(key)
  map.set(key, value)
  while (map.size > max) {
    const oldest = map.keys().next().value
    map.delete(oldest)
  }
}

/**
 * Stable color from string id/name.
 * @param {string} seed
 * @param {number} [alpha]
 */
export function hashColor(seed, alpha = 0.42) {
  let h = 0
  const s = String(seed || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  let hue = h % 360
  if (hue > 70 && hue < 160) hue = (hue + 120) % 360
  return `hsla(${hue}, 58%, 48%, ${alpha})`
}

function popOpacity(pop, maxPop) {
  if (!Number.isFinite(pop) || pop <= 0 || !maxPop) return 0.18
  const t = Math.min(1, Math.log10(pop + 1) / Math.log10(maxPop + 1))
  return 0.12 + t * 0.55
}

/**
 * Join mosaic geometry with year attributes for a choropleth dimension.
 * @param {GeoJSON.FeatureCollection} geometry
 * @param {object} attrs — `{ features: { id: { ruler, religion, culture, population, color, name, wiki } } }`
 *   or `{ entities, years }` form
 * @param {'ruler'|'religion'|'culture'|'population'} dimension
 */
export function joinMosaic(geometry, attrs, dimension = 'ruler') {
  const dim = DIMENSIONS.includes(dimension) ? dimension : 'ruler'
  const featureAttrs = normalizeAttrs(attrs)
  const feats = geometry?.features || []

  let maxPop = 0
  if (dim === 'population') {
    for (const a of Object.values(featureAttrs)) {
      const p = Number(a.population)
      if (Number.isFinite(p) && p > maxPop) maxPop = p
    }
  }

  const features = []
  for (const f of feats) {
    const id = String(f.id ?? f.properties?.id ?? f.properties?.name ?? '')
    const a = featureAttrs[id] || featureAttrs[f.properties?.name] || null
    if (!a && !f.properties?.name) continue

    const name = a?.name || f.properties?.name || id
    const wiki = a?.wiki || a?.wikipedia || f.properties?.wikipedia || f.properties?.wiki || ''
    let cap
    let stroke

    if (dim === 'population') {
      const pop = Number(a?.population) || 0
      const alpha = popOpacity(pop, maxPop)
      cap = `hsla(32, 62%, 48%, ${alpha.toFixed(2)})`
      stroke = `hsla(32, 70%, 62%, ${Math.min(0.9, alpha + 0.25).toFixed(2)})`
    } else {
      const key = a?.[dim] || a?.color || name
      cap = a?.color && dim === 'ruler' ? a.color : hashColor(String(key))
      stroke = f.properties?.stroke || hashColor(String(key), 0.85)
    }

    features.push({
      ...f,
      id,
      __ehKind: 'polity',
      properties: {
        ...(f.properties || {}),
        id,
        name,
        wiki,
        wikipedia: wiki,
        ruler: a?.ruler || name,
        religion: a?.religion || '',
        culture: a?.culture || '',
        population: a?.population ?? null,
        color: cap,
        __ehKind: 'polity',
        __ehCap: cap,
        __ehStroke: stroke,
        __ehDimension: dim,
      },
    })
  }

  return {
    type: 'FeatureCollection',
    features,
    labels: (geometry.labels || []).map((l) => {
      const a = featureAttrs[l.id] || featureAttrs[l.name]
      return {
        ...l,
        name: a?.name || l.name,
        color: a?.color || l.color || 'rgba(255, 236, 200, 0.92)',
      }
    }),
  }
}

/**
 * Normalize attrs to `{ [id]: { name, color, wiki, ruler, religion, culture, population } }`.
 */
export function normalizeAttrs(attrs) {
  if (!attrs) return {}
  if (attrs.features && typeof attrs.features === 'object') {
    return attrs.features
  }
  // entities + years["1000"] = { provId: [rulerId, cultureId, religionId, pop] }
  if (attrs.entities && attrs.years) {
    const yearKeys = Object.keys(attrs.years)
    const yk = yearKeys[0]
    const yearMap = attrs.years[yk] || {}
    const out = {}
    for (const [provId, row] of Object.entries(yearMap)) {
      const [rulerId, cultureId, religionId, pop] = Array.isArray(row) ? row : []
      const ruler = attrs.entities[rulerId] || {}
      const culture = attrs.entities[cultureId] || {}
      const religion = attrs.entities[religionId] || {}
      out[provId] = {
        name: ruler.name || provId,
        color: ruler.color,
        wiki: ruler.wiki,
        ruler: ruler.name || rulerId,
        culture: culture.name || cultureId,
        religion: religion.name || religionId,
        population: pop,
      }
    }
    return out
  }
  return attrs
}

async function loadMosaicGeometry(signal) {
  if (mosaicGeom !== undefined) return mosaicGeom
  if (!mosaicPromise) {
    mosaicPromise = (async () => {
      try {
        const res = await fetch(MOSAIC_URL, {
          method: 'GET',
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!data?.features?.length) return null
        return data
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        return null
      } finally {
        mosaicPromise = null
      }
    })()
  }
  mosaicGeom = await mosaicPromise
  return mosaicGeom
}

function attrsPathForYear(year) {
  if (year < 0) return `${ATTRS_BASE}/y-bce${Math.abs(year)}.json`
  return `${ATTRS_BASE}/y-${year}.json`
}

async function loadAttrs(year, frames, signal) {
  const key = `attrs:${year}`
  if (attrMem.has(key)) return attrMem.get(key)

  const idbKey = `cliopatria:mosaic-attrs:v1:${year}`
  const cached = await ehCacheGet(idbKey)
  if (cached?.features || cached?.entities) {
    touch(attrMem, key, cached)
    return cached
  }

  // Try exact path, then nearest frame year from mosaic index
  const candidates = [year]
  if (frames?.length) {
    const near = pickNearestPolityFrame(frames, year)
    if (near && near.year !== year) candidates.push(near.year)
  }

  for (const y of candidates) {
    try {
      const res = await fetch(attrsPathForYear(y), {
        method: 'GET',
        signal,
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      touch(attrMem, key, data)
      ehCacheSet(idbKey, data).catch(() => {})
      return data
    } catch (err) {
      if (err?.name === 'AbortError') throw err
    }
  }
  return null
}

/**
 * Fetch polities via mosaic join when available; else year-slice fallback.
 * @param {number} playheadYbp
 * @param {{ signal?: AbortSignal, dimension?: string }} [opts]
 */
export async function fetchPolityMosaic(playheadYbp, opts = {}) {
  const ybp = Math.max(0, Number(playheadYbp) || 0)
  if (!isPolityAgeSupported(ybp)) {
    return {
      ok: false,
      reason: 'Historical polities focus on the Holocene (≤12 ka).',
      ageYbp: ybp,
    }
  }

  const dimension = opts.dimension || 'ruler'
  const year = playheadToPolityYear(ybp)
  const geom = await loadMosaicGeometry(opts.signal)

  if (!geom) {
    return fetchHistoricalPolities(playheadYbp, opts)
  }

  const frames = geom.properties?.frames || geom.frames || []
  const attrs = await loadAttrs(year, frames, opts.signal)
  if (!attrs) {
    // Mosaic exists but no attrs — fall back to year-slice GeoJSON
    return fetchHistoricalPolities(playheadYbp, opts)
  }

  // Tolerance check against mosaic year list if present
  if (frames.length) {
    const near = pickNearestPolityFrame(frames, year)
    if (near && Math.abs(near.year - year) > localPolityMatchTolerance(year)) {
      return fetchHistoricalPolities(playheadYbp, opts)
    }
  }

  const joined = joinMosaic(geom, attrs, dimension)
  return {
    ok: true,
    year,
    ageYbp: ybp,
    features: joined.features,
    labels: joined.labels || [],
    count: joined.features.length,
    citation: geom.properties?.citation || POLITY_CITATION,
    source: 'mosaic',
    dimension,
  }
}

export function __resetMosaicCacheForTests() {
  mosaicGeom = undefined
  mosaicPromise = null
  attrMem.clear()
}

export { DIMENSIONS as POLITY_DIMENSIONS }
