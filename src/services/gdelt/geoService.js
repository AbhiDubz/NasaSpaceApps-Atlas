/**
 * GDELT GEO 2.0 API — PointHeatmap, Country, ADM1 GeoJSON.
 * https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/
 */

import { buildGdeltUrl, fetchGdeltText, delay, GDELT_REQUEST_GAP_MS } from './gdeltHttp.js'
import { buildGdeltQueryFromDimensions, timespanFromTimeFilter } from './gdeltQueries.js'

export const GDELT_GEO_BASE = 'https://api.gdeltproject.org/api/v2/geo/geo'

/** Keep re-export so existing imports don't break. */
export { GDELT_REQUEST_GAP_MS as GDELT_GEO_REQUEST_GAP_MS, timespanFromTimeFilter as geoTimespanFromTimeFilter }

/** Build a GEO query OR-block from the active ATLAS dimensions. */
export function buildGdeltGeoQueryFromDimensions(activeDimensions) {
  return buildGdeltQueryFromDimensions(activeDimensions)
}

export async function fetchGdeltGeoJson(query, mode, { timespan = '1440min', maxpoints = 500, signal } = {}) {
  const m = String(mode || '').toLowerCase()
  const isPointMode = m.includes('point') || m.includes('heatmap')
  const url = buildGdeltUrl(GDELT_GEO_BASE, {
    query: String(query || '').trim(),
    mode,
    format: 'GeoJSON',
    timespan,
    maxpoints: isPointMode && maxpoints != null ? Number(maxpoints) : null,
  })
  const text = await fetchGdeltText(url, { signal, priority: 'interactive' })
  return JSON.parse(text)
}

function pickHeatWeight(p) {
  const candidates = [
    p.intensity, p.Intensity, p.count, p.Count, p.NumMentions,
    p.coverage, p.score, p.Score, p.value, p.Value, p.hits, p.Hits,
  ]
  for (const c of candidates) {
    const n = typeof c === 'string' ? parseFloat(String(c).replace(/,/g, '')) : Number(c)
    if (Number.isFinite(n) && n > 0) return Math.min(120, Math.max(0.25, n))
  }
  return 1
}

/** @returns {{ lat: number, lng: number, weight: number }[]} */
export function parsePointHeatmapGeoJson(geojson) {
  const feats = geojson?.features
  if (!Array.isArray(feats)) return []
  const out = []
  for (const f of feats) {
    const g = f.geometry
    const p = f.properties || {}
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) continue
    const [lng, lat] = g.coordinates
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    out.push({ lat, lng, weight: pickHeatWeight(p) })
  }
  return out
}

function pickToneAndCount(props) {
  let tone = NaN
  const toneRaw = props.tone ?? props.Tone ?? props.AvgTone ?? props.AVGTONEC ?? props.avgTone
  if (typeof toneRaw === 'string') {
    tone = parseFloat(toneRaw.split(',')[0])
  } else if (toneRaw != null) {
    tone = parseFloat(toneRaw)
  }
  const c = props.count ?? props.Count ?? props.NumArticles ?? props.Hits ?? props.mentions ?? props.Mentions
  let count = 0
  if (c != null) count = parseFloat(String(c).replace(/,/g, '')) || 0
  if (!Number.isFinite(tone)) tone = 0
  return { tone, count }
}

/**
 * @returns {Array<{ geometry: object, tone: number, count: number, name: string, iso: string, props: object }>}
 */
export function extractChoroplethRows(geojson) {
  const feats = geojson?.features
  if (!Array.isArray(feats)) return []
  const rows = []
  for (const f of feats) {
    const g = f.geometry
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue
    const props = f.properties || {}
    const { tone, count } = pickToneAndCount(props)
    const name = props.name || props.NAME || props.Name || props.country || props.Country || props.label || props.ADMIN1 || ''
    const iso = props.code || props.ISO || props.iso || props.cc || props.ISO2 || ''
    rows.push({ geometry: g, tone, count, name: String(name), iso: String(iso), props })
  }
  return rows
}

/** Countries with fewer events than this don't set the colour scale (one story ≠ a national mood). */
const TONE_RANGE_MIN_EVENTS = 3
const TONE_SCALE_FLOOR = 2
const TONE_SCALE_CEIL = 10

/**
 * Symmetric tone scale around zero: `{ min: -s, max: s }`, where `s` is the
 * 90th percentile of |tone| among countries with enough events. A plain
 * min/max let a single one-event outlier stretch the scale until every other
 * country landed on the same mid colour.
 */
export function choroplethToneRange(rows) {
  const usable = (rows || []).filter((r) => Number.isFinite(r.tone))
  if (!usable.length) return { min: -5, max: 5 }
  const solid = usable.filter((r) => (r.count || 0) >= TONE_RANGE_MIN_EVENTS)
  const mags = (solid.length >= 3 ? solid : usable).map((r) => Math.abs(r.tone)).sort((x, y) => x - y)
  const p90 = mags[Math.floor((mags.length - 1) * 0.9)]
  const scale = Math.min(TONE_SCALE_CEIL, Math.max(TONE_SCALE_FLOOR, p90))
  return { min: -scale, max: scale }
}

/** Negative coverage → warm red, positive → blue (distinguishable with red-green colour blindness). */
const TONE_NEGATIVE_RGB = [232, 78, 62]
const TONE_POSITIVE_RGB = [64, 140, 246]
const TONE_ALPHA_MIN = 0.06
const TONE_ALPHA_MAX = 0.4

/**
 * Fill colour + opacity for a country tone. Hue says which way coverage leans;
 * opacity says how strongly, so near-neutral and thinly-covered countries stay
 * almost clear and the imagery underneath is not washed out.
 * @param {number} t
 * @param {number} min
 * @param {number} max
 * @param {number} [count] events behind the average
 * @returns {{ rgb: [number, number, number], alpha: number }}
 */
export function toneToChoroplethColor(t, min, max, count = Infinity) {
  const scale = Math.max(Math.abs(min), Math.abs(max)) || 1
  const tone = Number.isFinite(t) ? t : 0
  const mag = Math.min(1, Math.abs(tone) / scale)
  const confidence = Math.min(1, 0.4 + 0.2 * Math.max(0, count))
  const alpha = (TONE_ALPHA_MIN + (TONE_ALPHA_MAX - TONE_ALPHA_MIN) * mag) * confidence
  return { rgb: tone < 0 ? TONE_NEGATIVE_RGB : TONE_POSITIVE_RGB, alpha }
}

/** @param {{ rgb: number[], alpha: number }} color @param {number} [fade] 0–1 multiplier on opacity */
export function choroplethColorToRgba(color, fade = 1) {
  const a = Math.max(0, Math.min(1, color.alpha * fade))
  return `rgba(${color.rgb[0]},${color.rgb[1]},${color.rgb[2]},${a.toFixed(3)})`
}

export function toneToChoroplethRgba(t, min, max, count) {
  return choroplethColorToRgba(toneToChoroplethColor(t, min, max, count))
}

/**
 * Sequential GEO requests (rate-friendly).
 * @param {{ query: string, timespan?: string, wantHeatmap?: boolean, wantPolygons?: boolean, adm1Near?: { lat: number, lng: number } | null, signal?: AbortSignal, maxHeatPoints?: number }} opts
 */
export async function fetchGdeltGeoOverlaySequential(opts) {
  const {
    query,
    timespan = '1440min',
    wantHeatmap = true,
    wantPolygons = true,
    adm1Near = null,
    signal,
    maxHeatPoints = 450,
  } = opts

  const result = {
    heatmapPoints: [],
    choroplethRows: [],
    errors: [],
  }

  const aborted = () => Boolean(signal?.aborted)

  if (wantHeatmap && query) {
    try {
      const j = await fetchGdeltGeoJson(query, 'PointHeatmap', { timespan, maxpoints: maxHeatPoints, signal })
      if (aborted()) return result
      result.heatmapPoints = parsePointHeatmapGeoJson(j)
    } catch (e) {
      result.errors.push(String(e?.message || e))
    }
    await delay(GDELT_REQUEST_GAP_MS)
    if (aborted()) return result
  }

  if (wantPolygons && query) {
    try {
      const mode = adm1Near ? 'ADM1' : 'Country'
      const q =
        adm1Near && Number.isFinite(adm1Near.lat) && Number.isFinite(adm1Near.lng)
          ? `(${query}) near:${adm1Near.lat.toFixed(2)},${adm1Near.lng.toFixed(2)},1200km`
          : query
      const j = await fetchGdeltGeoJson(q, mode, { timespan, maxpoints: null, signal })
      if (aborted()) return result
      result.choroplethRows = extractChoroplethRows(j)
    } catch (e) {
      result.errors.push(String(e?.message || e))
    }
  }

  return result
}
