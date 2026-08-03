/**
 * Tactical track sprites — ATLAS marker pack glyphs (npm run icons)
 * with heading/COG rotation. Brand colors stay local to each track kind.
 */

import { getMarkerGlyph } from '../assets/markers/glyphCatalog.js'

const spriteCache = new Map()

const AIRCRAFT_COLORS = {
  // Cool slate — quiet on satellite imagery; military stays distinct (amber)
  civilian: { fill: '#a8b4c2', stroke: 'rgba(168, 180, 194, 0.32)' },
  military: { fill: '#c47a52', stroke: 'rgba(196, 122, 82, 0.35)' },
}

/**
 * Draw a catalog glyph centered at origin (caller applies translate/rotate).
 * Lucide plane noses roughly +X; we rotate -90° so 0° track = north.
 */
function drawGlyphAtOrigin(ctx, atlasId, size, color, strokeColor) {
  const glyph = getMarkerGlyph(atlasId)
  if (!glyph?.paths?.length) return false

  const [, , viewW, viewH] = glyph.viewBox
  const scale = (size * 0.78) / Math.max(viewW, viewH)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(-viewW / 2, -viewH / 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of glyph.paths) {
    const path = new Path2D(d)
    if (glyph.mode === 'stroke') {
      ctx.strokeStyle = color
      ctx.lineWidth = 2.4
      ctx.stroke(path)
      if (strokeColor) {
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 3.2
        ctx.globalAlpha = 0.45
        ctx.stroke(path)
        ctx.globalAlpha = 1
      }
    } else {
      ctx.fillStyle = color
      ctx.fill(path)
      if (strokeColor) {
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 1.5
        ctx.stroke(path)
      }
    }
  }
  ctx.restore()
  return true
}

/**
 * Aircraft marker from ATLAS plane glyph, oriented by true track (degrees).
 * @param {number} trackDeg — heading in degrees (0 = north)
 * @param {boolean} [military=false]
 * @param {number} [size=24]
 * @returns {string} data URL
 */
export function aircraftSpriteDataUrl(trackDeg = 0, military = false, size = 24) {
  const key = `ac-quiet-${Math.round(trackDeg)}-${military ? 'm' : 'c'}-${size}`
  if (spriteCache.has(key)) return spriteCache.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const palette = military ? AIRCRAFT_COLORS.military : AIRCRAFT_COLORS.civilian

  ctx.save()
  ctx.translate(cx, cy)
  // Lucide plane faces +X; rotate so 0° = north (-Y)
  ctx.rotate((((trackDeg || 0) - 90) * Math.PI) / 180)
  const ok = drawGlyphAtOrigin(ctx, 'aircraft', size, palette.fill, palette.stroke)
  if (!ok) {
    // Minimal chevron fallback
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.4)
    ctx.lineTo(size * 0.28, size * 0.35)
    ctx.lineTo(0, size * 0.15)
    ctx.lineTo(-size * 0.28, size * 0.35)
    ctx.closePath()
    ctx.fillStyle = palette.fill
    ctx.fill()
  }
  ctx.restore()

  const url = canvas.toDataURL('image/png')
  spriteCache.set(key, url)
  return url
}

/**
 * Small satellite sprite from ATLAS satellite glyph.
 * @param {boolean} [military=false]
 * @param {number} [size=14]
 * @returns {string}
 */
export function satelliteSpriteDataUrl(military = false, size = 14) {
  const key = `sat-pack-${military ? 'm' : 'c'}-${size}`
  if (spriteCache.has(key)) return spriteCache.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const color = military ? '#ff6b35' : '#c8ff00'

  ctx.save()
  ctx.translate(cx, cy)
  const ok = drawGlyphAtOrigin(ctx, 'satellite', size, color, null)
  if (!ok) {
    const r = size * 0.35
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()

  const url = canvas.toDataURL('image/png')
  spriteCache.set(key, url)
  return url
}

/**
 * Ship/vessel sprite from ATLAS ship glyph, oriented by course over ground.
 * @param {number} cogDeg — course in degrees (0 = north)
 * @param {number} [size=22]
 * @returns {string} data URL
 */
export function vesselSpriteDataUrl(cogDeg = 0, size = 22) {
  const key = `vsl-pack-${Math.round(cogDeg)}-${size}`
  if (spriteCache.has(key)) return spriteCache.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const fill = '#4dd4ff'
  const stroke = 'rgba(77, 212, 255, 0.45)'

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((((cogDeg || 0) - 90) * Math.PI) / 180)
  const ok = drawGlyphAtOrigin(ctx, 'vessel', size, fill, stroke)
  if (!ok) {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.4)
    ctx.lineTo(size * 0.28, size * 0.35)
    ctx.lineTo(0, size * 0.22)
    ctx.lineTo(-size * 0.28, size * 0.35)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
  ctx.restore()

  const url = canvas.toDataURL('image/png')
  spriteCache.set(key, url)
  return url
}

/**
 * Detection reticle overlay sprite (CSS/SVG-style ring baked to canvas).
 * @param {number} [size=32]
 * @returns {string}
 */
export function reticleSpriteDataUrl(size = 32) {
  const key = `ret-${size}`
  if (spriteCache.has(key)) return spriteCache.get(key)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38

  ctx.strokeStyle = 'rgba(0, 255, 170, 0.75)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  const tick = size * 0.08
  ctx.beginPath()
  ctx.moveTo(cx, cy - r - tick)
  ctx.lineTo(cx, cy - r + tick)
  ctx.moveTo(cx, cy + r - tick)
  ctx.lineTo(cx, cy + r + tick)
  ctx.moveTo(cx - r - tick, cy)
  ctx.lineTo(cx - r + tick, cy)
  ctx.moveTo(cx + r - tick, cy)
  ctx.lineTo(cx + r + tick, cy)
  ctx.stroke()

  const url = canvas.toDataURL('image/png')
  spriteCache.set(key, url)
  return url
}
