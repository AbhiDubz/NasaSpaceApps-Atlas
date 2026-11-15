/**
 * Cache the saved Trend Detective case files as static JSON so the demo
 * does not depend on the live NASA POWER API.
 *
 *   npm run trend:demos
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPowerMonthly } from '../src/services/nasaPower/fetchPower.js'
import { analyzeTrend } from '../src/services/nasaPower/trendStats.js'
import { POWER_CREDIT } from '../src/services/nasaPower/variables.js'
import { DEMO_CACHED_VARIABLES, demoCacheUrl, demoPlaces } from '../src/services/nasaPower/demos.js'
import { isInRegion, REGION_NAME } from '../src/services/nasaPower/region.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

const dir = path.join(root, 'public/trend-demos')
const places = demoPlaces()
for (const p of places) {
  if (!isInRegion(p.lat, p.lng)) throw new Error(`${p.label} is outside ${REGION_NAME}`)
}

// Fetch everything first, so a NASA POWER outage leaves the old cache intact.
const files = []
for (const place of places) {
  const data = await fetchPowerMonthly({ lat: place.lat, lng: place.lng, vars: DEMO_CACHED_VARIABLES })
  for (const code of DEMO_CACHED_VARIABLES) {
    const result = analyzeTrend({ code, months: data.months, values: data.series[code] })
    const payload = {
      lat: data.lat,
      lng: data.lng,
      elevation: data.elevation,
      ...result,
      anomalies: result.anomalies.map((v) => round(v)),
      trendLine: result.trendLine.map((v) => round(v)),
      climatology: result.climatology.map((v) => round(v)),
      seasons: result.seasons.map((s) => ({
        ...s,
        values: s.values.map((v) => round(v)),
        trendLine: s.trendLine.map((v) => round(v)),
      })),
      credit: POWER_CREDIT,
      cached: true,
    }
    files.push([path.join(root, 'public', demoCacheUrl(place.lat, place.lng, code)), JSON.stringify(payload)])
    console.log(`${place.label} · ${code}: ${result.verdict}`)
  }
}

// Start clean so places dropped from the demo list do not linger.
await mkdir(dir, { recursive: true })
for (const f of await readdir(dir)) if (f.endsWith('.json')) await rm(path.join(dir, f))
for (const [file, body] of files) await writeFile(file, body)
