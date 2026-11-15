/**
 * Trend test for an instrument variable (MODIS, AIRS, OMI, GPM, GLDAS) at a
 * point, from one prebuilt grid file. Used by the browser and by /api/trend,
 * so both give the same answer. Pure, no I/O.
 */
import { buildMonthAxis } from './fetchPower.js'
import { gridCredit, gridIndex, seriesFromChunk } from './instrumentGrids.js'
import { analyzeTrend } from './trendStats.js'

export const NO_GRID_DATA_MESSAGE = 'There is no satellite record for that spot.'

/** Which grid file holds a point, or null when the point is off the grid. */
export function gridChunkFor(code, lat, lng) {
  return gridIndex(code, lat, lng)?.chunk ?? null
}

/**
 * @param {object} chunk — parsed public/trend-grids/<CODE>_<n>.json
 * @param {{ code: string, lat: number, lng: number, season?: string }} query
 * @returns {object} the same shape /api/trend returns for NASA POWER variables
 */
export function gridTrend(chunk, { code, lat, lng, season }) {
  // Same month axis as the NASA POWER series, so every chart and test lines up.
  const months = buildMonthAxis()
  const values = seriesFromChunk(chunk, lat, lng, months)
  if (!values) throw new Error(NO_GRID_DATA_MESSAGE)
  return { lat, lng, elevation: null, ...analyzeTrend({ code, months, values, season }), credit: gridCredit(code) }
}
