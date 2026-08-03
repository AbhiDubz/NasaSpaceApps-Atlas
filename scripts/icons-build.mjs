/**
 * Normalize pulled SVGs → monochrome currentColor assets + glyph catalog.
 *
 * Uses @iconify/tools when available for cleanup/SVGO; falls back to a
 * lightweight regex normalize so the pipeline stays runnable without install.
 *
 * Outputs:
 *   src/assets/markers/*.svg
 *   src/assets/markers/glyphCatalog.js
 *
 * Usage: node scripts/icons-build.mjs
 */

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE_DIR = join(__dirname, '.icon-cache')
const OVERRIDE_DIR = join(__dirname, 'icon-overrides')
const OUT_DIR = join(ROOT, 'src', 'assets', 'markers')

async function loadIconifyTools() {
  try {
    return await import('@iconify/tools')
  } catch {
    console.warn('[icons:build] @iconify/tools not installed — using lightweight normalize')
    return null
  }
}

function parseViewBox(svg) {
  const m = svg.match(/viewBox=["']([^"']+)["']/i)
  if (!m) return { x: 0, y: 0, w: 24, h: 24 }
  const parts = m[1].trim().split(/[\s,]+/).map(Number)
  return {
    x: parts[0] || 0,
    y: parts[1] || 0,
    w: parts[2] || 24,
    h: parts[3] || 24,
  }
}

/** Infer fill vs stroke from the whole SVG (SVGO often puts stroke on <g>). */
function detectDrawMode(svg) {
  const hasStroke = /stroke=["'](?!none)[^"']+["']/i.test(svg)
  const fillNoneDominant = /fill=["']none["']/i.test(svg)
  const hasFillColor = /fill=["'](?!none)[^"']+["']/i.test(svg)
  if (hasStroke && (fillNoneDominant || !hasFillColor)) return 'stroke'
  if (hasFillColor && !hasStroke) return 'fill'
  if (hasStroke) return 'stroke'
  return 'fill'
}

function detectFillRule(svg) {
  return /fill-rule=["']evenodd["']/i.test(svg) || /fillRule=["']evenodd["']/i.test(svg)
    ? 'evenodd'
    : null
}

function circleToPath(cx, cy, r) {
  // Two-arc circle path
  return [
    `M ${cx - r} ${cy}`,
    `a ${r} ${r} 0 1 0 ${r * 2} 0`,
    `a ${r} ${r} 0 1 0 ${-r * 2} 0`,
  ].join(' ')
}

/**
 * Extract drawable paths from SVG (incl. per-path draw mode).
 * @param {string} svg
 * @returns {{ d: string, mode: 'fill'|'stroke', fillRule?: 'evenodd' }[]}
 */
function extractPathData(svg) {
  const paths = []
  const pathRe = /<path\b([^>]*)\/?>/gi
  let match
  while ((match = pathRe.exec(svg)) !== null) {
    const attrs = match[1]
    const d = attrs.match(/\bd=["']([^"']+)["']/i)?.[1]
    if (!d) continue
    const fill = attrs.match(/\bfill=["']([^"']+)["']/i)?.[1]
    const stroke = attrs.match(/\bstroke=["']([^"']+)["']/i)?.[1]
    const fillRuleRaw = attrs.match(/fill-rule=["']([^"']+)["']/i)?.[1]
    const strokeIsPaint = stroke && stroke !== 'none'
    const fillIsPaint = fill && fill !== 'none'
    let mode = 'fill'
    if (strokeIsPaint && !fillIsPaint) mode = 'stroke'
    else if (strokeIsPaint && fill === 'none') mode = 'stroke'
    /** @type {{ d: string, mode: 'fill'|'stroke', fillRule?: 'evenodd' }} */
    const entry = { d: d.replace(/\s+/g, ' ').trim(), mode }
    if (fillRuleRaw === 'evenodd') entry.fillRule = 'evenodd'
    paths.push(entry)
  }

  const circleRe = /<circle\b([^>]*)\/?>/gi
  while ((match = circleRe.exec(svg)) !== null) {
    const attrs = match[1]
    const cx = Number(attrs.match(/\bcx=["']([^"']+)["']/i)?.[1] || 0)
    const cy = Number(attrs.match(/\bcy=["']([^"']+)["']/i)?.[1] || 0)
    const r = Number(attrs.match(/\br=["']([^"']+)["']/i)?.[1] || 0)
    if (r > 0) paths.push({ d: circleToPath(cx, cy, r), mode: 'fill' })
  }

  return paths
}

function lightweightNormalize(svg) {
  let out = svg
  out = out.replace(/\sfill="(?!none)[^"]*"/gi, ' fill="currentColor"')
  out = out.replace(/\sstroke="(?!none)[^"]*"/gi, ' stroke="currentColor"')
  out = out.replace(/\sd="([^"]*)"/gi, (_, d) => ` d="${d.replace(/\s+/g, ' ').trim()}"`)
  return out
}

async function normalizeWithTools(tools, svgRaw) {
  const { SVG, cleanupSVG, parseColors, isEmptyColor, runSVGO } = tools
  const svg = new SVG(svgRaw)
  cleanupSVG(svg)
  await parseColors(svg, {
    defaultColor: 'currentColor',
    callback: (_attr, colorStr, color) => {
      if (!color || isEmptyColor(color)) return colorStr
      return 'currentColor'
    },
  })
  try {
    runSVGO(svg)
  } catch {
    /* SVGO optional */
  }
  return svg.toMinifiedString()
}

async function main() {
  const manifestPath = join(CACHE_DIR, 'manifest.json')
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch {
    console.error('[icons:build] missing cache — run npm run icons:pull first')
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })
  const tools = await loadIconifyTools()
  const catalog = {}

  for (const [atlasId, iconifyId] of Object.entries(manifest)) {
    const overrideFile = join(OVERRIDE_DIR, `${atlasId}.svg`)
    let svgRaw
    let sourceId = iconifyId
    try {
      svgRaw = await readFile(overrideFile, 'utf8')
      sourceId = `override:${atlasId}`
    } catch {
      const [prefix, name] = iconifyId.split(':')
      const cacheFile = join(CACHE_DIR, `${prefix}__${name}.svg`)
      try {
        svgRaw = await readFile(cacheFile, 'utf8')
      } catch {
        console.error(`[icons:build] missing cache file for ${atlasId} (${iconifyId})`)
        process.exitCode = 1
        continue
      }
    }

    let normalized
    if (sourceId.startsWith('override:')) {
      // Keep custom geometry/fill-rule intact; only normalize color tokens.
      normalized = lightweightNormalize(svgRaw)
    } else if (tools) {
      try {
        normalized = await normalizeWithTools(tools, svgRaw)
      } catch (err) {
        console.warn(`[icons:build] tools failed for ${atlasId}, lightweight fallback:`, err.message)
        normalized = lightweightNormalize(svgRaw)
      }
    } else {
      normalized = lightweightNormalize(svgRaw)
    }

    await writeFile(join(OUT_DIR, `${atlasId}.svg`), `${normalized.trim()}\n`, 'utf8')

    const vb = parseViewBox(normalized)
    const extracted = extractPathData(normalized)
    const mode = detectDrawMode(normalized)
    const fillRule = detectFillRule(normalized)
    const textMatch = normalized.match(/<text\b[^>]*>([^<]*)<\/text>/i)
    const letters = textMatch?.[1]?.trim() || ''

    if (!extracted.length && !letters) {
      console.warn(`[icons:build] no drawable geometry in ${atlasId}`)
    }

    if (letters && !extracted.length) {
      catalog[atlasId] = {
        iconifyId: sourceId.startsWith('override:') ? `atlas:${atlasId}` : iconifyId,
        viewBox: [vb.x, vb.y, vb.w, vb.h],
        mode: 'text',
        paths: [],
        letters,
      }
      console.log(`[icons:build] ${atlasId} ← ${sourceId} (text "${letters}")`)
      continue
    }

    const mixed = extracted.some((p) => p.mode !== extracted[0]?.mode)
    const paths = mixed
      ? extracted
      : extracted.map((p) => p.d)
    const glyphFillRule = fillRule || extracted.find((p) => p.fillRule)?.fillRule

    catalog[atlasId] = {
      iconifyId: sourceId.startsWith('override:') ? `atlas:${atlasId}` : iconifyId,
      viewBox: [vb.x, vb.y, vb.w, vb.h],
      mode: mixed ? 'mixed' : mode,
      ...(glyphFillRule ? { fillRule: glyphFillRule } : {}),
      paths,
    }
    console.log(`[icons:build] ${atlasId} ← ${sourceId} (${mixed ? 'mixed' : mode}${glyphFillRule ? `/${glyphFillRule}` : ''}, ${extracted.length} path(s))`)
  }

  const catalogJs = `/**
 * Auto-generated by scripts/icons-build.mjs — do not edit by hand.
 * Regenerate: npm run icons:pull && npm run icons:build
 */

/** @typedef {{ iconifyId: string, viewBox: [number, number, number, number], mode: 'fill'|'stroke'|'mixed', fillRule?: 'evenodd'|'nonzero', paths: Array<string|{ d: string, mode?: 'fill'|'stroke', fillRule?: 'evenodd' }> }} MarkerGlyph */

/** @type {Record<string, MarkerGlyph>} */
export const MARKER_GLYPHS = ${JSON.stringify(catalog, null, 2)}

/** @param {string} atlasId */
export function getMarkerGlyph(atlasId) {
  return MARKER_GLYPHS[atlasId] || null
}
`

  await writeFile(join(OUT_DIR, 'glyphCatalog.js'), catalogJs, 'utf8')

  const files = (await readdir(OUT_DIR)).filter((f) => f.endsWith('.svg'))
  console.log(`[icons:build] wrote ${files.length} SVGs + glyphCatalog.js → ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
