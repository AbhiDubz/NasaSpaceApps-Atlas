/**
 * GET /api/trend?lat=..&lng=..&var=T2M[&season=spring]  (Washington State points only)
 * Deseasonalized trend test for one NASA POWER variable at one point:
 * Sen's slope per decade, Mann-Kendall (Hamed-Rao) p-value, OLS cross-check.
 * The result includes a quick scan of all four seasons. With `season`
 * (winter | spring | summer | fall) the test runs on that season's yearly averages instead.
 *
 * Instrument variables (MODIS, AIRS, OMI, GPM, GLDAS) are read from the
 * prebuilt grids in /trend-grids instead of NASA POWER.
 */
import { jsonResponse, optionsResponse } from '../proxyCommon.js'
import { loadPower, powerErrorResponse, readPointQuery, POWER_CACHE_HEADERS } from '../nasaPowerCache.js'
import { analyzeTrend, SEASON_IDS } from '../../../src/services/nasaPower/trendStats.js'
import { isGridVariable, POWER_CREDIT, POWER_VARIABLES } from '../../../src/services/nasaPower/variables.js'
import { gridChunkUrl } from '../../../src/services/nasaPower/instrumentGrids.js'
import { gridChunkFor, gridTrend, NO_GRID_DATA_MESSAGE } from '../../../src/services/nasaPower/instrumentTrend.js'

export const config = { runtime: 'edge' }

/** Grid files are static and never change between deploys: keep them for the life of the instance. */
const gridFiles = new Map()

function loadGridFile(req, code, chunk) {
  const url = new URL(gridChunkUrl(code, chunk), req.url).href
  let p = gridFiles.get(url)
  if (!p) {
    p = fetch(url, { signal: AbortSignal.timeout(20_000) }).then((res) => {
      if (!res.ok) throw new Error(`Grid file responded ${res.status}`)
      return res.json()
    })
    gridFiles.set(url, p)
    p.catch(() => gridFiles.delete(url))
  }
  return p
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed' })

  const q = readPointQuery(req, 'var')
  if (q.error) return q.error

  const code = String(q.rawVar || 'T2M').trim().toUpperCase()
  if (!POWER_VARIABLES[code]) {
    return jsonResponse(400, { error: `Unknown variable "${code}"`, allowed: Object.keys(POWER_VARIABLES) })
  }

  const season = String(new URL(req.url).searchParams.get('season') || 'all').trim().toLowerCase()
  if (season !== 'all' && !SEASON_IDS.includes(season)) {
    return jsonResponse(400, { error: `Unknown season "${season}"`, allowed: ['all', ...SEASON_IDS] })
  }

  if (isGridVariable(code)) {
    const chunk = gridChunkFor(code, q.lat, q.lng)
    if (chunk == null) return jsonResponse(422, { error: NO_GRID_DATA_MESSAGE })
    try {
      const file = await loadGridFile(req, code, chunk)
      return jsonResponse(200, gridTrend(file, { code, lat: q.lat, lng: q.lng, season }), POWER_CACHE_HEADERS)
    } catch (err) {
      return jsonResponse(502, { error: 'The satellite record could not be loaded right now', detail: String(err?.message || err) })
    }
  }

  try {
    const data = await loadPower(q.lat, q.lng, [code])
    const result = analyzeTrend({ code, months: data.months, values: data.series[code] || [], season })
    return jsonResponse(
      200,
      { lat: data.lat, lng: data.lng, elevation: data.elevation, ...result, credit: POWER_CREDIT },
      POWER_CACHE_HEADERS,
    )
  } catch (err) {
    return powerErrorResponse(err)
  }
}
