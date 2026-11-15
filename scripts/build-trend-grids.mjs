/**
 * Build the instrument trend grids for Trend Detective.
 *
 *   npm run trend:grids            # every variable
 *   npm run trend:grids -- NDVI    # just the ones named
 *
 * Variables are defined in src/services/nasaPower/instrumentGrids.js and come
 * from one of two NASA services:
 *
 *   GIBS (no login): downloads the color-coded map tiles that cover
 *   Washington, turns each pixel's color back into a data value with the
 *   layer's color table, and averages the pixels in every grid cell. Daily
 *   layers (OMI nitrogen dioxide, GPM wet days) are reduced to months here.
 *
 *   GES DISC cloud OPeNDAP (free Earthdata Login): asks for just the
 *   Washington box of each monthly file and gets the product's own numbers.
 *   Put a token from https://urs.earthdata.nasa.gov (Generate Token) in
 *   .env.local as EARTHDATA_TOKEN=..., and approve the "NASA GESDISC DATA
 *   ARCHIVE" application on your Earthdata profile. Without a token these
 *   variables are skipped and their existing files are left alone.
 *
 * Downloads are kept in the system temp folder, so a rerun only fetches what
 * is missing. Output: public/trend-grids/<CODE>_<n>.json.
 */
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import {
  INSTRUMENT_GRIDS,
  INSTRUMENT_GRID_CODES,
  GRID_END_YEAR,
  GRID_NODATA,
  gridChunkUrl,
  gridIndex,
  gridLayout,
  monthsFrom,
} from '../src/services/nasaPower/instrumentGrids.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public/trend-grids')
const cacheDir = path.join(os.tmpdir(), 'atlas-trend-grids')

const GIBS = 'https://gibs.earthdata.nasa.gov'
const OPENDAP = 'https://opendap.earthdata.nasa.gov'
const TILE_PX = 512
const CONCURRENCY = 8

/** GIBS color table for each variable's layer. */
const COLOR_TABLES = {
  NDVI: 'MODIS_L3_NDVI',
  LST_DAY: 'MODIS_Land_Surface_Temp',
  CO_500: 'AIRS_Carbon_Monoxide_Volume_Mixing_Ratio',
  SOIL_GLDAS: 'GLDAS_Underground_Soil_Moisture_Monthly',
  NO2: 'OMI_Nitrogen_Dioxide_Tropo_Column',
  WET_DAYS: 'GPM_Precipitation_Rate',
}

/** A cell-month needs this share of its pixels (monthly layers) or this many days (daily layers). */
const MIN_PIXEL_SHARE = 0.1
const MIN_PIXELS = 3
const MIN_DAYS_FOR_MEAN = 5
const MIN_DAY_SHARE_FOR_WET_DAYS = 0.8

/** EARTHDATA_TOKEN from the environment, else from .env.local. */
function earthdataToken() {
  if (process.env.EARTHDATA_TOKEN) return process.env.EARTHDATA_TOKEN.trim()
  const file = path.join(root, '.env.local')
  if (!existsSync(file)) return null
  const line = readFileSync(file, 'utf8').split('\n').find((l) => l.startsWith('EARTHDATA_TOKEN='))
  return line ? line.slice('EARTHDATA_TOKEN='.length).trim().replace(/^["']|["']$/g, '') : null
}

async function fetchRetry(url, tries = 4, headers = undefined) {
  let lastError
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(120_000) })
      if (res.status === 404 || res.status === 400) return null
      if (res.status === 401 || res.status === 403) {
        const err = new Error(
          `NASA refused the Earthdata token (${res.status}). Generate a new token at https://urs.earthdata.nasa.gov and approve "NASA GESDISC DATA ARCHIVE" under Applications.`,
        )
        err.fatal = true
        throw err
      }
      if (!res.ok) throw new Error(`${res.status} for ${url}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      if (err.fatal) throw err
      lastError = err
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    }
  }
  throw lastError
}

/**
 * rgb 'r,g,b' → the value that color stands for.
 * `value: null` means no data. `dry: true` marks the "below the lowest
 * measured rate" color that precipitation layers draw transparent.
 */
async function loadColorTable(name) {
  const xml = (await fetchRetry(`${GIBS}/colormaps/v1.3/${name}.xml`)).toString('utf8')
  const table = new Map()
  for (const m of xml.matchAll(/<ColorMapEntry ([^>]*?)\/?>/g)) {
    const a = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((x) => [x[1], x[2]]))
    if (table.has(a.rgb)) continue
    const transparent = a.transparent === 'true'
    if (!a.value || a.nodata === 'true') {
      table.set(a.rgb, { value: null, transparent })
      continue
    }
    const bounds = a.value.replace(/[[\]()]/g, '').split(',').map((v) => (v.includes('INF') ? null : Number(v)))
    const [lo, hi] = bounds.length === 1 ? [bounds[0], bounds[0]] : bounds
    const value = lo != null && hi != null ? (lo + hi) / 2 : lo ?? hi
    table.set(a.rgb, { value, transparent, dry: transparent && lo == null })
  }
  return table
}

/** The tiles that cover the grid, each with a pixel → grid cell lookup (-1 = outside). */
function planTiles(code) {
  const spec = INSTRUMENT_GRIDS[code]
  const g = gridLayout(code)
  const span = 288 / 2 ** spec.level
  const px = span / TILE_PX
  const north = g.south + g.rows * g.cell
  const east = g.west + g.cols * g.cell
  const tiles = []
  for (let row = Math.floor((90 - north) / span); row <= Math.floor((90 - g.south - 1e-9) / span); row++) {
    for (let col = Math.floor((g.west + 180) / span); col <= Math.floor((east + 180 - 1e-9) / span); col++) {
      const cellOf = new Int32Array(TILE_PX * TILE_PX).fill(-1)
      for (let y = 0; y < TILE_PX; y++) {
        const lat = 90 - row * span - (y + 0.5) * px
        for (let x = 0; x < TILE_PX; x++) {
          const at = gridIndex(code, lat, -180 + col * span + (x + 0.5) * px)
          if (at) cellOf[y * TILE_PX + x] = at.row * g.cols + at.col
        }
      }
      tiles.push({ row, col, cellOf })
    }
  }
  const pixelsPerCell = new Int32Array(g.rows * g.cols)
  for (const t of tiles) for (const c of t.cellOf) if (c >= 0) pixelsPerCell[c] += 1
  return { tiles, pixelsPerCell }
}

async function loadTile(spec, date, tile) {
  const dir = path.join(cacheDir, spec.layer)
  const file = path.join(dir, `${date}_${spec.level}_${tile.row}_${tile.col}.png`)
  let buf
  try {
    buf = await readFile(file)
  } catch {
    buf = await fetchRetry(
      `${GIBS}/wmts/epsg4326/best/${spec.layer}/default/${date}/${spec.tileSet}/${spec.level}/${tile.row}/${tile.col}.png`,
    )
    // An empty marker file records "GIBS has nothing for this date".
    await mkdir(dir, { recursive: true })
    await writeFile(file, buf || Buffer.alloc(0))
  }
  if (!buf || buf.length === 0) return null
  const png = PNG.sync.read(buf)
  if (png.width !== TILE_PX || png.height !== TILE_PX) throw new Error(`Unexpected tile size for ${spec.layer} ${date}`)
  return png.data
}

/**
 * One date's tiles → per-cell sums.
 * `sum`/`count` cover pixels with a value; `wet`/`known` count precipitation pixels.
 */
async function readDate(code, date, plan, table) {
  const spec = INSTRUMENT_GRIDS[code]
  const n = plan.pixelsPerCell.length
  const out = { sum: new Float64Array(n), count: new Int32Array(n), wet: new Int32Array(n), known: new Int32Array(n), any: false }
  const unknown = new Map()
  for (const tile of plan.tiles) {
    const data = await loadTile(spec, date, tile)
    if (!data) continue
    out.any = true
    for (let p = 0; p < tile.cellOf.length; p++) {
      const cell = tile.cellOf[p]
      if (cell < 0) continue
      const i = p * 4
      const key = `${data[i]},${data[i + 1]},${data[i + 2]}`
      const entry = table.get(key)
      if (!entry) {
        // Fully transparent pixels with an unlisted color are plain "no data".
        if (data[i + 3] !== 0) unknown.set(key, (unknown.get(key) || 0) + 1)
        continue
      }
      if (entry.dry) {
        out.known[cell] += 1
        continue
      }
      if (entry.value == null || (entry.transparent && data[i + 3] === 0)) continue
      out.known[cell] += 1
      out.wet[cell] += 1
      out.sum[cell] += spec.convert ? spec.convert(entry.value) : entry.value
      out.count[cell] += 1
    }
  }
  if (unknown.size) {
    const worst = [...unknown].sort((a, b) => b[1] - a[1])[0]
    throw new Error(`${spec.layer} ${date}: ${unknown.size} colors are not in the color table (e.g. ${worst[0]} × ${worst[1]})`)
  }
  return out
}

async function inBatches(items, worker) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await worker(items[i], i)
      }
    }),
  )
  return results
}

const daysIn = (ym) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()

/** One monthly value per cell, or null. */
async function buildMonth(code, ym, plan, table) {
  const spec = INSTRUMENT_GRIDS[code]
  const n = plan.pixelsPerCell.length
  const values = new Array(n).fill(null)

  if (spec.cadence === 'month') {
    const d = await readDate(code, `${ym}-01`, plan, table)
    for (let c = 0; c < n; c++) {
      const need = Math.max(MIN_PIXELS, plan.pixelsPerCell[c] * MIN_PIXEL_SHARE)
      if (d.count[c] >= need) values[c] = d.sum[c] / d.count[c]
    }
    return values
  }

  const total = daysIn(ym)
  const sum = new Float64Array(n)
  const count = new Float64Array(n)
  const days = new Int32Array(n)
  const wetShare = new Float64Array(n)
  for (let day = 1; day <= total; day++) {
    const d = await readDate(code, `${ym}-${String(day).padStart(2, '0')}`, plan, table)
    if (!d.any) continue
    for (let c = 0; c < n; c++) {
      if (spec.reduce === 'wetDays') {
        if (d.known[c] < plan.pixelsPerCell[c] * 0.5) continue
        days[c] += 1
        wetShare[c] += d.wet[c] / d.known[c]
      } else if (d.count[c] > 0) {
        days[c] += 1
        sum[c] += d.sum[c]
        count[c] += d.count[c]
      }
    }
  }
  for (let c = 0; c < n; c++) {
    if (spec.reduce === 'wetDays') {
      if (days[c] >= total * MIN_DAY_SHARE_FOR_WET_DAYS) values[c] = (wetShare[c] / days[c]) * total
    } else if (days[c] >= MIN_DAYS_FOR_MEAN) {
      values[c] = sum[c] / count[c]
    }
  }
  return values
}

/** Where the Washington grid sits inside a GES DISC product's own grid. */
function planSubset(code) {
  const spec = INSTRUMENT_GRIDS[code]
  const g = gridLayout(code)
  const per = Math.round(spec.cell / spec.native)
  const lat0 = Math.round((g.south + spec.native / 2 - spec.origin[0]) / spec.native)
  const lon0 = Math.round((g.west + spec.native / 2 - spec.origin[1]) / spec.native)
  return {
    per,
    lat0,
    lon0,
    nLat: g.rows * per,
    nLon: g.cols * per,
    firstLat: g.south + spec.native / 2,
    firstLon: g.west + spec.native / 2,
  }
}

/** One month from GES DISC cloud OPeNDAP → one value per grid cell, or null. */
async function readGesdiscMonth(code, ym, plan, token) {
  const spec = INSTRUMENT_GRIDS[code]
  const g = gridLayout(code)
  const granule = spec.granule(ym.slice(0, 4), ym.slice(5, 7))
  const prefix = spec.group ? `/${spec.group}/` : '/'
  const lat = `[${plan.lat0}:${plan.lat0 + plan.nLat - 1}]`
  const lon = `[${plan.lon0}:${plan.lon0 + plan.nLon - 1}]`
  const box = spec.order === 'lat,lon' ? lat + lon : lon + lat
  const ce = [...spec.fields.map((f) => `${prefix}${f}[0:0]${box}`), `${prefix}lat${lat}`, `${prefix}lon${lon}`].join(';')

  const dir = path.join(cacheDir, 'gesdisc')
  const file = path.join(dir, `${granule.replace(/[^\w.-]/g, '_')}__${spec.fields.join('+')}.csv`)
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    const buf = await fetchRetry(
      `${OPENDAP}/collections/${spec.collection}/granules/${encodeURIComponent(granule)}.dap.csv?dap4.ce=${encodeURIComponent(ce)}`,
      4,
      { Authorization: `Bearer ${token}` },
    )
    text = buf ? buf.toString('utf8') : ''
    await mkdir(dir, { recursive: true })
    await writeFile(file, text)
  }
  const values = new Array(g.rows * g.cols).fill(null)
  if (!text) return values

  // Lines look like "/Qs_acc[0][3], v, v, …": the bracket is the index along the first dimension.
  const native = Object.fromEntries(spec.fields.map((f) => [f, new Float64Array(plan.nLat * plan.nLon).fill(NaN)]))
  for (const line of text.split('\n')) {
    const parts = line.split(',')
    const name = parts[0].trim()
    const nums = parts.slice(1).map(Number)
    if (name === `${prefix}lat` || name === `${prefix}lon`) {
      const want = name.endsWith('lat') ? plan.firstLat : plan.firstLon
      if (Math.abs(nums[0] - want) > 1e-3) throw new Error(`${code} ${ym}: grid starts at ${nums[0]}, expected ${want}`)
      continue
    }
    const m = name.match(/^(.*)\[0\]\[(\d+)\]$/)
    const field = m && spec.fields.find((f) => `${prefix}${f}` === m[1])
    if (!field) continue
    const k = Number(m[2])
    nums.forEach((v, i) => {
      const [la, lo] = spec.order === 'lat,lon' ? [k, i] : [i, k]
      native[field][la * plan.nLon + lo] = v
    })
  }

  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      let sum = 0
      let n = 0
      for (let dr = 0; dr < plan.per; dr++) {
        for (let dc = 0; dc < plan.per; dc++) {
          const i = (r * plan.per + dr) * plan.nLon + c * plan.per + dc
          const fields = spec.fields.map((f) => native[f][i])
          if (fields.some((v) => !Number.isFinite(v) || v <= spec.fill)) continue
          sum += spec.convert(fields)
          n += 1
        }
      }
      if (n) values[r * g.cols + c] = sum / n
    }
  }
  return values
}

async function buildVariable(code, token) {
  const spec = INSTRUMENT_GRIDS[code]
  const g = gridLayout(code)
  const months = monthsFrom(spec.first, GRID_END_YEAR)
  let monthValues
  if (spec.via === 'gesdisc') {
    const plan = planSubset(code)
    monthValues = (ym) => readGesdiscMonth(code, ym, plan, token)
    console.log(`${code}: GES DISC ${spec.collection} · ${g.rows} × ${g.cols} cells of ${g.cell}° · ${months.length} months`)
  } else {
    const table = await loadColorTable(COLOR_TABLES[code])
    const plan = planTiles(code)
    monthValues = (ym) => buildMonth(code, ym, plan, table)
    console.log(`${code}: ${spec.layer} · ${g.rows} × ${g.cols} cells of ${g.cell}° · ${months.length} months · ${plan.tiles.length} tile(s) per date`)
  }

  let done = 0
  const byMonth = await inBatches(months, async (ym) => {
    const values = await monthValues(ym)
    done += 1
    if (done % 24 === 0 || done === months.length) console.log(`  ${code}: ${done} / ${months.length} months`)
    return values
  })

  const filled = byMonth.reduce((a, m) => a + m.filter((v) => v != null).length, 0)
  console.log(`  ${code}: ${((100 * filled) / (months.length * g.rows * g.cols)).toFixed(0)}% of cell-months have data`)

  const files = []
  for (let chunk = 0; chunk < g.chunks; chunk++) {
    const rowStart = chunk * g.chunkRows
    const rows = Math.min(g.chunkRows, g.rows - rowStart)
    const data = new Int16Array(rows * g.cols * months.length).fill(GRID_NODATA)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const cell = (rowStart + r) * g.cols + c
        const offset = (r * g.cols + c) * months.length
        for (let m = 0; m < months.length; m++) {
          const v = byMonth[m][cell]
          if (v != null) data[offset + m] = Math.max(-32767, Math.min(32767, Math.round(v * spec.scale)))
        }
      }
    }
    const payload = {
      code,
      source: spec.via === 'gesdisc' ? spec.collection : spec.layer,
      south: g.south,
      west: g.west,
      cell: g.cell,
      rowStart,
      rows,
      cols: g.cols,
      scale: spec.scale,
      months,
      data: Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('base64'),
    }
    files.push([path.join(root, 'public', gridChunkUrl(code, chunk)), JSON.stringify(payload)])
  }
  return files
}

const asked = process.argv.slice(2).map((s) => s.toUpperCase())
const unknownCodes = asked.filter((c) => !INSTRUMENT_GRIDS[c])
if (unknownCodes.length) throw new Error(`Unknown variable(s): ${unknownCodes.join(', ')}. Known: ${INSTRUMENT_GRID_CODES.join(', ')}`)

const token = earthdataToken()
const needsToken = (code) => INSTRUMENT_GRIDS[code].via === 'gesdisc'
if (!token && asked.some(needsToken)) {
  throw new Error(`${asked.filter(needsToken).join(', ')} need an Earthdata Login token: add EARTHDATA_TOKEN=... to .env.local (see the top of this file).`)
}
const codes = (asked.length ? asked : INSTRUMENT_GRID_CODES).filter((code) => {
  if (token || !needsToken(code)) return true
  console.log(`${code}: skipped, no EARTHDATA_TOKEN in .env.local. Its existing files are unchanged.`)
  return false
})

await mkdir(outDir, { recursive: true })
for (const code of codes) {
  // Build everything for a variable first, so a failed download leaves its old files intact.
  const files = await buildVariable(code, token)
  for (const f of await readdir(outDir)) if (f.startsWith(`${code}_`) && f.endsWith('.json')) await rm(path.join(outDir, f))
  for (const [file, body] of files) await writeFile(file, body)
  console.log(`  ${code}: wrote ${files.length} file(s)`)
}
