/**
 * Bake equirectangular paleomap textures from GPlates Web Service (CAO2024).
 * Scientific frames: ≤1800 Ma via reconstruct/coastlines?fmt=png
 * (coastlines = continental outlines; static_polygons fill oceanic plates too)
 * Precambrian (>1800 Ma): keep / regenerate illustrative placeholders.
 *
 * Usage: node scripts/earth-history/bake-gplates-textures.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import {
  BAKE_MODEL_ID,
  ageSlug,
  gwsBakeAges,
  illustrativeAges,
} from './ages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../public/geo/earth-history/textures')
const GWS = 'https://gws.gplates.org/reconstruct/coastlines/'
const DESKTOP = { w: 2048, h: 1024 }
const MOBILE = { w: 1024, h: 512 }
const DELAY_MS = 900
const MAX_RETRIES = 4

const OCEAN = { r: 18, g: 48, b: 92 }
const OCEAN_POLE = { r: 12, g: 36, b: 78 }
const LAND = { r: 110, g: 140, b: 95 }
const LAND_EDGE = { r: 42, g: 58, b: 40 }
const LAND_HIGH = { r: 128, g: 158, b: 108 }

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function isNearBlack(r, g, b, a) {
  if (a < 20) return true
  return r < 28 && g < 28 && b < 28
}

function isNearLand(r, g, b) {
  // GWS lime / olive land on black
  const lum = (r + g + b) / 3
  return lum > 40
}

/**
 * Bilinear sample RGBA from a PNG (wraps longitude).
 * @param {PNG} src
 * @param {number} fx
 * @param {number} fy
 */
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
  const out = [0, 0, 0, 0]
  for (let k = 0; k < 4; k++) {
    const a = c00[k] * (1 - tx) + c10[k] * tx
    const b = c01[k] * (1 - tx) + c11[k] * tx
    out[k] = a * (1 - ty) + b * ty
  }
  return out
}

function mixRgb(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

/**
 * Bilinear resize + recolor: black→ocean, land→muted basalt green with latitude shading.
 * @param {PNG} src
 * @param {number} tw
 * @param {number} th
 */
function processFrame(src, tw, th) {
  const out = new PNG({ width: tw, height: th })
  for (let y = 0; y < th; y++) {
    const latShade = Math.abs(y / (th - 1) - 0.5) * 2 // 0 equator → 1 poles
    for (let x = 0; x < tw; x++) {
      const fx = (x / tw) * src.width
      const fy = (y / th) * src.height
      const [r, g, b, a] = sampleBilinear(src, fx, fy)
      const di = (tw * y + x) << 2
      if (isNearBlack(r, g, b, a) || !isNearLand(r, g, b)) {
        const ocean = mixRgb(OCEAN, OCEAN_POLE, latShade * 0.55)
        out.data[di] = ocean.r
        out.data[di + 1] = ocean.g
        out.data[di + 2] = ocean.b
      } else {
        const dark = r + g + b < 120
        const landBase = mixRgb(LAND, LAND_HIGH, (1 - latShade) * 0.35)
        const col = dark ? LAND_EDGE : landBase
        out.data[di] = col.r
        out.data[di + 1] = col.g
        out.data[di + 2] = col.b
      }
      out.data[di + 3] = 255
    }
  }
  return out
}

function writePng(filePath, png) {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath)
    png
      .pack()
      .pipe(stream)
      .on('finish', resolve)
      .on('error', reject)
  })
}

async function fetchCoastlinePng(ageMa) {
  const url = new URL(GWS)
  url.searchParams.set('time', String(ageMa))
  url.searchParams.set('model', BAKE_MODEL_ID)
  url.searchParams.set('fmt', 'png')
  url.searchParams.set('facecolor', '#6b8f71')
  url.searchParams.set('edgecolor', '#1a2e24')
  url.searchParams.set('alpha', '1')
  url.searchParams.set('extent', '-180,180,-90,90')

  let lastErr
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { Accept: 'image/png' },
      })
      if (!res.ok) {
        throw new Error(`GWS coastlines PNG HTTP ${res.status} @ ${ageMa} Ma`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      return PNG.sync.read(buf)
    } catch (err) {
      lastErr = err
      console.warn(`  retry ${attempt}/${MAX_RETRIES} for ${ageMa} Ma: ${err.message}`)
      await sleep(DELAY_MS * attempt)
    }
  }
  throw lastErr
}

/** Illustrative Precambrian placeholders (same look as generate-dev-textures). */
function paintIllustrative(width, height, ageMa) {
  const png = new PNG({ width, height })
  const drift = ageMa / 4540
  for (let y = 0; y < height; y++) {
    const latShade = Math.abs(y / (height - 1) - 0.5) * 2
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2
      const u = x / width
      const v = y / height
      const cx1 = 0.35 + 0.25 * Math.sin(drift * Math.PI * 2)
      const cy1 = 0.45 + 0.1 * Math.cos(drift * 3)
      const cx2 = 0.65 - 0.2 * Math.cos(drift * Math.PI)
      const cy2 = 0.55 - 0.15 * Math.sin(drift * 2)
      const r1 = 0.12 + 0.1 * (1 - drift)
      const r2 = 0.1 + 0.08 * drift
      const d1 = (u - cx1) ** 2 + ((v - cy1) * 1.2) ** 2
      const d2 = (u - cx2) ** 2 + ((v - cy2) * 1.1) ** 2
      const land = d1 < r1 * r1 || d2 < r2 * r2
      if (ageMa > 4000 && !land) {
        png.data[i] = 50
        png.data[i + 1] = 28
        png.data[i + 2] = 24
      } else if (land) {
        const landBase = mixRgb(LAND, LAND_HIGH, (1 - latShade) * 0.35)
        png.data[i] = landBase.r
        png.data[i + 1] = landBase.g
        png.data[i + 2] = landBase.b
      } else {
        const ocean = mixRgb(OCEAN, OCEAN_POLE, latShade * 0.55)
        png.data[i] = ocean.r
        png.data[i + 1] = ocean.g
        png.data[i + 2] = ocean.b
      }
      png.data[i + 3] = 255
    }
  }
  return png
}

async function bakeScientific(ageMa) {
  const slug = ageSlug(ageMa)
  console.log(`Fetching GWS ${BAKE_MODEL_ID} coastlines PNG @ ${ageMa} Ma…`)
  const src = await fetchCoastlinePng(ageMa)
  const desk = processFrame(src, DESKTOP.w, DESKTOP.h)
  const mob = processFrame(src, MOBILE.w, MOBILE.h)
  await writePng(path.join(OUT, `ma-${slug}.png`), desk)
  await writePng(path.join(OUT, `ma-${slug}-m.png`), mob)
  console.log(`  wrote ma-${slug}.png (+ mobile)`)
}

async function bakeIllustrative(ageMa) {
  const slug = ageSlug(ageMa)
  console.log(`Illustrative Precambrian placeholder @ ${ageMa} Ma…`)
  await writePng(path.join(OUT, `ma-${slug}.png`), paintIllustrative(DESKTOP.w, DESKTOP.h, ageMa))
  await writePng(path.join(OUT, `ma-${slug}-m.png`), paintIllustrative(MOBILE.w, MOBILE.h, ageMa))
  console.log(`  wrote ma-${slug}.png (+ mobile)`)
}

fs.mkdirSync(OUT, { recursive: true })

for (const age of illustrativeAges()) {
  await bakeIllustrative(age)
}

// PaleoDEM ages (0–540 @ 5 Myr) are painted by bake-paleodem-textures.mjs
for (const age of gwsBakeAges()) {
  await bakeScientific(age)
  await sleep(DELAY_MS)
}

console.log(`Done → ${OUT}`)
console.log('Next: node scripts/earth-history/write-manifest.mjs')
