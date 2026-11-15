/**
 * Designed badges for non-hazard signal pins (GDELT events, live cameras).
 *
 * Every badge shares one frame — colored disc, white ring, soft shadow — with
 * a white glyph that says what the pin is. GDELT pins are grouped by their
 * CAMEO root code (e.g. 19 = "Fight") so the map reads as "clashes here,
 * protests there" instead of a field of identical gray circles.
 *
 * Map3D draws a marker sprite at its intrinsic pixel size, so the canvas size
 * IS the on-screen size: severity scales the canvas.
 */

/** @typedef {'violence'|'force'|'threat'|'protest'|'dispute'|'cooperate'|'news'|'camera'} SignalCategory */

export const SIGNAL_CATEGORIES = /** @type {const} */ ({
  violence: { label: 'Armed conflict', color: '#dc2626' },
  force: { label: 'Force / coercion', color: '#ea580c' },
  threat: { label: 'Threat', color: '#d97706' },
  protest: { label: 'Protest', color: '#9333ea' },
  dispute: { label: 'Dispute', color: '#4f46e5' },
  cooperate: { label: 'Diplomacy / cooperation', color: '#16a34a' },
  news: { label: 'News signal', color: '#0d9488' },
  camera: { label: 'Live camera', color: '#1f8fd6' },
})

/** CAMEO root code → badge category. */
const CAMEO_ROOT_CATEGORY = {
  '01': 'cooperate', '02': 'cooperate', '03': 'cooperate', '04': 'cooperate',
  '05': 'cooperate', '06': 'cooperate', '07': 'cooperate', '08': 'cooperate',
  '09': 'cooperate',
  '10': 'dispute', '11': 'dispute', '12': 'dispute', '16': 'dispute',
  '13': 'threat',
  '14': 'protest',
  '15': 'force', '17': 'force',
  '18': 'violence', '19': 'violence', '20': 'violence',
}

/** Badge diameter (px) by severity — also the on-screen size in Map3D. */
const SIZE_BY_SEVERITY = { 1: 28, 2: 30, 3: 34, 4: 38, 5: 42 }
export const CAMERA_BADGE_SIZE = 36

const badgeCache = new Map()

/** @param {object} event */
export function isCameraEvent(event) {
  if (!event) return false
  if (event.cameraProvider) return true
  return Array.isArray(event.tags) && event.tags.includes('camera')
}

/** @param {object} event @returns {string|null} two-digit CAMEO root */
export function cameoRootOf(event) {
  const tags = Array.isArray(event?.tags) ? event.tags : []
  for (const tag of tags) {
    const m = /^cameo(\d{2})$/.exec(String(tag))
    if (m) return m[1]
  }
  return null
}

/**
 * @param {object} event
 * @returns {SignalCategory}
 */
export function classifySignalCategory(event) {
  if (isCameraEvent(event)) return 'camera'
  const root = cameoRootOf(event)
  if (root && CAMEO_ROOT_CATEGORY[root]) return CAMEO_ROOT_CATEGORY[root]
  return 'news'
}

/** @param {SignalCategory} category */
export function signalCategoryColor(category) {
  return (SIGNAL_CATEGORIES[category] || SIGNAL_CATEGORIES.news).color
}

function clampSeverity(severity) {
  const n = Number(severity)
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, Math.round(n)))
}

// ── Drawing ──────────────────────────────────────────────────────────────

const WHITE = '#ffffff'

function traceRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Colored disc + white ring + drop shadow so it lifts off satellite imagery. */
function drawBadgeFrame(ctx, size, fill) {
  const c = size / 2
  const r = c - 2
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.lineWidth = size >= 34 ? 2 : 1.6
  ctx.stroke()
}

function drawExclamation(ctx, x, y, h, color) {
  ctx.fillStyle = color
  const w = Math.max(1.6, h * 0.2)
  traceRoundRect(ctx, x - w / 2, y - h / 2, w, h * 0.62, w / 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y + h * 0.36, w * 0.62, 0, Math.PI * 2)
  ctx.fill()
}

/** Speech bubble body; returns its vertical center. */
function drawSpeechBubble(ctx, c, g) {
  const w = g * 2
  const h = g * 1.45
  const x = c - g
  const y = c - g * 0.9
  ctx.fillStyle = WHITE
  traceRoundRect(ctx, x, y, w, h, g * 0.35)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x + w * 0.24, y + h - 0.5)
  ctx.lineTo(x + w * 0.2, y + h + g * 0.45)
  ctx.lineTo(x + w * 0.48, y + h - 0.5)
  ctx.closePath()
  ctx.fill()
  return y + h / 2
}

/** @type {Record<SignalCategory, (ctx: CanvasRenderingContext2D, c: number, g: number, fill: string) => void>} */
const GLYPHS = {
  // Explosion burst — armed clashes, assaults, mass violence
  violence(ctx, c, g) {
    const points = 8
    ctx.beginPath()
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? g * 1.05 : g * 0.5
      const a = (Math.PI / points) * i - Math.PI / 2
      const px = c + Math.cos(a) * rad
      const py = c + Math.sin(a) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fillStyle = WHITE
    ctx.fill()
  },

  // Shield — shows of force, coercion
  force(ctx, c, g) {
    const top = c - g * 1.0
    const bottom = c + g * 1.05
    const half = g * 0.85
    ctx.beginPath()
    ctx.moveTo(c, top)
    ctx.quadraticCurveTo(c + half * 0.55, top + g * 0.28, c + half, top + g * 0.18)
    ctx.lineTo(c + half, c + g * 0.05)
    ctx.quadraticCurveTo(c + half * 0.85, bottom - g * 0.45, c, bottom)
    ctx.quadraticCurveTo(c - half * 0.85, bottom - g * 0.45, c - half, c + g * 0.05)
    ctx.lineTo(c - half, top + g * 0.18)
    ctx.quadraticCurveTo(c - half * 0.55, top + g * 0.28, c, top)
    ctx.closePath()
    ctx.fillStyle = WHITE
    ctx.fill()
  },

  // Warning triangle — threats
  threat(ctx, c, g, fill) {
    const top = c - g * 1.0
    const base = c + g * 0.8
    ctx.beginPath()
    ctx.moveTo(c, top)
    ctx.lineTo(c + g * 1.1, base)
    ctx.lineTo(c - g * 1.1, base)
    ctx.closePath()
    ctx.lineJoin = 'round'
    ctx.lineWidth = g * 0.22
    ctx.strokeStyle = WHITE
    ctx.fillStyle = WHITE
    ctx.fill()
    ctx.stroke()
    drawExclamation(ctx, c, c + g * 0.12, g * 1.05, fill)
  },

  // Megaphone — protests
  protest(ctx, c, g) {
    ctx.fillStyle = WHITE
    // mouthpiece / handle
    traceRoundRect(ctx, c - g * 1.0, c - g * 0.32, g * 0.55, g * 0.64, g * 0.12)
    ctx.fill()
    // horn
    ctx.beginPath()
    ctx.moveTo(c - g * 0.5, c - g * 0.36)
    ctx.lineTo(c + g * 0.85, c - g * 0.95)
    ctx.lineTo(c + g * 0.85, c + g * 0.95)
    ctx.lineTo(c - g * 0.5, c + g * 0.36)
    ctx.closePath()
    ctx.fill()
    // grip
    ctx.fillRect(c - g * 0.42, c + g * 0.3, g * 0.26, g * 0.6)
  },

  // Speech bubble with "!" — demands, rejections, downgraded relations
  dispute(ctx, c, g, fill) {
    const cy = drawSpeechBubble(ctx, c, g)
    drawExclamation(ctx, c, cy, g * 1.0, fill)
  },

  // Speech bubble with dots — statements, consultation, aid, cooperation
  cooperate(ctx, c, g, fill) {
    const cy = drawSpeechBubble(ctx, c, g)
    ctx.fillStyle = fill
    for (const dx of [-0.52, 0, 0.52]) {
      ctx.beginPath()
      ctx.arc(c + g * dx, cy, g * 0.17, 0, Math.PI * 2)
      ctx.fill()
    }
  },

  // Newspaper — article-level GDELT signals without a CAMEO code
  news(ctx, c, g, fill) {
    const w = g * 1.8
    const h = g * 1.9
    const x = c - w / 2
    const y = c - h / 2
    ctx.fillStyle = WHITE
    traceRoundRect(ctx, x, y, w, h, g * 0.22)
    ctx.fill()
    ctx.fillStyle = fill
    const pad = g * 0.3
    ctx.fillRect(x + pad, y + pad, w - pad * 2, g * 0.34)
    const lineH = Math.max(1, g * 0.14)
    for (const fy of [0.48, 0.66, 0.84]) {
      ctx.fillRect(x + pad, y + h * fy - lineH / 2, w - pad * 2, lineH)
    }
  },

  // Video camera with a red "recording" dot — live CCTV / webcams
  camera(ctx, c, g) {
    const bodyW = g * 1.4
    const bodyH = g * 1.08
    const wedgeW = g * 0.62
    const glyphW = bodyW + 1 + wedgeW
    const bx = c - glyphW / 2
    const by = c - bodyH / 2
    ctx.fillStyle = WHITE
    traceRoundRect(ctx, bx, by, bodyW, bodyH, g * 0.22)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(bx + bodyW + 1, c - bodyH * 0.12)
    ctx.lineTo(bx + glyphW, c - bodyH * 0.48)
    ctx.lineTo(bx + glyphW, c + bodyH * 0.48)
    ctx.lineTo(bx + bodyW + 1, c + bodyH * 0.12)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.arc(bx + bodyW * 0.3, c, g * 0.17, 0, Math.PI * 2)
    ctx.fillStyle = '#ff4d4f'
    ctx.fill()
  },
}

function renderBadge(category, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const fill = signalCategoryColor(category)
  drawBadgeFrame(ctx, size, fill)
  const glyph = GLYPHS[category] || GLYPHS.news
  glyph(ctx, size / 2, size * 0.26, fill)
  return canvas.toDataURL('image/png')
}

/**
 * Cached PNG data URL for a category badge.
 * @param {SignalCategory} category
 * @param {number} [severity] ignored for cameras (fixed size — ambient context)
 */
export function getSignalBadgeIconUrl(category, severity = 3) {
  const cat = SIGNAL_CATEGORIES[category] ? category : 'news'
  const size = cat === 'camera' ? CAMERA_BADGE_SIZE : SIZE_BY_SEVERITY[clampSeverity(severity)]
  const key = `badge-v1:${cat}:${size}`
  if (badgeCache.has(key)) return badgeCache.get(key)
  const url = renderBadge(cat, size)
  badgeCache.set(key, url)
  return url
}

/** Pre-render every category × size (cheap: ~40 tiny canvases). */
export function warmSignalBadgeCache() {
  for (const cat of Object.keys(SIGNAL_CATEGORIES)) {
    if (cat === 'camera') {
      getSignalBadgeIconUrl(cat)
      continue
    }
    for (const sev of [1, 2, 3, 4, 5]) getSignalBadgeIconUrl(cat, sev)
  }
}
