/**
 * globe-core/choropleth — GDELT country-tone choropleth view-models.
 *
 * Joins the tone scale once so renderers never re-derive fill colors:
 * `{ key, geometry, fill, fillColor, stroke, name, iso, tone, count, props }`.
 * `fillColor` (`{ rgb, alpha }`) lets a renderer fade the fill by zoom.
 */
import { choroplethColorToRgba, toneToChoroplethColor } from '../services/gdelt/geoService'

export const CHOROPLETH_STROKE = 'rgba(255,255,255,0.22)'

export function buildChoroplethViewModels(rows, toneRange) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const min = toneRange?.min ?? -5
  const max = toneRange?.max ?? 5
  return rows.map((r, i) => {
    const fillColor = toneToChoroplethColor(r.tone, min, max, r.count)
    return {
      key: `gdelt-choro-${i}`,
      geometry: r.geometry,
      fill: choroplethColorToRgba(fillColor),
      fillColor,
      stroke: CHOROPLETH_STROKE,
      name: r.name,
      iso: r.iso,
      tone: r.tone,
      count: r.count,
      props: r.props,
    }
  })
}

/** Below this camera range the country fill is fully faded so close-up imagery stays sharp. */
const FILL_FADE_NEAR_M = 800_000
const FILL_FADE_FAR_M = 5_000_000

/** 0–1 fill-opacity multiplier for a camera range: full at continental views, clear up close. */
export function choroplethFillFade(cameraRangeM) {
  if (!Number.isFinite(cameraRangeM)) return 1
  const f = (cameraRangeM - FILL_FADE_NEAR_M) / (FILL_FADE_FAR_M - FILL_FADE_NEAR_M)
  return Math.max(0, Math.min(1, f))
}

/** Flatten GeoJSON Polygon / MultiPolygon geometry to an array of outer rings. */
export function geoJsonToOuterRings(geometry) {
  if (!geometry) return []
  const rings = []
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    if (geometry.coordinates[0]) rings.push(geometry.coordinates[0])
  } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    for (const poly of geometry.coordinates) {
      if (poly && poly[0]) rings.push(poly[0])
    }
  }
  return rings
    .map((ring) =>
      ring
        .filter((pair) => Array.isArray(pair) && pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
        .map(([lng, lat]) => ({ lat, lng, altitude: 0 })),
    )
    .filter((ring) => ring.length >= 3)
}
