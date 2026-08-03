/**
 * Pre-warmed marker icon cache.
 *
 * Pipeline: classify → lookup cached PNG data URL → attach to event before globe.
 * Globe renderers read `event.markerIconUrl` only — no runtime sprite generation.
 */

import { DIMENSIONS } from './eventSchema.js'
import {
  classifyEnvironmentHazard,
  eventDimension,
  HAZARD_TYPES,
  HAZARD_TYPE_VALUES,
} from './environmentHazardClassifier.js'
import { resolveHazardFill, resolveHazardFillAlpha, resolveSignalFill } from './hazardColors.js'
import { drawHazardMarker } from './environmentHazardIcons.js'
import { warmArchetypeIconCache } from './archetypeIcons.js'

const ICON_SIZE = 64
const HALF = ICON_SIZE / 2
const CACHE_VERSION = 'marker-v14'
const SEVERITIES = [1, 2, 3, 4, 5]

const hazardIconUrls = new Map()
const dimensionIconUrls = new Map()
let cacheReady = false

function clampSeverity(severity) {
  const n = Number(severity)
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, Math.round(n)))
}

function renderCanvasToDataUrl(draw, size = ICON_SIZE) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  draw(ctx, size)
  return canvas.toDataURL('image/png')
}

function buildHazardIconUrl(hazardType, severity = 3) {
  const sev = clampSeverity(severity)
  const type = hazardType || HAZARD_TYPES.STORM
  const key = `${CACHE_VERSION}:hazard:${type}:s${sev}`
  if (hazardIconUrls.has(key)) return hazardIconUrls.get(key)

  const fill = resolveHazardFillAlpha(type, sev)
  const url = renderCanvasToDataUrl((ctx, size) => {
    const scale = size / ICON_SIZE
    ctx.save()
    ctx.scale(scale, scale)
    drawHazardMarker(ctx, type, HALF, HALF, fill)
    ctx.restore()
  })

  hazardIconUrls.set(key, url)
  return url
}

/** Unlabeled signal disc — muted slate, severity-darkened. */
function buildDimensionIconUrl(severity = 3) {
  const sev = clampSeverity(severity)
  const key = `${CACHE_VERSION}:dim:signal:s${sev}`
  if (dimensionIconUrls.has(key)) return dimensionIconUrls.get(key)

  const hex = resolveSignalFill(sev)
  const url = renderCanvasToDataUrl((ctx, size) => {
    const scale = size / ICON_SIZE
    ctx.save()
    ctx.scale(scale, scale)
    ctx.beginPath()
    ctx.arc(HALF, HALF, HALF - 6, 0, Math.PI * 2)
    ctx.fillStyle = `${hex}cc`
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  })

  dimensionIconUrls.set(key, url)
  return url
}

/** Pre-generate every hazard×severity + non-environment severity icon. Call once at startup. */
export function warmMarkerIconCache() {
  if (cacheReady) return
  for (const hazard of HAZARD_TYPE_VALUES) {
    for (const sev of SEVERITIES) {
      buildHazardIconUrl(hazard, sev)
    }
  }
  for (const sev of SEVERITIES) {
    buildDimensionIconUrl(sev)
  }
  warmArchetypeIconCache()
  cacheReady = true
}

export function isMarkerIconCacheReady() {
  return cacheReady
}

export function getHazardMarkerIconUrl(hazardType, severity = 3) {
  warmMarkerIconCache()
  return buildHazardIconUrl(hazardType || HAZARD_TYPES.STORM, severity)
}

/** Generic unlabeled signal pin — dimension glyphs are not user-facing. */
export function getDimensionMarkerIconUrl(severity = 3) {
  warmMarkerIconCache()
  return buildDimensionIconUrl(severity)
}

/**
 * Classify (if needed) and attach cached markerIconUrl to a single event.
 * @param {object} event
 * @returns {object}
 */
export function enrichEventMarkerVisuals(event) {
  if (!event) return event

  const dimension = eventDimension(event)
  const environmentHazard = dimension === DIMENSIONS.ENVIRONMENT
    ? (event.environmentHazard || classifyEnvironmentHazard(event))
    : null
  const severity = clampSeverity(event.severity)

  const markerIconUrl = dimension === DIMENSIONS.ENVIRONMENT
    ? getHazardMarkerIconUrl(environmentHazard, severity)
    : getDimensionMarkerIconUrl(severity)

  const color = dimension === DIMENSIONS.ENVIRONMENT
    ? resolveHazardFill(environmentHazard, severity)
    : resolveSignalFill(severity)

  if (
    event.environmentHazard === environmentHazard
    && event.markerIconUrl === markerIconUrl
    && event.color === color
  ) {
    return event
  }

  return { ...event, environmentHazard, markerIconUrl, color }
}

/** @param {object[]} events */
export function enrichEventsMarkerVisuals(events) {
  if (!Array.isArray(events) || events.length === 0) return events
  warmMarkerIconCache()
  return events.map(enrichEventMarkerVisuals)
}

/** @param {object} diff — eventBus batch diff */
export function enrichBatchDiffMarkerVisuals(diff) {
  if (!diff) return diff
  warmMarkerIconCache()

  if (diff.snapshot) {
    return { snapshot: enrichEventsMarkerVisuals(diff.snapshot) }
  }

  const out = { ...diff }
  if (out.added?.length) out.added = enrichEventsMarkerVisuals(out.added)
  if (out.updated?.length) out.updated = enrichEventsMarkerVisuals(out.updated)
  return out
}
