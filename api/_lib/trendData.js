/**
 * Trend Detective records on the server: one monthly series, or the full
 * trend test, for any variable at any Washington point. Shared by
 * /api/trend and the Ask Atlas chat tools.
 *
 * NASA POWER variables come from the POWER API (cached in nasaPowerCache);
 * instrument variables (MODIS, AIRS, OMI, GPM, GLDAS) come from the static
 * grid files in /trend-grids, fetched from this same deployment.
 */
import { loadPower } from './nasaPowerCache.js'
import { analyzeTrend } from '../../src/services/nasaPower/trendStats.js'
import { buildMonthAxis } from '../../src/services/nasaPower/fetchPower.js'
import { isGridVariable } from '../../src/services/nasaPower/variables.js'
import { gridChunkUrl, seriesFromChunk } from '../../src/services/nasaPower/instrumentGrids.js'
import { gridChunkFor, gridTrend, NO_GRID_DATA_MESSAGE } from '../../src/services/nasaPower/instrumentTrend.js'

/** Grid files are static and never change between deploys: keep them for the life of the instance. */
const gridFiles = new Map()

/** @param {string} origin — any URL on this deployment, e.g. the incoming request's */
export function loadGridFile(origin, code, chunk) {
  const url = new URL(gridChunkUrl(code, chunk), origin).href
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

/**
 * Monthly values for one variable at one point, on the shared 1981–2025 month axis.
 * @returns {Promise<{ months: string[], values: (number|null)[], elevation: number|null }>}
 */
export async function loadSeries(origin, code, lat, lng) {
  if (isGridVariable(code)) {
    const chunk = gridChunkFor(code, lat, lng)
    if (chunk == null) throw new Error(NO_GRID_DATA_MESSAGE)
    const file = await loadGridFile(origin, code, chunk)
    const months = buildMonthAxis()
    const values = seriesFromChunk(file, lat, lng, months)
    if (!values) throw new Error(NO_GRID_DATA_MESSAGE)
    return { months, values, elevation: null }
  }
  const data = await loadPower(lat, lng, [code])
  return { months: data.months, values: data.series[code] || [], elevation: data.elevation }
}

/** The same result /api/trend returns. */
export async function loadTrend(origin, code, lat, lng, season = 'all') {
  if (isGridVariable(code)) {
    const chunk = gridChunkFor(code, lat, lng)
    if (chunk == null) throw new Error(NO_GRID_DATA_MESSAGE)
    const file = await loadGridFile(origin, code, chunk)
    return gridTrend(file, { code, lat, lng, season })
  }
  const data = await loadPower(lat, lng, [code])
  return {
    lat: data.lat,
    lng: data.lng,
    elevation: data.elevation,
    ...analyzeTrend({ code, months: data.months, values: data.series[code] || [], season }),
  }
}
