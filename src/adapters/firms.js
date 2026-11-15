/**
 * NASA FIRMS active fire detections adapter — Tier B, keyed.
 * https://firms.modaps.eosdis.nasa.gov
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth } from './shared.js'

const POLL_MS = 600_000

/** @type {import('./types.js').SourceAdapter} */
export const firmsAdapter = {
  id: 'firms',
  tier: SOURCE_TIERS.B,
  pollIntervalMs: POLL_MS,
  requiredEnv: ['FIRMS_MAP_KEY'],

  metadata() {
    return {
      label: 'NASA FIRMS Active Fires',
      module: 'environment',
      dimension: 'environment',
      tier: SOURCE_TIERS.B,
      coverage: 'global',
      authoritative: true,
      requiresKey: true,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://firms.modaps.eosdis.nasa.gov',
      apiKeyHelpUrl: 'https://firms.modaps.eosdis.nasa.gov/api/map_key/',
    }
  },

  buildPollConfig(envKeys) {
    const key = envKeys.FIRMS_MAP_KEY || envKeys.FIRMS_KEY
    if (!key) return null
    return {
      // Suomi NPP's feed stopped updating on 2026-11-02; NOAA-21 carries the same VIIRS instrument.
      url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA21_NRT/world/1`,
      format: 'text',
      pollInterval: POLL_MS,
    }
  },

  normalize(csvText, { createEventId, makeEvent }) {
    const picked = pickFirmsDetections(parseFirmsCsv(csvText))
    return picked.map((d) => makeEvent({
      id: createEventId(d.lat, d.lng, d.timeMs, 'firms', `fire-${d.lat.toFixed(2)}-${d.lng.toFixed(2)}`),
      dimension: 'environment',
      lat: d.lat,
      lng: d.lng,
      severity: firmsSeverity(d),
      corroborationSources: ['firms'],
      authoritative: true,
      ttl: 600,
      title: `Active Fire — FRP ${Math.round(d.frp)} MW`,
      detail: `Confidence: ${d.confidenceLabel}. Fire radiative power: ${d.frp.toFixed(1)} MW. Seen by satellite at ${new Date(d.timeMs).toISOString().slice(11, 16)} UTC.`,
      source: 'NASA FIRMS',
      sourceUrl: 'https://firms.modaps.eosdis.nasa.gov',
      tags: ['fire', 'wildfire'],
      timestamp: new Date(d.timeMs).toISOString(),
    }))
  },

  health: defaultHealth('FIRMS'),
}

/** Fires shown per poll: the strongest of the last few hours, then the strongest of the day. */
const FIRMS_RECENT_HOURS = 3
const FIRMS_RECENT_MAX = 40
const FIRMS_TOTAL_MAX = 80

const CONFIDENCE_LABELS = { h: 'high', n: 'nominal', l: 'low' }

/**
 * Parse a FIRMS area CSV. `acq_time` is HHMM in UTC without leading zeros
 * ("104" is 01:04). VIIRS confidence is h/n/l; MODIS is 0–100.
 * @param {string} csvText
 */
export function parseFirmsCsv(csvText) {
  if (!csvText) return []
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  const col = (name) => headers.indexOf(name)
  const latIdx = col('latitude')
  const lngIdx = col('longitude')
  if (latIdx < 0 || lngIdx < 0) return []
  const confIdx = col('confidence')
  const frpIdx = col('frp')
  const dateIdx = col('acq_date')
  const timeIdx = col('acq_time')

  const out = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const lat = parseFloat(cols[latIdx])
    const lng = parseFloat(cols[lngIdx])
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const hhmm = String(cols[timeIdx] ?? '').trim().padStart(4, '0')
    const timeMs = Date.parse(`${cols[dateIdx]}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`)
    if (!Number.isFinite(timeMs)) continue
    const rawConf = String(cols[confIdx] ?? '').trim().toLowerCase()
    const numericConf = Number(rawConf)
    const high = rawConf === 'h' || rawConf === 'high' || (Number.isFinite(numericConf) && numericConf >= 80)
    out.push({
      lat,
      lng,
      frp: parseFloat(cols[frpIdx]) || 0,
      timeMs,
      high,
      confidenceLabel: CONFIDENCE_LABELS[rawConf] || (Number.isFinite(numericConf) ? `${numericConf}%` : rawConf || 'nominal'),
    })
  }
  return out
}

/**
 * Keep a readable set from tens of thousands of daily detections: the most
 * intense fires seen in the last few hours (so the "live" view has pins),
 * topped up with the most intense of the whole day.
 */
export function pickFirmsDetections(detections) {
  if (!detections.length) return []
  const byFrp = [...detections].sort((a, b) => b.frp - a.frp)
  const newest = Math.max(...detections.map((d) => d.timeMs))
  const recentCutoff = newest - FIRMS_RECENT_HOURS * 3600_000
  const picked = byFrp.filter((d) => d.timeMs >= recentCutoff).slice(0, FIRMS_RECENT_MAX)
  const seen = new Set(picked)
  for (const d of byFrp) {
    if (picked.length >= FIRMS_TOTAL_MAX) break
    if (!seen.has(d)) picked.push(d)
  }
  return picked
}

/** 2 = notable, 3 = intense, 4 = extreme. Everything kept is already among the strongest of the day. */
export function firmsSeverity(d) {
  if (d.frp >= 300) return 4
  if (d.frp >= 100 || (d.high && d.frp >= 50)) return 3
  return 2
}
