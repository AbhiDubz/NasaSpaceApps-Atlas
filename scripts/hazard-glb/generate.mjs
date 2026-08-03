/**
 * Generate pin-shaped hazard GLBs for ATLAS Map3D Model3D markers.
 *
 * Pipeline inspired by wangyz1999/3d-emoji-assets-generator (MIT):
 * pin base + Three.js + GLTFExporter. Colors follow Twemoji hazard families
 * (Twemoji CC-BY 4.0 mapping in manifest.json / environmentHazardEffects.js).
 *
 * Usage: node scripts/hazard-glb/generate.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// Three GLTFExporter uses FileReader.onloadend for binary GLB assembly.
globalThis.FileReader = class FileReader {
  constructor() {
    this.result = null
    this.onload = null
    this.onloadend = null
    this.onerror = null
    this.readyState = 0
  }
  readAsArrayBuffer(blob) {
    const finish = (buf) => {
      this.readyState = 2
      this.result = buf
      this.onload?.({ target: this })
      this.onloadend?.({ target: this })
    }
    if (blob == null) {
      finish(new ArrayBuffer(0))
      return
    }
    if (typeof blob.arrayBuffer === 'function') {
      Promise.resolve(blob.arrayBuffer())
        .then((buf) => finish(buf))
        .catch((err) => this.onerror?.(err))
      return
    }
    finish(new ArrayBuffer(0))
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const OUT_DIR = path.join(ROOT, 'public/models/hazards')
const MANIFEST = path.join(__dirname, 'manifest.json')

/** Accent colors aligned with Twemoji hazard families. */
const MODEL_COLORS = {
  fire: 0xff6b2e,
  volcano: 0xc45c2a,
  cyclone: 0x5b8def,
  tornado: 0x6b7c93,
  ocean: 0x2e8bc9,
  cloud_with_rain: 0x6a8fad,
  fog: 0xb8a88a,
  snowflake: 0xd8eef8,
  zap: 0xf5d547,
  sun: 0xffb020,
  thermometer: 0xe85d4c,
  mountain: 0x8b9a7a,
  collision: 0xe8a838,
  cloud_with_lightning: 0x7a8fa8,
}

const STEM_COLOR = 0x3d6b1a
const RING_COLOR = 0x5a8f2e

function createPinGroup(accentHex) {
  const group = new THREE.Group()
  group.name = 'hazardPin'

  const headGeo = new THREE.SphereGeometry(0.55, 28, 20)
  const headMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    metalness: 0.18,
    roughness: 0.42,
    emissive: accentHex,
    emissiveIntensity: 0.12,
  })
  const head = new THREE.Mesh(headGeo, headMat)
  head.position.y = 0.85
  group.add(head)

  const discGeo = new THREE.CircleGeometry(0.32, 24)
  const discMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.55,
    side: THREE.DoubleSide,
  })
  const disc = new THREE.Mesh(discGeo, discMat)
  disc.position.set(0, 0.85, 0.52)
  group.add(disc)

  const ringGeo = new THREE.TorusGeometry(0.58, 0.045, 10, 40)
  const ringMat = new THREE.MeshStandardMaterial({
    color: RING_COLOR,
    metalness: 0.2,
    roughness: 0.4,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.y = 0.85
  ring.rotation.x = Math.PI / 2
  group.add(ring)

  const stemGeo = new THREE.ConeGeometry(0.22, 0.95, 14)
  const stemMat = new THREE.MeshStandardMaterial({
    color: STEM_COLOR,
    metalness: 0.1,
    roughness: 0.55,
  })
  const stem = new THREE.Mesh(stemGeo, stemMat)
  stem.position.y = 0.12
  stem.rotation.x = Math.PI
  group.add(stem)

  group.updateMatrixWorld(true)
  return group
}

function exportGlb(object) {
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result))
        else reject(new Error('Expected binary GLB ArrayBuffer'))
      },
      (err) => reject(err),
      { binary: true, onlyVisible: true },
    )
  })
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'))
  await mkdir(OUT_DIR, { recursive: true })

  for (const entry of manifest.models) {
    process.stdout.write(`Generating ${entry.modelId}… `)
    const accent = MODEL_COLORS[entry.modelId] ?? 0x7cb342
    const group = createPinGroup(accent)
    const glb = await exportGlb(group)
    const outPath = path.join(OUT_DIR, `${entry.modelId}.glb`)
    await writeFile(outPath, glb)
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
    console.log(`${(glb.length / 1024).toFixed(1)} KB`)
  }

  await writeFile(
    path.join(OUT_DIR, 'ATTRIBUTION.txt'),
    [
      'ATLAS environment hazard 3D pins',
      '',
      'Hazard ↔ emoji mapping follows Twemoji shortnames (jdecked/twemoji).',
      'Twemoji graphics: CC-BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
      'Copyright © Twitter, Inc and other contributors',
      '',
      'Pipeline inspired by wangyz1999/3d-emoji-assets-generator (MIT)',
      'https://github.com/wangyz1999/3d-emoji-assets-generator',
      'GLBs: Three.js pin mesh + GLTFExporter (family accent colors).',
      'L0 sprites continue to use ATLAS Lucide/Iconify hazard glyphs.',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
    ].join('\n'),
  )

  console.log(`Done → ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
