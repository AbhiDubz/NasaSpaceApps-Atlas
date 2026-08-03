/**
 * Aggregate life points into altitude-aware density clusters for globe overview.
 */

function cellSizeDeg(altitude) {
  const a = Number(altitude) || 0
  if (a > 2) return 12
  if (a > 1.2) return 8
  if (a > 0.7) return 5
  return 3
}

/** Cool-neutral ramp by log10(count). */
export function densityColor(count, maxCount) {
  const n = Math.max(1, Number(count) || 1)
  const max = Math.max(n, Number(maxCount) || n)
  const t = Math.log10(n) / Math.log10(max + 1e-9)
  const u = Math.min(1, Math.max(0, t))
  // slate → steel → warm sand (no purple / glow)
  const r = Math.round(120 + u * 100)
  const g = Math.round(140 + u * 40)
  const b = Math.round(160 - u * 40)
  const a = 0.45 + u * 0.4
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
}

/**
 * @param {Array<{ lat: number, lng: number, name?: string, color?: string }>} points
 * @param {{ altitude?: number, maxClusters?: number }} [opts]
 * @returns {Array<{ lat: number, lng: number, count: number, name: string, color: string, altitude: number, radius: number, __ehKind: 'density' }>}
 */
export function buildDensityGrid(points, opts = {}) {
  const list = Array.isArray(points) ? points : []
  if (!list.length) return []

  const altitude = Number(opts.altitude)
  const maxClusters = Math.max(1, Number(opts.maxClusters) || 250)
  const cell = cellSizeDeg(Number.isFinite(altitude) ? altitude : 2.35)
  /** @type {Map<string, { sumLat: number, sumLng: number, count: number }>} */
  const bins = new Map()

  for (const p of list) {
    const lat = Number(p?.lat)
    const lng = Number(p?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const iLat = Math.floor((lat + 90) / cell)
    const iLng = Math.floor((lng + 180) / cell)
    const key = `${iLat}:${iLng}`
    const cur = bins.get(key)
    if (cur) {
      cur.sumLat += lat
      cur.sumLng += lng
      cur.count += 1
    } else {
      bins.set(key, { sumLat: lat, sumLng: lng, count: 1 })
    }
  }

  const clusters = Array.from(bins.values()).map((b) => ({
    lat: b.sumLat / b.count,
    lng: b.sumLng / b.count,
    count: b.count,
  }))

  clusters.sort((a, b) => b.count - a.count)
  const capped = clusters.slice(0, maxClusters)
  const maxCount = capped[0]?.count || 1

  return capped.map((c) => {
    const t = Math.log10(c.count) / Math.log10(maxCount + 1e-9)
    const radius = 0.45 + Math.min(1, t) * 1.4
    return {
      lat: c.lat,
      lng: c.lng,
      count: c.count,
      name: c.count === 1 ? '1 locality' : `${c.count} localities`,
      color: densityColor(c.count, maxCount),
      altitude: 0.02 + Math.min(1, t) * 0.03,
      radius,
      __ehKind: 'density',
    }
  })
}
