/**
 * Cached NASA POWER loader shared by /api/nasa-power and /api/trend.
 * Historical monthly data never changes, so entries live for a day
 * (in-memory; resets on cold start).
 */
import { fetchPowerMonthly } from '../../src/services/nasaPower/fetchPower.js'
import { normalizeLatLng, parseVarList } from '../../src/services/nasaPower/variables.js'
import { isInRegion, OUTSIDE_REGION_MESSAGE, REGION_NAME } from '../../src/services/nasaPower/region.js'
import { jsonResponse } from './proxyCommon.js'

const TTL_MS = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 300
/** @type {Map<string, { ts: number, promise: Promise<object> }>} */
const cache = new Map()

export const POWER_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
}

/** Load one variable at a time so overlapping requests share cache entries. */
function loadVariable(lat, lng, code) {
  const key = `${lat},${lng},${code}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.promise
  const promise = fetchPowerMonthly({ lat, lng, vars: [code], signal: AbortSignal.timeout(25_000) })
  cache.set(key, { ts: Date.now(), promise })
  promise.catch(() => cache.delete(key))
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value)
  return promise
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {string[]} vars
 */
export async function loadPower(lat, lng, vars) {
  const parts = await Promise.all(vars.map((code) => loadVariable(lat, lng, code)))
  const series = {}
  for (const part of parts) Object.assign(series, part.series)
  return { lat, lng, elevation: parts[0]?.elevation ?? null, months: parts[0]?.months ?? [], series }
}

/** Parse and validate `lat` / `lng` / variable list from a request URL. Points outside Washington are refused. */
export function readPointQuery(req, varParam) {
  const url = new URL(req.url)
  const rawLat = url.searchParams.get('lat')
  const rawLng = url.searchParams.get('lng') ?? url.searchParams.get('lon')
  const point = rawLat == null || rawLng == null || rawLat === '' || rawLng === '' ? null : normalizeLatLng(rawLat, rawLng)
  if (!point) {
    return { error: jsonResponse(400, { error: 'lat (-90 to 90) and lng are required numbers' }) }
  }
  if (!isInRegion(point.lat, point.lng)) {
    return { error: jsonResponse(400, { error: OUTSIDE_REGION_MESSAGE, region: REGION_NAME }) }
  }
  return { ...point, vars: parseVarList(url.searchParams.get(varParam)), rawVar: url.searchParams.get(varParam) }
}

export function powerErrorResponse(err) {
  const upstream = Number(err?.status)
  const status = upstream === 422 || upstream === 400 ? 422 : 502
  return jsonResponse(status, {
    error: status === 422 ? 'NASA POWER has no data for that location' : 'NASA POWER is not responding right now',
    detail: String(err?.message || err),
  })
}
