/**
 * NASA POWER monthly point fetch (no API key).
 * https://power.larc.nasa.gov/docs/services/api/temporal/monthly/
 *
 * Runs on the server (API routes) and in Node scripts. Returns clean monthly
 * series: the "month 13" yearly averages are dropped and the -999 fill value
 * becomes null.
 */
import { POWER_START_YEAR, POWER_END_YEAR, POWER_VARIABLES } from './variables.js'

const POWER_ENDPOINT = 'https://power.larc.nasa.gov/api/temporal/monthly/point'

/** Every month from Jan of the start year to Dec of the end year, as 'YYYY-MM'. */
export function buildMonthAxis(startYear = POWER_START_YEAR, endYear = POWER_END_YEAR) {
  const out = []
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}

/**
 * Convert POWER's `{ 'YYYYMM': value }` map into an array aligned to `months`.
 * @param {Record<string, number>} raw
 * @param {string[]} months
 * @param {number} fill
 */
export function cleanSeries(raw, months, fill = -999) {
  return months.map((ym) => {
    const v = raw?.[ym.replace('-', '')]
    if (typeof v !== 'number' || !Number.isFinite(v) || v === fill || v <= -990) return null
    return v
  })
}

/**
 * @param {{ lat: number, lng: number, vars: string[], signal?: AbortSignal, fetchImpl?: typeof fetch }} opts
 * @returns {Promise<{ lat: number, lng: number, elevation: number|null, months: string[], series: Record<string, (number|null)[]> }>}
 */
export async function fetchPowerMonthly({ lat, lng, vars, signal, fetchImpl = fetch }) {
  const qs = new URLSearchParams({
    parameters: vars.join(','),
    community: 'AG',
    longitude: String(lng),
    latitude: String(lat),
    start: String(POWER_START_YEAR),
    end: String(POWER_END_YEAR),
    format: 'JSON',
  })
  const res = await fetchImpl(`${POWER_ENDPOINT}?${qs}`, { signal })
  if (!res.ok) {
    const err = new Error(`NASA POWER responded ${res.status}`)
    err.status = res.status
    throw err
  }
  const body = await res.json()
  const params = body?.properties?.parameter
  if (!params) throw new Error('NASA POWER response had no data')

  const fill = Number(body?.header?.fill_value ?? -999)
  const months = buildMonthAxis()
  /** @type {Record<string, (number|null)[]>} */
  const series = {}
  for (const code of vars) {
    if (POWER_VARIABLES[code] && params[code]) series[code] = cleanSeries(params[code], months, fill)
  }
  const elevation = Number(body?.geometry?.coordinates?.[2])
  return { lat, lng, elevation: Number.isFinite(elevation) ? elevation : null, months, series }
}
