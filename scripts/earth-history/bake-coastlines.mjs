/**
 * Pre-bake GWS paleocoastline GeoJSON for offline / self-hosted CDN use.
 * Ages: CAO2024 GWS milestones (skips PaleoDEM 5 Myr texture ages).
 *
 * Usage: node scripts/earth-history/bake-coastlines.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BAKE_MODEL_CITATION,
  BAKE_MODEL_ID,
  BAKE_MODEL_MAX_MA,
  ageSlug,
  gwsBakeAges,
} from './ages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../public/geo/earth-history/coastlines')
const GWS = 'https://gws.gplates.org/reconstruct/coastlines/'
const FEATURE_CAP = 400
const DELAY_MS = 900

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchCoastlines(ageMa) {
  const url = new URL(GWS)
  url.searchParams.set('time', String(ageMa))
  url.searchParams.set('model', BAKE_MODEL_ID)

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`GWS coastlines HTTP ${res.status} @ ${ageMa} Ma`)
  }
  const data = await res.json()
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error(`Unexpected GeoJSON @ ${ageMa} Ma`)
  }
  return {
    type: 'FeatureCollection',
    features: data.features.slice(0, FEATURE_CAP).map((f, i) => ({
      ...f,
      properties: { ...(f.properties || {}), __ehId: `${ageMa}-${i}` },
    })),
  }
}

fs.mkdirSync(OUT, { recursive: true })

// Skip PaleoDEM 5 Myr ages — nearest GWS milestone coastlines cover runtime fallback.
const ages = gwsBakeAges()
const indexEntries = []

for (const ageMa of ages) {
  const slug = ageSlug(ageMa)
  const fileName = `ma-${slug}.json`
  console.log(`Fetching GWS ${BAKE_MODEL_ID} coastlines @ ${ageMa} Ma…`)
  const collection = await fetchCoastlines(ageMa)
  fs.writeFileSync(path.join(OUT, fileName), `${JSON.stringify(collection)}\n`)
  indexEntries.push({
    ageMa,
    path: `/geo/earth-history/coastlines/${fileName}`,
    featureCount: collection.features.length,
  })
  console.log(`  wrote ${fileName} (${collection.features.length} features)`)
  await sleep(DELAY_MS)
}

const index = {
  version: '1.0.0',
  modelId: BAKE_MODEL_ID,
  modelMaxMa: BAKE_MODEL_MAX_MA,
  modelCitation: BAKE_MODEL_CITATION,
  bakedAt: new Date().toISOString(),
  frames: indexEntries,
}

fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(`Wrote index (${indexEntries.length} ages) → ${OUT}`)
