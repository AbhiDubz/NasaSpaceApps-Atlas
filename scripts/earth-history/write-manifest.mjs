/**
 * Write public/geo/earth-history/manifest.json from milestone ages + bake metadata.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BAKE_MODEL_CITATION,
  BAKE_MODEL_ID,
  BAKE_MODEL_MAX_MA,
  MILESTONE_AGES_MA,
  PALEODEM_CITATION,
  ageSlug,
  isPaleodemAge,
  isScientificAge,
} from './ages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../../public/geo/earth-history')
const TEX = path.join(ROOT, 'textures')
const OUT = path.join(ROOT, 'manifest.json')

function textureExists(relName) {
  return fs.existsSync(path.join(TEX, relName))
}

const frames = MILESTONE_AGES_MA.map((ageMa) => {
  const s = ageSlug(ageMa)
  const paleodem = isPaleodemAge(ageMa)
  const scientific = isScientificAge(ageMa)

  /** @type {Record<string, unknown>} */
  const frame = {
    id: `ma-${s}`,
    ageMa,
    texture: `/geo/earth-history/textures/ma-${s}.png`,
    textureMobile: `/geo/earth-history/textures/ma-${s}-m.png`,
    width: 2048,
    height: 1024,
    source: paleodem
      ? 'paleodem'
      : scientific
        ? 'gws-coastlines-raster'
        : 'illustrative-precambrian',
    modelId: paleodem ? 'PaleoDEM-2018' : scientific ? BAKE_MODEL_ID : null,
  }

  if (textureExists(`ma-${s}-relief.png`)) {
    frame.relief = `/geo/earth-history/textures/ma-${s}-relief.png`
  }
  if (textureExists(`ma-${s}-relief-m.png`)) {
    frame.reliefMobile = `/geo/earth-history/textures/ma-${s}-relief-m.png`
  }

  return frame
})

const paleodemCount = frames.filter((f) => f.source === 'paleodem').length
const scientificCount = frames.filter(
  (f) => f.source === 'paleodem' || f.source === 'gws-coastlines-raster',
).length

const citationParts = [BAKE_MODEL_CITATION]
if (paleodemCount > 0) citationParts.push(PALEODEM_CITATION)

const manifest = {
  version: paleodemCount > 0 ? '1.1.0-paleodem' : '1.0.0-cao2024',
  modelId: BAKE_MODEL_ID,
  modelMaxMa: BAKE_MODEL_MAX_MA,
  modelCitation: citationParts.join(' '),
  reconstructionLabel:
    paleodemCount > 0
      ? `PaleoDEM hypsometry (≤540 Ma) + CAO2024 coastlines (≤${BAKE_MODEL_MAX_MA} Ma); Precambrian illustrative`
      : `CAO2024 plate reconstruction (≤${BAKE_MODEL_MAX_MA} Ma); Precambrian illustrative`,
  scientificFrameCount: scientificCount,
  paleodemFrameCount: paleodemCount,
  frames,
}

fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Wrote ${frames.length} frames (${paleodemCount} PaleoDEM, ${scientificCount} scientific) → ${OUT}`,
)
