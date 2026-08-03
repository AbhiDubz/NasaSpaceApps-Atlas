/**
 * Per-hazard color families + severity shading for globe markers.
 * Hue/saturation identify type; higher severity → darker lightness.
 * Keys match HAZARD_TYPES values in environmentHazardClassifier.js.
 */

/** @typedef {{ h: number, s: number }} HslFamily */

/** Minimal mute palettes — one family per hazard type. */
export const HAZARD_COLOR_FAMILY = {
  wildfire: { h: 6, s: 66 },
  volcano: { h: 14, s: 60 },
  earthquake: { h: 34, s: 56 },
  avalanche: { h: 210, s: 26 },
  hurricane: { h: 212, s: 46 },
  typhoon: { h: 218, s: 44 },
  tornado: { h: 224, s: 38 },
  tsunami: { h: 196, s: 50 },
  storm: { h: 205, s: 40 },
  flood: { h: 188, s: 46 },
  monsoon: { h: 174, s: 38 },
  duststorm: { h: 38, s: 32 },
  heatwave: { h: 22, s: 58 },
  drought: { h: 42, s: 36 },
  lightning: { h: 232, s: 30 },
  blizzard: { h: 200, s: 20 },
}

const DEFAULT_FAMILY = { h: 205, s: 36 }

/** Severity 1 (lightest) → 5 (darkest). */
const SEVERITY_LIGHTNESS = Object.freeze([58, 50, 42, 34, 26])

function clampSeverity(severity) {
  const n = Number(severity)
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, Math.round(n)))
}

function hslToHex(h, s, l) {
  const sat = s / 100
  const light = l / 100
  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = light - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Solid hex fill for a hazard marker at a given severity.
 * @param {string|null|undefined} hazardType
 * @param {number} [severity]
 * @returns {string} #rrggbb
 */
export function resolveHazardFill(hazardType, severity = 3) {
  const family = HAZARD_COLOR_FAMILY[hazardType] || DEFAULT_FAMILY
  const sev = clampSeverity(severity)
  const lightness = SEVERITY_LIGHTNESS[sev - 1]
  return hslToHex(family.h, family.s, lightness)
}

/**
 * Canvas fill with alpha suffix (e.g. #c44a3acc).
 * @param {string|null|undefined} hazardType
 * @param {number} [severity]
 * @param {string} [alphaHex] two-digit hex alpha
 */
export function resolveHazardFillAlpha(hazardType, severity = 3, alphaHex = 'cc') {
  return `${resolveHazardFill(hazardType, severity)}${alphaHex}`
}

/** Non-hazard signal pins — muted slate, darker with severity. */
const SIGNAL_LADDER = Object.freeze(['#7a8fa3', '#667d94', '#536b82', '#42586d', '#34485a'])

/**
 * @param {number} [severity]
 * @returns {string} #rrggbb
 */
export function resolveSignalFill(severity = 3) {
  return SIGNAL_LADDER[clampSeverity(severity) - 1]
}
