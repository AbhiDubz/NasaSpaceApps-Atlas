/**
 * Cache the saved Trend Detective case files as static JSON so the demo
 * does not depend on the live NASA POWER API.
 *
 *   npm run trend:demos
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchPowerMonthly } from '../src/services/nasaPower/fetchPower.js'
import { analyzeTrend } from '../src/services/nasaPower/trendStats.js'
import { POWER_CREDIT } from '../src/services/nasaPower/variables.js'
import { TREND_DEMOS, DEMO_CACHED_VARIABLES, demoCacheUrl } from '../src/services/nasaPower/demos.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const round = (v, d = 4) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

await mkdir(path.join(root, 'public/trend-demos'), { recursive: true })

for (const demo of TREND_DEMOS) {
  for (const place of demo.places) {
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
        credit: POWER_CREDIT,
        cached: true,
      }
      const file = path.join(root, 'public', demoCacheUrl(place.lat, place.lng, code))
      await writeFile(file, JSON.stringify(payload))
      console.log(`${place.label} · ${code}: ${result.verdict}`)
    }
  }
}
