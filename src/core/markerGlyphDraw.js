/**
 * Shared canvas drawing for ATLAS marker SVG glyphs (from glyphCatalog).
 * Stroke Lucide paths; fill MDI/etc. Brand frames stay in the caller.
 */

import { getMarkerGlyph } from '../assets/markers/glyphCatalog.js'

/**
 * @param {string | { d: string, mode?: 'fill'|'stroke', fillRule?: 'evenodd' }} entry
 * @param {'fill'|'stroke'|'mixed'} glyphMode
 * @param {'evenodd'|'nonzero'|undefined} glyphFillRule
 */
function normalizePathEntry(entry, glyphMode, glyphFillRule) {
  if (typeof entry === 'string') {
    return {
      d: entry,
      mode: glyphMode === 'mixed' ? 'fill' : glyphMode,
      fillRule: glyphFillRule === 'evenodd' ? 'evenodd' : 'nonzero',
    }
  }
  return {
    d: entry.d,
    mode: entry.mode || (glyphMode === 'mixed' ? 'fill' : glyphMode) || 'fill',
    fillRule: entry.fillRule === 'evenodd' || glyphFillRule === 'evenodd' ? 'evenodd' : 'nonzero',
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} atlasId — key in MARKER_GLYPHS
 * @param {number} cx
 * @param {number} cy
 * @param {number} s — target half-size in logical px
 * @param {{ color?: string, lineWidth?: number }} [opts]
 * @returns {boolean} whether a glyph was drawn
 */
function drawLetterGlyph(ctx, letters, cx, cy, s, color) {
  const len = letters.length
  const sizeFactor = len <= 2 ? 1.45 : len <= 4 ? 1.0 : 0.72
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `700 ${Math.round(s * sizeFactor)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(letters, cx, cy + s * 0.04)
  ctx.restore()
  return true
}

export function drawMarkerGlyph(ctx, atlasId, cx, cy, s, opts = {}) {
  const color = opts.color || 'rgba(255,255,255,0.95)'
  const glyph = getMarkerGlyph(atlasId)
  const letters = glyph?.letters
    || (atlasId === 'earthquake' ? 'EQ' : null)
    || (atlasId === 'flood' ? 'flood' : null)
  if (letters) return drawLetterGlyph(ctx, letters, cx, cy, s, color)

  if (!glyph?.paths?.length) return false

  const [, , viewW, viewH] = glyph.viewBox
  const scale = (s * 1.9) / Math.max(viewW, viewH)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-viewW / 2, -viewH / 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const entry of glyph.paths) {
    const { d, mode, fillRule } = normalizePathEntry(entry, glyph.mode, glyph.fillRule)
    if (!d) continue
    const path = new Path2D(d)
    if (mode === 'stroke') {
      ctx.strokeStyle = color
      ctx.lineWidth = opts.lineWidth ?? 2.25
      ctx.stroke(path)
    } else {
      ctx.fillStyle = color
      ctx.fill(path, fillRule)
    }
  }

  ctx.restore()
  return true
}

export { getMarkerGlyph }
