/**
 * GET /api/nasa-power?lat=..&lng=..[&vars=T2M,SNODP]
 * Clean monthly NASA POWER series, 1981–2025 ($0, no key).
 * "Month 13" yearly averages are dropped; -999 fill values become null.
 */
import { jsonResponse, optionsResponse } from '../proxyCommon.js'
import { loadPower, powerErrorResponse, readPointQuery, POWER_CACHE_HEADERS } from '../nasaPowerCache.js'
import { POWER_CREDIT, POWER_VARIABLES } from '../../../src/services/nasaPower/variables.js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') return optionsResponse()
  if (req.method !== 'GET') return jsonResponse(405, { error: 'Method not allowed' })

  const q = readPointQuery(req, 'vars')
  if (q.error) return q.error

  try {
    const data = await loadPower(q.lat, q.lng, q.vars)
    const variables = {}
    for (const code of Object.keys(data.series)) {
      const { label, unit, theme, definition } = POWER_VARIABLES[code]
      variables[code] = { label, unit, theme, definition }
    }
    return jsonResponse(200, { ...data, variables, credit: POWER_CREDIT }, POWER_CACHE_HEADERS)
  } catch (err) {
    return powerErrorResponse(err)
  }
}
