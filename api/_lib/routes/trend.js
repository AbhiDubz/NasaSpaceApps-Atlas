/**
 * GET /api/trend?lat=..&lng=..&var=T2M[&season=spring]  (Washington State points only)
 * Deseasonalized trend test for one NASA POWER variable at one point:
 * Sen's slope per decade, Mann-Kendall (Hamed-Rao) p-value, OLS cross-check.
 * The result includes a quick scan of all four seasons. With `season`
 * (winter | spring | summer | fall) the test runs on that season's yearly averages instead.
 */
import { jsonResponse, optionsResponse } from '../proxyCommon.js'
import { loadPower, powerErrorResponse, readPointQuery, POWER_CACHE_HEADERS } from '../nasaPowerCache.js'
import { analyzeTrend, SEASON_IDS } from '../../../src/services/nasaPower/trendStats.js'
import { POWER_CREDIT, POWER_VARIABLES } from '../../../src/services/nasaPower/variables.js'

export const config = { runtime: 'edge' }

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
