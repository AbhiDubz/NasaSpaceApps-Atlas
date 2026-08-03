/**
 * Neotoma Quaternary paleoecology sites.
 * Docs: https://api.neotomadb.org/api-docs/
 * Ages are years before present (YBP). Database focuses on ≤ ~5.2 Ma.
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'
import { NEOTOMA_FALLBACK_SITES } from './neotomaFallbackSites.js'

export const NEOTOMA_CITATION =
  'Neotoma Paleoecology Database — Quaternary fossil sites (last ~5.2 Ma).'

export const NEOTOMA_MAX_SUPPORTED_MA = 5.2
export const NEOTOMA_POINT_LIMIT = 160

const SITES_URL = 'https://api.neotomadb.org/v2.0/data/sites'

/** @type {Map<string, object[]>} */
const cache = new Map()
const CACHE_MAX = 12

/**
 * @param {number} ageMa
 */
export function maToYearsBp(ageMa) {
  return Math.max(0, Math.round((Number(ageMa) || 0) * 1_000_000))
}

/**
 * Age window in years BP around playhead.
 * @param {number} ageMa
 */
export function neotomaAgeWindowYears(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  const center = maToYearsBp(t)
  let half
  if (t <= 0.012) half = 2000
  else if (t <= 0.1) half = 8000
  else if (t <= 1) half = 40_000
  else half = 120_000
  const minage = Math.max(0, center - half)
  const maxage = Math.min(Math.round(NEOTOMA_MAX_SUPPORTED_MA * 1e6), center + half)
  return { minage, maxage, center }
}

/**
 * @param {number} ageMa
 */
export function quantizeNeotomaAgeMa(ageMa) {
  const t = Math.max(0, Number(ageMa) || 0)
  if (t <= 0.05) return Math.round(t * 1000) / 1000
  if (t <= 0.5) return Math.round(t * 100) / 100
  if (t <= 2) return Math.round(t * 20) / 20
  return Math.round(t * 10) / 10
}

export function isNeotomaAgeSupported(ageMa) {
  return Number(ageMa) <= NEOTOMA_MAX_SUPPORTED_MA + 1e-6
}

function memKey(ageMa) {
  return `neo:${quantizeNeotomaAgeMa(ageMa)}`
}

function idbKey(ageMa) {
  return `neotoma:sites:v1:${memKey(ageMa)}`
}

function touchCache(key, value) {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}

/**
 * @param {object} site
 * @param {number} index
 */
export function siteToPoint(site, index) {
  const geom = site?.geography || site?.geog || site?.site || site
  let lat = Number(site?.lat ?? site?.latitude ?? geom?.coordinates?.[1])
  let lng = Number(site?.long ?? site?.lng ?? site?.longitude ?? geom?.coordinates?.[0])

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && geom?.type === 'Point' && Array.isArray(geom.coordinates)) {
    lng = Number(geom.coordinates[0])
    lat = Number(geom.coordinates[1])
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const name = String(site?.sitename || site?.siteName || site?.name || `Site ${site?.siteid || index}`)
  return {
    id: `neo-${site?.siteid ?? site?.siteId ?? index}`,
    name,
    lat,
    lng,
    color: 'rgba(120, 220, 180, 0.92)',
    radius: 0.4,
    altitude: 0.012,
    __ehKind: 'neotoma',
    source: site?.__fallback ? 'fallback' : 'neotoma',
  }
}

/**
 * Filter curated fallback sites by age window (years BP).
 * @param {{ minage: number, maxage: number }} win
 */
export function fallbackSitesInWindow(win) {
  const points = []
  for (let i = 0; i < NEOTOMA_FALLBACK_SITES.length; i++) {
    const s = NEOTOMA_FALLBACK_SITES[i]
    const overlaps = s.ageOld >= win.minage && s.ageYoung <= win.maxage
    if (!overlaps) continue
    const pt = siteToPoint(
      {
        siteid: s.id,
        sitename: s.name,
        lat: s.lat,
        long: s.lng,
        __fallback: true,
      },
      i,
    )
    if (pt) points.push(pt)
    if (points.length >= NEOTOMA_POINT_LIMIT) break
  }
  return points
}

/**
 * @param {number} ageMa
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchNeotomaSites(ageMa, opts = {}) {
  const q = quantizeNeotomaAgeMa(ageMa)

  if (!isNeotomaAgeSupported(q)) {
    return {
      ok: false,
      reason: `Neotoma focuses on Quaternary sites (≤${NEOTOMA_MAX_SUPPORTED_MA} Ma).`,
      ageMa: q,
    }
  }

  const key = memKey(q)
  if (cache.has(key)) {
    return { ok: true, ageMa: q, source: 'memory', points: cache.get(key) }
  }

  const persisted = await ehCacheGet(idbKey(q))
  if (Array.isArray(persisted) && persisted.length) {
    touchCache(key, persisted)
    return { ok: true, ageMa: q, source: 'idb', points: persisted }
  }

  const win = neotomaAgeWindowYears(q)
  const url = new URL(SITES_URL)
  url.searchParams.set('minage', String(win.minage))
  url.searchParams.set('maxage', String(win.maxage))
  url.searchParams.set('limit', String(NEOTOMA_POINT_LIMIT))

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    const points = fallbackSitesInWindow(win)
    if (points.length) {
      touchCache(key, points)
      return { ok: true, ageMa: q, source: 'fallback', points }
    }
    return { ok: false, reason: err.message || 'Neotoma network error', ageMa: q }
  }

  if (!res.ok) {
    const points = fallbackSitesInWindow(win)
    if (points.length) {
      touchCache(key, points)
      return { ok: true, ageMa: q, source: 'fallback', points }
    }
    return { ok: false, reason: `Neotoma HTTP ${res.status}`, ageMa: q }
  }

  const body = await res.json()
  const rows = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []
  const points = []
  for (let i = 0; i < rows.length; i++) {
    const pt = siteToPoint(rows[i], i)
    if (pt) points.push(pt)
    if (points.length >= NEOTOMA_POINT_LIMIT) break
  }

  if (!points.length) {
    const fb = fallbackSitesInWindow(win)
    if (fb.length) {
      touchCache(key, fb)
      return { ok: true, ageMa: q, source: 'fallback', points: fb }
    }
  }

  touchCache(key, points)
  ehCacheSet(idbKey(q), points).catch(() => {})
  return { ok: true, ageMa: q, source: 'live', points }
}

export function clearNeotomaCache() {
  cache.clear()
}
