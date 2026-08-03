/**
 * Upsample existing Earth History textures to 2048×1024 / 1024×512 with
 * bilinear filtering + latitude shading. Use when GWS re-bake is flaky.
 *
 * Usage: node scripts/earth-history/upsample-textures.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { MILESTONE_AGES_MA, ageSlug } from './ages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../public/geo/earth-history/textures')
const DESKTOP = { w: 2048, h: 1024 }
const MOBILE = { w: 1024, h: 512 }

function sampleBilinear(src, fx, fy) {
  const w = src.width
  const h = src.height
  const x0 = Math.floor(fx)
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)))
  const x1 = x0 + 1
  const y1 = Math.max(0, Math.min(h - 1, y0 + 1))
  const tx = fx - x0
  const ty = fy - y0
  const wrapX = (x) => ((x % w) + w) % w
  const px = (x, y) => {
    const i = (w * y + wrapX(x)) << 2
    return [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]
  }
  const c00 = px(x0, y0)
  const c10 = px(x1, y0)
  const c01 = px(x0, y1)
  const c11 = px(x1, y1)
  const out = [0, 0, 0, 255]
  for (let k = 0; k < 3; k++) {
    const a = c00[k] * (1 - tx) + c10[k] * tx
    const b = c01[k] * (1 - tx) + c11[k] * tx
    out[k] = a * (1 - ty) + b * ty
  }
  return out
}

function resizeShaded(src, tw, th) {
  const out = new PNG({ width: tw, height: th })
  for (let y = 0; y < th; y++) {
    const latShade = Math.abs(y / (th - 1) - 0.5) * 2
    const shadeMul = 1 - latShade * 0.12
    for (let x = 0; x < tw; x++) {
      const fx = (x / tw) * src.width
      const fy = (y / th) * src.height
      const [r, g, b] = sampleBilinear(src, fx, fy)
      const di = (tw * y + x) << 2
      out.data[di] = Math.max(0, Math.min(255, Math.round(r * shadeMul)))
      out.data[di + 1] = Math.max(0, Math.min(255, Math.round(g * shadeMul)))
      out.data[di + 2] = Math.max(0, Math.min(255, Math.round(b * (0.98 + (1 - latShade) * 0.04))))
      out.data[di + 3] = 255
    }
  }
  return out
}

function writePng(filePath, png) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath)
    png.pack().pipe(stream).on('finish', resolve).on('error', reject)
  })
}

async function upsampleOne(ageMa) {
  const slug = ageSlug(ageMa)
  const deskPath = path.join(OUT, `ma-${slug}.png`)
  const mobPath = path.join(OUT, `ma-${slug}-m.png`)
  if (!fs.existsSync(deskPath)) {
    console.warn(`  skip missing ${deskPath}`)
    return
  }
  const src = PNG.sync.read(fs.readFileSync(deskPath))
  // Prefer highest available source (may already be 2048 from partial bake)
  const desk = src.width >= DESKTOP.w ? resizeShaded(src, DESKTOP.w, DESKTOP.h) : resizeShaded(src, DESKTOP.w, DESKTOP.h)
  const mob = resizeShaded(src, MOBILE.w, MOBILE.h)
  await writePng(deskPath, desk)
  await writePng(mobPath, mob)
  console.log(`  ${slug}: ${src.width}×${src.height} → ${DESKTOP.w}×${DESKTOP.h}`)
}

for (const age of MILESTONE_AGES_MA) {
  await upsampleOne(age)
}
console.log('Upsample done. Next: npm run earth-history:manifest')
