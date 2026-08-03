/**
 * Generate illustrative equirectangular PNG placeholders for Earth History MVP.
 * Not scientific paleogeography — see bake-paleomaps.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(__dirname, '../../public/geo/earth-history/textures')

/** Denser milestone pack (still illustrative — not a plate model). */
const AGES = [
  4540, 4000, 3500, 2500, 1800, 1000, 750, 541, 485, 443, 419, 359, 299, 252, 201, 174, 145, 100, 66,
  56, 34, 23, 5.3, 2.58, 0.012, 0,
]

function crcTable() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
}
const CRC = crcTable()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4
      const di = rowStart + 1 + x * 4
      raw[di] = rgba[si]
      raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]
      raw[di + 3] = rgba[si + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const compressed = zlib.deflateSync(raw, { level: 9 })
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function landMask(x, y, w, h, ageMa) {
  const u = x / w
  const v = y / h
  // Morphing blobs: older ages = more scattered "proto-continents"
  const drift = ageMa / 4540
  const cx1 = 0.35 + 0.25 * Math.sin(drift * Math.PI * 2)
  const cy1 = 0.45 + 0.1 * Math.cos(drift * 3)
  const cx2 = 0.65 - 0.2 * Math.cos(drift * Math.PI)
  const cy2 = 0.55 - 0.15 * Math.sin(drift * 2)
  const cx3 = 0.5 + 0.3 * Math.sin(drift * 4)
  const cy3 = 0.35 + 0.2 * Math.cos(drift * 1.5)
  const r1 = 0.12 + 0.1 * (1 - drift)
  const r2 = 0.1 + 0.08 * drift
  const r3 = 0.08 + 0.12 * (0.5 - Math.abs(drift - 0.5))
  const d1 = (u - cx1) ** 2 + ((v - cy1) * 1.2) ** 2
  const d2 = (u - cx2) ** 2 + ((v - cy2) * 1.1) ** 2
  const d3 = (u - cx3) ** 2 + ((v - cy3) * 1.3) ** 2
  const noise = hash(x * 12.9898 + y * 78.233 + ageMa) * 0.02
  return d1 < r1 * r1 + noise || d2 < r2 * r2 || d3 < r3 * r3
}

function paint(width, height, ageMa) {
  const rgba = new Uint8Array(width * height * 4)
  const lava = ageMa > 4000
  const ice = ageMa < 3 && ageMa > 0.01
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const land = landMask(x, y, width, height, ageMa)
      const v = y / height
      if (lava && !land) {
        rgba[i] = 40 + Math.floor(hash(x + y) * 30)
        rgba[i + 1] = 20
        rgba[i + 2] = 18
      } else if (land) {
        const g = 70 + Math.floor((1 - ageMa / 4540) * 60)
        rgba[i] = 55 + Math.floor(hash(x * y) * 20)
        rgba[i + 1] = g
        rgba[i + 2] = 45
        if (ice && v < 0.2 || v > 0.85) {
          rgba[i] = 210
          rgba[i + 1] = 220
          rgba[i + 2] = 230
        }
      } else {
        const deep = 20 + Math.floor(v * 40)
        rgba[i] = 15 + deep
        rgba[i + 1] = 40 + deep
        rgba[i + 2] = 90 + Math.floor(deep * 0.5)
      }
      rgba[i + 3] = 255
    }
  }
  return rgba
}

function ageSlug(ageMa) {
  return ageMa === Math.floor(ageMa) ? String(ageMa) : String(ageMa)
}

fs.mkdirSync(OUT, { recursive: true })

for (const age of AGES) {
  const slug = ageSlug(age)
  const full = encodePng(1024, 512, paint(1024, 512, age))
  const mobile = encodePng(512, 256, paint(512, 256, age))
  fs.writeFileSync(path.join(OUT, `ma-${slug}.png`), full)
  fs.writeFileSync(path.join(OUT, `ma-${slug}-m.png`), mobile)
  console.log(`wrote ma-${slug}.png (+ mobile)`)
}

console.log(`Done → ${OUT}`)
