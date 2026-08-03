/**
 * Bake Holocene polity year-slices from Cliopatria (Seshat, CC BY 4.0).
 *
 * Downloads cliopatria.geojson.zip from GitHub if missing, then emits:
 *   public/geo/earth-history/polities/index.json
 *   public/geo/earth-history/polities/y-{year}.json
 *
 * Usage:
 *   node scripts/earth-history/bake-cliopatria-polities.mjs
 *   node scripts/earth-history/bake-cliopatria-polities.mjs --local path/to/cliopatria.geojson
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT = path.resolve(ROOT, 'public/geo/earth-history/polities')
const CACHE_DIR = path.resolve(ROOT, 'scripts/earth-history/.cache')
const ZIP_URL =
  'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip'
const ZIP_PATH = path.join(CACHE_DIR, 'cliopatria.geojson.zip')
const GEOJSON_PATH = path.join(CACHE_DIR, 'cliopatria.geojson')

export const CLIOPATRIA_CITATION =
  'Cliopatria (Seshat Global History Databank) — CC BY 4.0. https://github.com/Seshat-Global-History-Databank/cliopatria'
export const CLIOPATRIA_VERSION = 'github-main'
export const MAX_FEATURES = 140
export const COORD_PRECISION = 2

/** Year keyframes: −3000…0 every 100; 0…2000 every 50. */
function buildYearList() {
  const years = new Set()
  for (let y = -3000; y <= 0; y += 100) years.add(y)
  for (let y = 0; y <= 2000; y += 50) years.add(y)
  // denser medieval (Chronas showcase)
  for (let y = 800; y <= 1300; y += 25) years.add(y)
  return [...years].sort((a, b) => a - b)
}

function hashHue(name) {
  let h = 0
  const s = String(name || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  // Avoid muddy greens that clash with paleomap land
  let hue = h % 360
  if (hue > 70 && hue < 160) hue = (hue + 120) % 360
  return hue
}

export function polityColor(name) {
  const hue = hashHue(name)
  return `hsla(${hue}, 58%, 48%, 0.42)`
}

export function polityStroke(name) {
  const hue = hashHue(name)
  return `hsla(${hue}, 62%, 62%, 0.85)`
}

function roundCoord(n) {
  const f = 10 ** COORD_PRECISION
  return Math.round(Number(n) * f) / f
}

function simplifyRing(ring, step = 1) {
  if (!Array.isArray(ring) || ring.length < 4) return ring
  const out = []
  for (let i = 0; i < ring.length; i += step) {
    const p = ring[i]
    if (!p || p.length < 2) continue
    out.push([roundCoord(p[0]), roundCoord(p[1])])
  }
  const first = out[0]
  const last = out[out.length - 1]
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]])
  }
  return out.length >= 4 ? out : ring.map((p) => [roundCoord(p[0]), roundCoord(p[1])])
}

function simplifyGeometry(geom) {
  if (!geom) return null
  if (geom.type === 'Polygon') {
    const rings = (geom.coordinates || []).map((r, i) => simplifyRing(r, i === 0 ? 2 : 3))
    return { type: 'Polygon', coordinates: rings }
  }
  if (geom.type === 'MultiPolygon') {
    const polys = (geom.coordinates || []).map((poly) =>
      poly.map((r, i) => simplifyRing(r, i === 0 ? 2 : 3)),
    )
    return { type: 'MultiPolygon', coordinates: polys }
  }
  return geom
}

function centroidOfGeometry(geom) {
  let sumLng = 0
  let sumLat = 0
  let n = 0
  const visit = (coords) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number') {
      sumLng += coords[0]
      sumLat += coords[1]
      n += 1
      return
    }
    for (const c of coords) visit(c)
  }
  visit(geom?.coordinates)
  if (!n) return { lat: 0, lng: 0 }
  return { lng: sumLng / n, lat: sumLat / n }
}

function yearSlug(year) {
  return year < 0 ? `bce${Math.abs(year)}` : String(year)
}

async function downloadZip() {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  if (fs.existsSync(ZIP_PATH) && fs.statSync(ZIP_PATH).size > 1_000_000) {
    console.log(`Using cached zip → ${ZIP_PATH}`)
    return
  }
  console.log(`Downloading Cliopatria (~44 MB)…`)
  const res = await fetch(ZIP_URL)
  if (!res.ok) throw new Error(`Download failed HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(ZIP_PATH, buf)
  console.log(`  saved ${buf.length} bytes`)
}

function unzipGeojson() {
  if (fs.existsSync(GEOJSON_PATH) && fs.statSync(GEOJSON_PATH).size > 1_000_000) {
    console.log(`Using cached geojson → ${GEOJSON_PATH}`)
    return
  }
  console.log('Unzipping…')
  // Windows Expand-Archive
  try {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${ZIP_PATH}' -DestinationPath '${CACHE_DIR}' -Force`,
      ],
      { stdio: 'inherit' },
    )
  } catch {
    // fallback: try tar (Git for Windows / bsdtar)
    execFileSync('tar', ['-xf', ZIP_PATH, '-C', CACHE_DIR], { stdio: 'inherit' })
  }
  if (!fs.existsSync(GEOJSON_PATH)) {
    // find any .geojson in cache
    const found = fs
      .readdirSync(CACHE_DIR)
      .find((f) => f.toLowerCase().endsWith('.geojson'))
    if (found) {
      fs.renameSync(path.join(CACHE_DIR, found), GEOJSON_PATH)
    }
  }
  if (!fs.existsSync(GEOJSON_PATH)) {
    throw new Error('cliopatria.geojson not found after unzip')
  }
}

function loadFeatures(geojsonPath) {
  console.log(`Parsing ${geojsonPath}…`)
  const raw = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'))
  const feats = raw.features || raw
  if (!Array.isArray(feats)) throw new Error('Unexpected GeoJSON shape')
  return feats.filter((f) => {
    const t = f.properties?.Type || f.properties?.type
    return !t || String(t).toUpperCase() === 'POLITY'
  })
}

/**
 * @param {object[]} features
 * @param {number} year
 */
export function slicePolitiesForYear(features, year, { max = MAX_FEATURES } = {}) {
  const hits = []
  for (const f of features) {
    const p = f.properties || {}
    const from = Number(p.FromYear ?? p.fromYear)
    const to = Number(p.ToYear ?? p.toYear)
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue
    if (year < from || year > to) continue
    const name = p.Name || p.name || 'Unknown'
    const area = Number(p.Area ?? p.areaKm2 ?? 0) || 0
    hits.push({
      type: 'Feature',
      properties: {
        name,
        color: polityColor(name),
        stroke: polityStroke(name),
        areaKm2: area,
        fromYear: from,
        toYear: to,
        wikipedia: p.Wikipedia || p.wikipedia || null,
        wikidata: p.Wikidata || p.wikidata || null,
      },
      geometry: simplifyGeometry(f.geometry),
    })
  }
  hits.sort((a, b) => (b.properties.areaKm2 || 0) - (a.properties.areaKm2 || 0))
  return hits.slice(0, max)
}

function writeYearSlice(year, features) {
  const labels = features.slice(0, 18).map((f) => {
    const c = centroidOfGeometry(f.geometry)
    return {
      name: f.properties.name,
      lat: roundCoord(c.lat),
      lng: roundCoord(c.lng),
      areaKm2: f.properties.areaKm2,
      color: f.properties.stroke,
    }
  })
  const collection = {
    type: 'FeatureCollection',
    properties: {
      year,
      source: 'cliopatria',
      citation: CLIOPATRIA_CITATION,
      count: features.length,
    },
    features,
    labels,
  }
  const file = `y-${yearSlug(year)}.json`
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(collection))
  return { year, path: `/geo/earth-history/polities/${file}`, count: features.length }
}

async function main() {
  const args = process.argv.slice(2)
  let localIdx = args.indexOf('--local')
  let geoPath = GEOJSON_PATH
  if (localIdx >= 0 && args[localIdx + 1]) {
    geoPath = path.resolve(args[localIdx + 1])
  } else {
    await downloadZip()
    unzipGeojson()
  }

  const features = loadFeatures(geoPath)
  console.log(`Loaded ${features.length} POLITY features`)

  fs.mkdirSync(OUT, { recursive: true })
  // clear old slices
  for (const f of fs.readdirSync(OUT)) {
    if (f.startsWith('y-') && f.endsWith('.json')) fs.unlinkSync(path.join(OUT, f))
  }

  const years = buildYearList()
  const frames = []
  for (const year of years) {
    const slice = slicePolitiesForYear(features, year)
    const meta = writeYearSlice(year, slice)
    frames.push(meta)
    console.log(`  ${year}: ${meta.count} polities → ${meta.path}`)
  }

  const index = {
    version: '1.0.0-cliopatria',
    source: 'cliopatria',
    sourceVersion: CLIOPATRIA_VERSION,
    citation: CLIOPATRIA_CITATION,
    license: 'CC BY 4.0',
    maxFeatures: MAX_FEATURES,
    frames,
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
  console.log(`Wrote ${frames.length} year slices → ${OUT}`)
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
