/**
 * Environment hazard icon drawing — canvas frames + ATLAS marker SVG glyphs.
 * Classification lives in environmentHazardClassifier.js;
 * cached URLs live in markerIconCache.js.
 * Glyphs: src/assets/markers/ (npm run icons).
 */

import { HAZARD_TYPES, HAZARD_BORDER_SHAPE as BORDER_SHAPE } from './environmentHazardClassifier.js'
import { drawMarkerGlyph } from './markerGlyphDraw.js'

export { HAZARD_TYPES } from './environmentHazardClassifier.js'
export { classifyEnvironmentHazard, resolveHazardType } from './environmentHazardClassifier.js'

/** Hazard type → atlas marker glyph id (manifest role). */
const HAZARD_GLYPH_ID = {
  [HAZARD_TYPES.EARTHQUAKE]: 'earthquake',
  [HAZARD_TYPES.WILDFIRE]: 'wildfire',
  [HAZARD_TYPES.HURRICANE]: 'hurricane',
  [HAZARD_TYPES.DUSTSTORM]: 'duststorm',
  [HAZARD_TYPES.LIGHTNING]: 'lightning',
  [HAZARD_TYPES.TORNADO]: 'tornado',
  [HAZARD_TYPES.FLOOD]: 'flood',
  [HAZARD_TYPES.AVALANCHE]: 'avalanche',
  [HAZARD_TYPES.VOLCANO]: 'volcano',
  [HAZARD_TYPES.TSUNAMI]: 'tsunami',
  [HAZARD_TYPES.TYPHOON]: 'typhoon',
  [HAZARD_TYPES.MONSOON]: 'monsoon',
  [HAZARD_TYPES.DROUGHT]: 'drought',
  [HAZARD_TYPES.STORM]: 'storm',
  [HAZARD_TYPES.BLIZZARD]: 'blizzard',
  [HAZARD_TYPES.HEATWAVE]: 'heatwave',
}

function traceShape(ctx, shape, cx, cy, r) {
  ctx.beginPath()
  switch (shape) {
    case 'diamond':
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r, cy)
      ctx.closePath()
      break
    case 'triangle':
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r * 0.92, cy + r * 0.82)
      ctx.lineTo(cx - r * 0.92, cy + r * 0.82)
      ctx.closePath()
      break
    case 'square':
      ctx.rect(cx - r * 0.82, cy - r * 0.82, r * 1.64, r * 1.64)
      break
    case 'hexagon': {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i - Math.PI / 2
        const x = cx + r * Math.cos(a)
        const y = cy + r * Math.sin(a)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      break
    }
    default:
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
  }
}

function drawBorderShape(ctx, shape, cx, cy, r, fill, stroke) {
  traceShape(ctx, shape, cx, cy, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.stroke()
}

/**
 * Draw a hazard marker sprite onto a canvas context (64×64 logical space).
 * Brand frame (shape + fill) stays ATLAS-owned; inner glyph from icon pack.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} hazardType
 * @param {number} cx
 * @param {number} cy
 * @param {string} fillColor — dimension fill
 */
export function drawHazardMarker(ctx, hazardType, cx, cy, fillColor) {
  const shape = BORDER_SHAPE[hazardType] || 'circle'
  const r = 26
  drawBorderShape(ctx, shape, cx, cy, r, fillColor, 'rgba(255,255,255,0.55)')

  const glyphId = HAZARD_GLYPH_ID[hazardType] || 'storm'
  const drawn = drawMarkerGlyph(ctx, glyphId, cx, cy, 11, {
    color: 'rgba(255,255,255,0.95)',
    lineWidth: 2.1,
  })
  if (!drawn) {
    // Fallback disc so a missing glyph never yields a blank pin
    ctx.beginPath()
    ctx.arc(cx, cy, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fill()
  }
}
