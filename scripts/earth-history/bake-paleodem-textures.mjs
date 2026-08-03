/**
 * Bake equirectangular hypsometric + relief textures from Scotese & Wright (2018) PaleoDEM
 * numeric grids (CSV lat/lon/elev or lon/lat/elev).
 *
 * Licensing: use the EarthByte / Zenodo **numeric grids** (CC BY 4.0 License.txt).
 * Do NOT redistribute pre-rendered PaleoAtlas JPEGs. Cite PALEODEM_CITATION from ages.mjs.
 *
 * Source zip:
 *   https://www.earthbyte.org/webdav/ftp/Data_Collections/Scotese_Wright_2018_PaleoDEM/PaleoDEMS_long_lat_elev_csv_v2.zip
 *
 * Usage:
 *   node scripts/earth-history/bake-paleodem-textures.mjs [--ages 0,66,100,252] [--skip-download]
 *
 * Env:
 *   PALEODEM_CSV_DIR — directory of already-extracted CSV files (skips download)
 *
 * Offline: if download fails or CSVs are missing, paints shelf/land from existing coastline
 * texture PNGs (procedural fallback) so the pipeline remains runnable.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { PNG } from 'pngjs'
import {
  PALEODEM_CITATION,
  ageSlug,
  isPaleodemAge,
  paleodemAges,
} from './ages.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE = path.resolve(__dirname, '.cache')
const ZIP_URL =
  'https://www.earthbyte.org/webdav/ftp/Data_Collections/Scotese_Wright_2018_PaleoDEM/PaleoDEMS_long_lat_elev_csv_v2.zip'
const ZIP_NAME = 'PaleoDEMS_long_lat_elev_csv_v2.zip'
const CSV_CACHE = path.join(CACHE, 'paleodem-csv')
const OUT = path.resolve(__dirname, '../../public/geo/earth-history/textures')

const DESKTOP = { w: 2048, h: 1024 }
const MOBILE = { w: 1024, h: 512 }
/** PaleoDEM native grid */
const GRID_W = 360
const GRID_H = 180

/**
 * Cool ATLAS-neutral hypsometric ramp (elevation meters → RGB).
 * deep ocean → abyssal → shelf sea → coastal lowland → upland → mountain → ice
 */
const RAMP = [
  { z: -6000, c: { r: 12, g: 28, b: 48 } }, // deep ocean
  { z: -4000, c: { r: 18, g: 42, b: 72 } }, // abyssal
  { z: -2000, c: { r: 28, g: 62, b: 96 } },
  { z: -200, c: { r: 72, g: 118, b: 148 } }, // shelf sea (light blue)
  { z: 0, c: { r: 96, g: 138, b: 158 } },
  { z: 50, c: { r: 118, g: 132, b: 108 } }, // coastal lowland
  { z: 500, c: { r: 108, g: 122, b: 96 } }, // upland
  { z: 1500, c: { r: 98, g: 108, b: 88 } },
  { z: 3000, c: { r: 120, g: 118, b: 108 } }, // mountain
  { z: 4500, c: { r: 168, g: 170, b: 172 } }, // ice / high alpine
  { z: 6000, c: { r: 210, g: 214, b: 218 } },
]

function parseArgs(argv) {
  let ages = null
  let skipDownload = false
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--skip-download') skipDownload = true
    else if (a === '--ages') {
      const raw = argv[++i] || ''
      ages = raw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    } else if (a.startsWith('--ages=')) {
      ages = a
        .slice('--ages='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n))
    }
  }
  return { ages, skipDownload }
}

function mixRgb(a, b, t) {
  const u = Math.max(0, Math.min(1, t))
  return {
    r: Math.round(a.r + (b.r - a.r) * u),
    g: Math.round(a.g + (b.g - a.g) * u),
    b: Math.round(a.b + (b.b - a.b) * u),
  }
}

function elevToColor(z) {
  if (!Number.isFinite(z)) return RAMP[0].c
  if (z <= RAMP[0].z) return RAMP[0].c
  if (z >= RAMP[RAMP.length - 1].z) return RAMP[RAMP.length - 1].c
  for (let i = 0; i < RAMP.length - 1; i++) {
    const a = RAMP[i]
    const b = RAMP[i + 1]
    if (z >= a.z && z <= b.z) {
      const t = (z - a.z) / (b.z - a.z || 1)
      return mixRgb(a.c, b.c, t)
    }
  }
  return RAMP[RAMP.length - 1].c
}

/** Land relief grayscale; ocean stays near-black. */
function elevToRelief(z) {
  if (!Number.isFinite(z) || z < 0) return 18
  // 0 → ~40, 6000m → ~235
  const t = Math.max(0, Math.min(1, z / 6000))
  return Math.round(40 + t * 195)
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

function readPngFile(filePath) {
  const buf = fs.readFileSync(filePath)
  return PNG.sync.read(buf)
}

/**
 * Bilinear sample from Float32 elevation grid (lon 0..359 → x, lat 90..-89 → y).
 * @param {Float32Array} grid
 * @param {number} lon -180..180
 * @param {number} lat -90..90
 */
function sampleElev(grid, lon, lat) {
  let x = lon + 180 // 0..360
  if (x >= 360) x -= 360
  if (x < 0) x += 360
  const y = (90 - lat) // 0 at north pole … 180 at south
  const x0 = Math.floor(x) % GRID_W
  const y0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(y)))
  const x1 = (x0 + 1) % GRID_W
  const y1 = Math.max(0, Math.min(GRID_H - 1, y0 + 1))
  const tx = x - Math.floor(x)
  const ty = y - y0
  const v = (ix, iy) => grid[iy * GRID_W + ix]
  const a = v(x0, y0) * (1 - tx) + v(x1, y0) * tx
  const b = v(x0, y1) * (1 - tx) + v(x1, y1) * tx
  return a * (1 - ty) + b * ty
}

/**
 * Parse PaleoDEM CSV (lon,lat,elev or lat,lon,elev; comma/whitespace).
 * @returns {Float32Array} length GRID_W * GRID_H
 */
function parseCsvToGrid(text) {
  const grid = new Float32Array(GRID_W * GRID_H)
  grid.fill(Number.NaN)
  // Some PaleoDEM CSVs use bare CR line endings (classic Mac).
  const lines = text.split(/\r\n|\n|\r/)
  let samples = 0
  let lonFirst = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    // Skip header rows like "lon,lat,elev" (not comment-prefixed)
    if (/[a-zA-Z]/.test(trimmed)) continue
    const parts = trimmed.split(/[,\s]+/).filter(Boolean)
    if (parts.length < 3) continue
    const a = Number(parts[0])
    const b = Number(parts[1])
    const elev = Number(parts[2])
    if (![a, b, elev].every(Number.isFinite)) continue

    // Detect column order from first sample magnitude ranges
    if (lonFirst === null) {
      const aLooksLon = Math.abs(a) <= 180.5 && Math.abs(b) <= 90.5
      const bLooksLon = Math.abs(b) <= 180.5 && Math.abs(a) <= 90.5
      if (aLooksLon && !bLooksLon) lonFirst = true
      else if (bLooksLon && !aLooksLon) lonFirst = false
      else lonFirst = Math.abs(a) > 90.5 || (Math.abs(a) <= 180.5 && Math.abs(b) <= 90.5)
    }

    const lon = lonFirst ? a : b
    const lat = lonFirst ? b : a
    let ix = Math.round(lon + 180)
    if (ix >= GRID_W) ix -= GRID_W
    if (ix < 0) ix += GRID_W
    const iy = Math.round(90 - lat)
    if (iy < 0 || iy >= GRID_H || ix < 0 || ix >= GRID_W) continue
    grid[iy * GRID_W + ix] = elev
    samples++
  }

  if (samples < 1000) {
    throw new Error(`CSV parse yielded only ${samples} samples (expected ~${GRID_W * GRID_H})`)
  }

  // Fill any holes with nearest neighbor along row
  for (let y = 0; y < GRID_H; y++) {
    let last = 0
    for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x
      if (Number.isFinite(grid[i])) last = grid[i]
      else grid[i] = last
    }
  }

  return grid
}

function renderFromGrid(grid, tw, th) {
  const color = new PNG({ width: tw, height: th })
  const relief = new PNG({ width: tw, height: th })
  for (let y = 0; y < th; y++) {
    const lat = 90 - (y / (th - 1)) * 180
    for (let x = 0; x < tw; x++) {
      const lon = -180 + (x / tw) * 360
      const z = sampleElev(grid, lon, lat)
      const col = elevToColor(z)
      const gray = elevToRelief(z)
      const i = (tw * y + x) << 2
      color.data[i] = col.r
      color.data[i + 1] = col.g
      color.data[i + 2] = col.b
      color.data[i + 3] = 255
      relief.data[i] = gray
      relief.data[i + 1] = gray
      relief.data[i + 2] = gray
      relief.data[i + 3] = 255
    }
  }
  return { color, relief }
}

/**
 * Offline fallback: recolor an existing coastline-bake PNG with shelf/land hypsometry
 * and a soft synthetic relief (no true elevation).
 */
function renderFallbackFromCoastlinePng(src, tw, th) {
  const color = new PNG({ width: tw, height: th })
  const relief = new PNG({ width: tw, height: th })
  const sw = src.width
  const sh = src.height

  for (let y = 0; y < th; y++) {
    const latShade = Math.abs(y / (th - 1) - 0.5) * 2
    const sy = Math.min(sh - 1, Math.floor((y / th) * sh))
    for (let x = 0; x < tw; x++) {
      const sx = Math.floor((x / tw) * sw) % sw
      const si = (sw * sy + sx) << 2
      const r = src.data[si]
      const g = src.data[si + 1]
      const b = src.data[si + 2]
      const a = src.data[si + 3]
      const lum = (r + g + b) / 3
      const isOcean = a < 20 || (r < 50 && g < 70 && b > 60) || lum < 45
      const di = (tw * y + x) << 2
      let col
      let gray
      if (isOcean) {
        // shallow shelf near land edges via neighbor peek
        let nearLand = false
        for (const [dx, dy] of [
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ]) {
          const nx = (sx + dx + sw) % sw
          const ny = Math.max(0, Math.min(sh - 1, sy + dy))
          const ni = (sw * ny + nx) << 2
          const nl = (src.data[ni] + src.data[ni + 1] + src.data[ni + 2]) / 3
          if (nl > 55 && src.data[ni] > 40) {
            nearLand = true
            break
          }
        }
        col = nearLand ? elevToColor(-80) : elevToColor(-3500 - latShade * 800)
        gray = 18
      } else {
        // Fake land elevation from luminance + latitude
        const z = 80 + (lum - 50) * 12 + (1 - latShade) * 200
        col = elevToColor(z)
        gray = elevToRelief(z)
      }
      color.data[di] = col.r
      color.data[di + 1] = col.g
      color.data[di + 2] = col.b
      color.data[di + 3] = 255
      relief.data[di] = gray
      relief.data[di + 1] = gray
      relief.data[di + 2] = gray
      relief.data[di + 3] = 255
    }
  }
  return { color, relief }
}

function listCsvFiles(dir) {
  if (!fs.existsSync(dir)) return []
  /** @type {string[]} */
  const out = []
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) walk(p)
      else if (/\.csv$/i.test(ent.name)) out.push(p)
    }
  }
  walk(dir)
  return out
}

/**
 * Find CSV whose name encodes the age.
 * Scotese zip uses zero-padded ages: Map01_000Ma.csv, Map03_005Ma.csv, Map23_100Ma.csv.
 * @param {string[]} files
 * @param {number} ageMa
 */
function findCsvForAge(files, ageMa) {
  const n = Math.round(Number(ageMa))
  const slug = ageSlug(n)
  const padded = String(n).padStart(3, '0')
  // Prefer exact `_NNNMa.csv` / `_NMa.csv` suffix to avoid Map66_* matching age 66 vs 370
  const patterns = [
    new RegExp(`_${padded}Ma\\.csv$`, 'i'),
    new RegExp(`_${slug}Ma\\.csv$`, 'i'),
  ]
  const hits = files.filter((f) => {
    const base = path.basename(f)
    return patterns.some((re) => re.test(base))
  })
  if (!hits.length) return null
  hits.sort((a, b) => a.length - b.length)
  return hits[0]
}

/** Snap off-grid CLI ages (e.g. 66 → 65, 252 → 250) to nearest PaleoDEM keyframe. */
function resolveBakeAges(requested) {
  const grid = paleodemAges()
  if (!requested?.length) return grid
  /** @type {number[]} */
  const out = []
  for (const a of requested) {
    if (isPaleodemAge(a)) {
      out.push(a === Math.floor(a) ? a : Math.round(a))
      continue
    }
    let best = grid[0]
    let bestD = Infinity
    for (const p of grid) {
      const d = Math.abs(p - a)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    console.warn(`Age ${a} Ma is not on the PaleoDEM 5 Myr grid — using ${best} Ma`)
    out.push(best)
  }
  return [...new Set(out)]
}

async function downloadZip(destZip) {
  console.log(`Downloading PaleoDEM CSV zip…\n  ${ZIP_URL}`)
  const res = await fetch(ZIP_URL, {
    headers: { Accept: 'application/zip,*/*' },
  })
  if (!res.ok) throw new Error(`Download HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(destZip), { recursive: true })
  fs.writeFileSync(destZip, buf)
  console.log(`  saved ${destZip} (${(buf.length / 1e6).toFixed(1)} MB)`)
  return buf
}

function extractZip(zipBuf, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const files = unzipSync(new Uint8Array(zipBuf))
  let n = 0
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('/')) continue
    const dest = path.join(outDir, name)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, Buffer.from(data))
    n++
  }
  console.log(`  extracted ${n} files → ${outDir}`)
}

async function ensureCsvDir({ skipDownload }) {
  const envDir = process.env.PALEODEM_CSV_DIR
  if (envDir && fs.existsSync(envDir)) {
    console.log(`Using PALEODEM_CSV_DIR=${envDir}`)
    return { dir: path.resolve(envDir), fromDownload: false }
  }

  const existing = listCsvFiles(CSV_CACHE)
  if (existing.length > 50) {
    console.log(`Using cached CSVs (${existing.length} files) in ${CSV_CACHE}`)
    return { dir: CSV_CACHE, fromDownload: false }
  }

  if (skipDownload) {
    console.warn('--skip-download set and cache empty/incomplete; will use coastline PNG fallback')
    return { dir: CSV_CACHE, fromDownload: false }
  }

  const zipPath = path.join(CACHE, ZIP_NAME)
  try {
    let buf
    if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1e6) {
      console.log(`Using cached zip ${zipPath}`)
      buf = fs.readFileSync(zipPath)
    } else {
      buf = await downloadZip(zipPath)
    }
    extractZip(buf, CSV_CACHE)
    return { dir: CSV_CACHE, fromDownload: true }
  } catch (err) {
    console.warn(`\n⚠ PaleoDEM download/extract failed: ${err.message}`)
    console.warn('  Continuing with procedural fallback from existing coastline textures.\n')
    console.warn(`  Citation when grids are available: ${PALEODEM_CITATION}\n`)
    return { dir: CSV_CACHE, fromDownload: false }
  }
}

async function bakeAge(ageMa, csvPath, mode) {
  const slug = ageSlug(ageMa)
  let desk
  let mob

  if (mode === 'csv' && csvPath) {
    console.log(`Rasterizing PaleoDEM CSV @ ${ageMa} Ma… (${path.basename(csvPath)})`)
    const text = fs.readFileSync(csvPath, 'utf8')
    const grid = parseCsvToGrid(text)
    desk = renderFromGrid(grid, DESKTOP.w, DESKTOP.h)
    mob = renderFromGrid(grid, MOBILE.w, MOBILE.h)
  } else {
    const coastPath = path.join(OUT, `ma-${slug}.png`)
    const coastPathAlt = [
      coastPath,
      path.join(OUT, `ma-${Math.round(ageMa)}.png`),
      // nearest existing on 5 Myr neighborhood for missing bake
    ]
    let src = null
    for (const p of coastPathAlt) {
      if (fs.existsSync(p)) {
        src = readPngFile(p)
        break
      }
    }
    // Search any nearby milestone texture if exact age missing
    if (!src) {
      const candidates = fs
        .readdirSync(OUT)
        .filter((n) => /^ma-[\d.]+\.png$/.test(n) && !n.includes('-m') && !n.includes('relief'))
      let best = null
      let bestDist = Infinity
      for (const n of candidates) {
        const m = n.match(/^ma-([\d.]+)\.png$/)
        if (!m) continue
        const a = Number(m[1])
        const d = Math.abs(a - ageMa)
        if (d < bestDist) {
          bestDist = d
          best = path.join(OUT, n)
        }
      }
      if (best && bestDist <= 50) src = readPngFile(best)
    }
    if (!src) {
      console.warn(`  no coastline PNG for ${ageMa} Ma — painting empty ocean fallback`)
      const empty = new PNG({ width: 64, height: 32 })
      for (let i = 0; i < empty.data.length; i += 4) {
        empty.data[i] = 18
        empty.data[i + 1] = 42
        empty.data[i + 2] = 72
        empty.data[i + 3] = 255
      }
      src = empty
    } else {
      console.log(`  fallback from coastline PNG @ ${ageMa} Ma (no PaleoDEM CSV)`)
    }
    desk = renderFallbackFromCoastlinePng(src, DESKTOP.w, DESKTOP.h)
    mob = renderFallbackFromCoastlinePng(src, MOBILE.w, MOBILE.h)
  }

  fs.mkdirSync(OUT, { recursive: true })
  await writePng(path.join(OUT, `ma-${slug}.png`), desk.color)
  await writePng(path.join(OUT, `ma-${slug}-m.png`), mob.color)
  await writePng(path.join(OUT, `ma-${slug}-relief.png`), desk.relief)
  await writePng(path.join(OUT, `ma-${slug}-relief-m.png`), mob.relief)
  console.log(`  wrote ma-${slug}.png (+ mobile) and relief`)
}

async function main() {
  const { ages: ageFilter, skipDownload } = parseArgs(process.argv)
  const targetAges = resolveBakeAges(ageFilter)

  if (!targetAges.length) {
    console.error('No PaleoDEM ages to bake. Use --ages 0,66,100 or omit for full 0–540 @ 5 Myr.')
    process.exit(1)
  }

  console.log(`PaleoDEM bake — ${targetAges.length} age(s)`)
  console.log(`Attribution: ${PALEODEM_CITATION}`)

  const { dir: csvDir } = await ensureCsvDir({ skipDownload })
  const csvFiles = listCsvFiles(csvDir)
  console.log(`CSV inventory: ${csvFiles.length} file(s) under ${csvDir}`)

  let csvCount = 0
  let fallbackCount = 0

  for (const age of targetAges) {
    const csv = findCsvForAge(csvFiles, age)
    if (csv) {
      await bakeAge(age, csv, 'csv')
      csvCount++
    } else {
      await bakeAge(age, null, 'fallback')
      fallbackCount++
    }
  }

  console.log(`\nDone → ${OUT}`)
  console.log(`  PaleoDEM CSV rasters: ${csvCount}`)
  console.log(`  Coastline PNG fallbacks: ${fallbackCount}`)
  console.log('Next: node scripts/earth-history/write-manifest.mjs')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
