/**
 * Trend Detective study region: Washington State only.
 *
 * Shared by the API routes (which refuse points outside it) and the UI
 * (which explains why a click outside it does nothing). Pure JS so it runs
 * in the edge runtime with no dependencies.
 */
import { WASHINGTON_BBOX, WASHINGTON_OUTLINE, WASHINGTON_RINGS } from './washingtonShape.js'

export const REGION_NAME = 'Washington State'
export const REGION_BBOX = WASHINGTON_BBOX
export const REGION_CENTER = {
  lat: (WASHINGTON_BBOX.north + WASHINGTON_BBOX.south) / 2,
  lng: (WASHINGTON_BBOX.east + WASHINGTON_BBOX.west) / 2,
}
/** State border as [lng, lat] rings, for drawing on the globe and map. */
export const REGION_OUTLINE = WASHINGTON_OUTLINE
/** Border line color, shared by every renderer. */
export const REGION_OUTLINE_COLOR = 'rgba(250, 204, 21, 0.95)'
export const OUTSIDE_REGION_MESSAGE = `Trend Detective covers ${REGION_NAME} only. Pick a spot inside Washington.`

/** Ray casting: is [lng, lat] inside this ring? */
function inRing(lng, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** True when the point falls inside Washington State (inland waters included). */
export function isInRegion(lat, lng) {
  const la = Number(lat)
  const lo = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false
  const b = WASHINGTON_BBOX
  if (la < b.south || la > b.north || lo < b.west || lo > b.east) return false
  return WASHINGTON_RINGS.some((ring) => inRing(lo, la, ring))
}
