/**
 * Curated historical / Wikidata-inspired markers for Earth History.
 */

import {
  isHolocenePlayhead,
  presentCalendarYear,
  ybpToCalendarYear,
} from '../../earth-history/core/calendarYear.js'

const INDEX_URL = '/geo/earth-history/markers/index.json'
const CACHE_MAX = 8

/** @type {Map<string, object>} */
const mem = new Map()

/** @type {{ frames: { year: number, path: string }[] } | null | undefined} */
let indexCache = undefined
/** @type {Promise<object | null> | null} */
let indexPromise = null

const KIND_COLOR = {
  battle: 'rgba(232, 120, 90, 0.92)',
  person: 'rgba(180, 200, 255, 0.9)',
  city: 'rgba(255, 214, 140, 0.92)',
  artifact: 'rgba(180, 230, 180, 0.9)',
}

function touch(key, value) {
  if (mem.has(key)) mem.delete(key)
  mem.set(key, value)
  while (mem.size > CACHE_MAX) {
    const oldest = mem.keys().next().value
    mem.delete(oldest)
  }
}

async function loadIndex(signal) {
  if (indexCache !== undefined) return indexCache
  if (!indexPromise) {
    indexPromise = (async () => {
      try {
        const res = await fetch(INDEX_URL, {
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
        indexPromise = null
      }
    })()
  }
  indexCache = await indexPromise
  return indexCache
}

/**
 * @param {{ year: number, path: string }[]} frames
 * @param {number} year
 */
export function pickNearestMarkerFrame(frames, year) {
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

function toPoints(markers) {
  return (markers || []).map((m) => ({
    ...m,
    __ehKind: 'marker',
    altitude: 0.018,
    radius: m.kind === 'city' ? 0.38 : 0.3,
    color: KIND_COLOR[m.kind] || KIND_COLOR.city,
  }))
}

/**
 * @param {number} playheadYbp
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchHistoricalMarkers(playheadYbp, opts = {}) {
  const ybp = Math.max(0, Number(playheadYbp) || 0)
  if (!isHolocenePlayhead(ybp)) {
    return {
      ok: false,
      reason: 'Historical markers focus on the Holocene (≤12 ka).',
      ageYbp: ybp,
    }
  }

  const year = ybpToCalendarYear(ybp, presentCalendarYear())
  const memKey = `markers:${Math.round(year / 50) * 50}`
  if (mem.has(memKey)) {
    return { ...mem.get(memKey), source: 'memory' }
  }

  const index = await loadIndex(opts.signal)
  if (!index?.frames?.length) {
    return { ok: false, reason: 'Marker index missing.', ageYbp: ybp }
  }

  const frame = pickNearestMarkerFrame(index.frames, year)
  if (!frame) {
    return { ok: false, reason: 'No marker frame.', ageYbp: ybp }
  }

  const res = await fetch(frame.path, {
    method: 'GET',
    signal: opts.signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    return {
      ok: false,
      reason: `Markers HTTP ${res.status}`,
      ageYbp: ybp,
      year: frame.year,
    }
  }

  const data = await res.json()
  const points = toPoints(data.markers || data.features || [])
  const result = {
    ok: true,
    year: frame.year,
    ageYbp: ybp,
    points,
    count: points.length,
    citation: index.citation || '',
    source: 'local',
  }
  touch(memKey, result)
  return result
}

export function __resetMarkerCacheForTests() {
  mem.clear()
  indexCache = undefined
  indexPromise = null
}
