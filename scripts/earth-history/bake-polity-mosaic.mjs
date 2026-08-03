/**
 * Bake a province mosaic from existing Cliopatria year-slices.
 *
 * Reads public/geo/earth-history/polities/y-*.json
 * Writes:
 *   polities/mosaic.json          — shared geometry keyed by stable id
 *   polities/attrs/y-*.json       — per-year feature attributes
 *
 * Pragmatic mode: geometry from a reference year (default 1000 CE);
 * attrs for all existing slices matched by name → stable id.
 *
 * Usage:
 *   node scripts/earth-history/bake-polity-mosaic.mjs
 *   node scripts/earth-history/bake-polity-mosaic.mjs --ref 1000 --sample 20
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const POLITIES = path.resolve(ROOT, 'public/geo/earth-history/polities')
const ATTRS = path.join(POLITIES, 'attrs')

const CITATION =
  'Cliopatria (Seshat Global History Databank) — CC BY 4.0. Mosaic bake for Earth History.'

function parseArgs(argv) {
  const out = { ref: 1000, sample: 0 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--ref' && argv[i + 1]) out.ref = Number(argv[++i])
    if (argv[i] === '--sample' && argv[i + 1]) out.sample = Number(argv[++i])
  }
  return out
}

function stableId(name) {
  const s = String(name || 'unknown')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `p_${(h >>> 0).toString(36)}`
}

function yearFromFilename(name) {
  const m = name.match(/^y-(bce)?(\d+)\.json$/)
  if (!m) return null
  const n = Number(m[2])
  return m[1] ? -n : n
}

function listYearFiles() {
  if (!fs.existsSync(POLITIES)) return []
  return fs
    .readdirSync(POLITIES)
    .filter((f) => /^y-(bce)?\d+\.json$/.test(f))
    .map((f) => ({ file: f, year: yearFromFilename(f), path: path.join(POLITIES, f) }))
    .filter((x) => x.year != null)
    .sort((a, b) => a.year - b.year)
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function attrsForFeature(props, id) {
  return {
    name: props.name || id,
    color: props.color,
    wiki: props.wikipedia || props.wiki || '',
    ruler: props.name || id,
    religion: props.religion || '',
    culture: props.culture || '',
    population: props.areaKm2 ? Math.round(props.areaKm2 * 2.5) : null,
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const files = listYearFiles()
  if (!files.length) {
    console.error('No polity year slices found in', POLITIES)
    process.exit(1)
  }

  let selected = files
  if (args.sample > 0 && files.length > args.sample) {
    const step = Math.max(1, Math.floor(files.length / args.sample))
    selected = files.filter((_, i) => i % step === 0)
    if (!selected.find((f) => f.year === args.ref)) {
      const refFile = files.find((f) => f.year === args.ref)
      if (refFile) selected.push(refFile)
      selected.sort((a, b) => a.year - b.year)
    }
  }

  const ref =
    files.find((f) => f.year === args.ref) ||
    files.find((f) => f.year === 1000) ||
    files[Math.floor(files.length / 2)]

  console.log(`Reference geometry year: ${ref.year} (${ref.file})`)
  console.log(`Attr years: ${selected.length} of ${files.length}`)

  const refFc = loadJson(ref.path)
  const idByName = new Map()
  const mosaicFeatures = []
  const labels = []

  for (const f of refFc.features || []) {
    const name = f.properties?.name
    if (!name) continue
    const id = f.properties?.id || stableId(name)
    idByName.set(name, id)
    mosaicFeatures.push({
      type: 'Feature',
      id,
      properties: {
        id,
        name,
        wikipedia: f.properties?.wikipedia || '',
      },
      geometry: f.geometry,
    })
  }

  for (const l of refFc.labels || []) {
    const id = idByName.get(l.name) || stableId(l.name)
    labels.push({ ...l, id })
  }

  fs.mkdirSync(ATTRS, { recursive: true })

  const frames = []
  for (const entry of selected) {
    const fc = entry.path === ref.path ? refFc : loadJson(entry.path)
    const features = {}

    for (const f of fc.features || []) {
      const name = f.properties?.name
      if (!name) continue
      let id = idByName.get(name)
      if (!id) {
        id = f.properties?.id || stableId(name)
        idByName.set(name, id)
        // Geometry only from reference year — attrs-only for other names
      }
      features[id] = attrsForFeature(f.properties || {}, id)
    }

    const outName = entry.year < 0 ? `y-bce${Math.abs(entry.year)}.json` : `y-${entry.year}.json`
    const outPath = path.join(ATTRS, outName)
    fs.writeFileSync(
      outPath,
      JSON.stringify({
        year: entry.year,
        features,
      }),
    )
    frames.push({
      year: entry.year,
      path: `/geo/earth-history/polities/attrs/${outName}`,
    })
    console.log(`  attrs ${outName} (${Object.keys(features).length} features)`)
  }

  const mosaic = {
    type: 'FeatureCollection',
    properties: {
      source: 'cliopatria-mosaic',
      citation: CITATION,
      refYear: ref.year,
      count: mosaicFeatures.length,
      frames,
    },
    features: mosaicFeatures,
    labels,
  }

  const mosaicPath = path.join(POLITIES, 'mosaic.json')
  fs.writeFileSync(mosaicPath, JSON.stringify(mosaic))
  console.log(
    `Wrote mosaic.json (${mosaicFeatures.length} geometries, ${frames.length} attr years)`,
  )
}

main()
