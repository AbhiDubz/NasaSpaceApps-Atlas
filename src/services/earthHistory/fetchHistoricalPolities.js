/**
 * Historical polity polygons (Cliopatria bake) for Earth History Holocene Civ layer.
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'
import {
  calendarYearToYbp,
  isHolocenePlayhead,
  presentCalendarYear,
  ybpToCalendarYear,
} from '../../earth-history/core/calendarYear.js'

export const POLITY_CITATION =
  'Cliopatria (Seshat Global History Databank) — CC BY 4.0. Approximate historical extents.'

const LOCAL_INDEX_URL = '/geo/earth-history/polities/index.json'
const CACHE_MAX = 12

/** @type {Map<string, object>} */
const mem = new Map()

/** @type {{ frames: { year: number, path: string }[], citation?: string } | null | undefined} */
let localIndex = undefined
/** @type {Promise<object | null> | null} */
let localIndexPromise = null

/**
 * Quantize calendar year for polity fetches.
 * @param {number} year
 */
export function quantizePolityYear(year) {
  const y = Math.round(Number(year))
  if (!Number.isFinite(y)) return 1000
  if (y >= 800 && y <= 1300) return Math.round(y / 25) * 25
  if (y >= 0 && y <= 2000) return Math.round(y / 50) * 50
  return Math.round(y / 100) * 100
}

export function isPolityAgeSupported(ybp) {
  return isHolocenePlayhead(ybp)
}

/**
 * @param {{ year: number, path: string }[]} frames
 * @param {number} year
 */
export function pickNearestPolityFrame(frames, year) {
  if (!frames?.length) return null
  const t = Number(year)
  let best = frames[0]
  let bestDist = Math.abs(frames[0].year - t)
  for (let i = 1; i < frames.length; i++) {
    const d = Math.abs(frames[i].year - t)
    if (d < bestDist) {
      best = frames[i]
      bestDist = d
    }
  }
  return best
}

export function localPolityMatchTolerance(year) {
  const y = Number(year)
  if (y >= 800 && y <= 1300) return 30
  if (y >= 0 && y <= 2000) return 60
  return 120
}

function touch(key, value) {
  if (mem.has(key)) mem.delete(key)
  mem.set(key, value)
  while (mem.size > CACHE_MAX) {
    const oldest = mem.keys().next().value
    mem.delete(oldest)
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
 * Playhead YBP → calendar year for polity lookup.
 * @param {number} playheadYbp
 */
export function playheadToPolityYear(playheadYbp) {
  return quantizePolityYear(ybpToCalendarYear(playheadYbp, presentCalendarYear()))
}

/**
 * @param {number} playheadYbp
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchHistoricalPolities(playheadYbp, opts = {}) {
  const ybp = Math.max(0, Number(playheadYbp) || 0)
  if (!isPolityAgeSupported(ybp)) {
    return {
      ok: false,
      reason: 'Historical polities focus on the Holocene (≤12 ka).',
      ageYbp: ybp,
    }
  }

  const year = playheadToPolityYear(ybp)
  const memKey = `polity:${year}`
  if (mem.has(memKey)) {
    return { ...mem.get(memKey), source: 'memory' }
  }

  const idbKey = `cliopatria:polity:v1:${year}`
  const cached = await ehCacheGet(idbKey)
  if (cached?.features) {
    const result = {
      ok: true,
      year: cached.year ?? year,
      ageYbp: ybp,
      features: cached.features,
      labels: cached.labels || [],
      count: cached.features.length,
      citation: cached.citation || POLITY_CITATION,
      source: 'idb',
    }
    touch(memKey, result)
    return result
  }

  const index = await loadLocalIndex(opts.signal)
  if (!index?.frames?.length) {
    return {
      ok: false,
      reason: 'Polity bake missing. Run npm run earth-history:bake-polities.',
      ageYbp: ybp,
      year,
    }
  }

  const frame = pickNearestPolityFrame(index.frames, year)
  if (!frame) {
    return { ok: false, reason: 'No polity frame for year.', ageYbp: ybp, year }
  }
  const dist = Math.abs(frame.year - year)
  if (dist > localPolityMatchTolerance(year)) {
    return {
      ok: false,
      reason: `No polity slice within tolerance of ${year} (nearest ${frame.year}).`,
      ageYbp: ybp,
      year,
    }
  }

  const res = await fetch(frame.path, {
    method: 'GET',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    return {
      ok: false,
      reason: `Polity slice HTTP ${res.status}`,
      ageYbp: ybp,
      year: frame.year,
    }
  }

  const collection = await res.json()
  const features = (collection.features || []).map((f) => ({
    ...f,
    __ehKind: 'polity',
    properties: {
      ...(f.properties || {}),
      __ehKind: 'polity',
      __ehCap: f.properties?.color || 'rgba(200, 140, 80, 0.4)',
      __ehStroke: f.properties?.stroke || 'rgba(255, 220, 160, 0.75)',
    },
  }))
  const labels = collection.labels || []
  const citation = collection.properties?.citation || index.citation || POLITY_CITATION

  const result = {
    ok: true,
    year: frame.year,
    ageYbp: ybp,
    features,
    labels,
    count: features.length,
    citation,
    source: 'local',
  }

  touch(memKey, result)
  ehCacheSet(idbKey, {
    year: frame.year,
    features,
    labels,
    citation,
  }).catch(() => {})

  return result
}

/** Test helper — clear module caches. */
export function __resetPolityCacheForTests() {
  mem.clear()
  localIndex = undefined
  localIndexPromise = null
}

export { calendarYearToYbp }
