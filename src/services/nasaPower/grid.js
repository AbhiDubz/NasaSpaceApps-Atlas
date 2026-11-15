/**
 * The NASA POWER grid cell a point's data actually comes from.
 *
 * POWER does not interpolate: a point request returns the value of the
 * source cell that contains it. Checked against the live API by finding
 * where the returned record changes.
 *
 *   MERRA-2 (temperature, rain, humidity, soil, snow): 0.5° lat × 0.625° lon,
 *     cell centers on multiples of 0.5° / 0.625° from (-90, -180).
 *     Seattle → 47.25–47.75°N, 122.8125–122.1875°W.
 *   CERES SYN1deg (surface sunlight): 1° lat, edges on whole degrees. CERES
 *     widens its cells toward the poles: 1° lon up to 45° latitude, 2° lon
 *     beyond it (all of Washington). Seattle → 47–48°N, 124–122°W.
 *   CERES SYN1deg aerosols (haze): 2° × 2°, edges on even degrees.
 *     Seattle → 46–48°N, 124–122°W. Checked across Washington only.
 */

const KM_PER_DEG_LAT = 111.32

/** @type {Record<string, { source: string, dLat: number, dLng: number | ((lat: number) => number), centered: boolean }>} */
const GRIDS = {
  merra2: { source: 'MERRA-2', dLat: 0.5, dLng: 0.625, centered: true },
  ceres: { source: 'CERES SYN1deg', dLat: 1, dLng: (lat) => (Math.abs(lat) >= 45 ? 2 : 1), centered: false },
  ceresAerosol: { source: 'CERES SYN1deg aerosol', dLat: 2, dLng: 2, centered: false },
}

/** Which grid a variable is served on. */
export function gridFor(variable) {
  if (variable === 'ALLSKY_SFC_SW_DWN') return GRIDS.ceres
  if (variable === 'AOD_55') return GRIDS.ceresAerosol
  return GRIDS.merra2
}

/** Snap a coordinate to its cell: [lower, upper] edges. */
function snap(value, origin, step, centered) {
  if (centered) {
    const center = origin + Math.round((value - origin) / step) * step
    return [center - step / 2, center + step / 2]
  }
  const lower = origin + Math.floor((value - origin) / step) * step
  return [lower, lower + step]
}

const round = (v) => Math.round(v * 1e4) / 1e4

/**
 * Bounds of the grid cell that holds (lat, lng) for this variable, plus its
 * size in km at that latitude.
 * @returns {{ north: number, south: number, east: number, west: number, source: string, dLat: number, dLng: number, kmNS: number, kmEW: number }}
 */
export function gridCell(lat, lng, variable) {
  const g = gridFor(variable)
  const [south, north] = snap(lat, -90, g.dLat, g.centered)
  const dLng = typeof g.dLng === 'function' ? g.dLng((south + north) / 2) : g.dLng
  const [west, east] = snap(lng, -180, dLng, g.centered)
  const midLat = ((south + north) / 2) * (Math.PI / 180)
  return {
    north: round(Math.min(north, 90)),
    south: round(Math.max(south, -90)),
    east: round(east),
    west: round(west),
    source: g.source,
    dLat: g.dLat,
    dLng,
    kmNS: Math.round(g.dLat * KM_PER_DEG_LAT),
    kmEW: Math.round(dLng * KM_PER_DEG_LAT * Math.cos(midLat)),
  }
}

/**
 * The cell as a closed [lng, lat] ring, with extra points along each edge so
 * it hugs the curve of the globe instead of cutting under it.
 */
export function gridCellRing(cell, stepDeg = 0.05) {
  const { north: n, south: s, east: e, west: w } = cell
  const corners = [[w, s], [e, s], [e, n], [w, n], [w, s]]
  const ring = []
  for (let i = 0; i < corners.length - 1; i++) {
    const [x0, y0] = corners[i]
    const [x1, y1] = corners[i + 1]
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / stepDeg))
    for (let k = 0; k < steps; k++) ring.push([round(x0 + ((x1 - x0) * k) / steps), round(y0 + ((y1 - y0) * k) / steps)])
  }
  ring.push(corners[corners.length - 1])
  return ring
}
