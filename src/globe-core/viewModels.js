/**
 * globe-core/viewModels — renderer-agnostic marker view-models.
 *
 * Archetype grammar (pin / track / field / reference / derived). Pins use a
 * single signal color — dimension taxonomy is not user-facing.
 */
import {
  getAnimationState,
  getSeveritySize,
} from '../core/visualGrammar'
import { enrichEventMarkerVisuals } from '../core/markerIconCache'
import { classifySignalCategory, signalCategoryColor } from '../core/signalBadgeIcons'
import { eventSourceToGlobeDataLayerKey } from '../core/globeLayers'
import {
  MARKER_ARCHETYPES,
  getArchetypeBehavior,
  resolveAnimationClass,
  resolveArchetypeOpacity,
  trackSubtypeFromEntity,
  trackSizePx,
  truthLabel,
} from '../core/markerArchetype'
import { getHazardEffectProfile } from '../core/environmentHazardEffects'
import { getHazardModelUrl } from '../core/hazardModelCatalog'
import { resolveHazardFill } from '../core/hazardColors'

const REVEAL_MS = 450

export function layerRevealMultiplier(layerRevealAt, layerKey, now = Date.now()) {
  const t0 = layerRevealAt?.[layerKey]
  if (!t0) return 1
  return Math.min(1, Math.max(0, (now - t0) / REVEAL_MS))
}

function withRevealOpacity(vm, layerKey, layerRevealAt, cacheStale = false) {
  let opacity = vm.opacity ?? 1
  if (cacheStale) opacity *= 0.55
  const reveal = layerRevealMultiplier(layerRevealAt, layerKey)
  return { ...vm, opacity: opacity * reveal }
}

export const TRACK_COLORS = {
  aircraft: '#a8b4c2',
  aircraftMilitary: '#c47a52',
  vessel: '#4dd4ff',
  satellite: '#c8ff00',
  satelliteMilitary: '#ff6b35',
  storm: '#ff7846',
}

export const RING_MAX_RADIUS = 3

export function rgbaFromHex(hex, alpha) {
  let h = (hex || '#888888').replace('#', '')
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Fallback pin color when hazard type is unknown. */
export const SIGNAL_MARKER_COLOR = '#536b82'

/** Hazard-type family color, darkened by severity; non-hazard → slate ladder. */
export function eventMarkerColor(evt) {
  if (evt?.environmentHazard) {
    return resolveHazardFill(evt.environmentHazard, evt.severity)
  }
  // Non-hazard pins share their badge color (GDELT category / camera)
  return signalCategoryColor(classifySignalCategory(evt))
}

export function eventMarkerRadiusGl(evt) {
  return evt.severity >= 4 ? 0.55 : evt.severity >= 3 ? 0.42 : 0.3
}

export function markerRingMaxRadius(vm, detectionMode = false) {
  if (detectionMode) return 2.8
  if (vm.archetype === MARKER_ARCHETYPES.REFERENCE) return 0
  if (vm.archetype === MARKER_ARCHETYPES.DERIVED) return 2.2
  if (vm.severity >= 4) return 5
  if (vm.severity >= 3) return 4
  return RING_MAX_RADIUS
}

/** @deprecated use vm.archetype — kept for renderer migration */
export function vmRenderChannel(vm) {
  if (vm.archetype === MARKER_ARCHETYPES.TRACK) return 'track'
  if (vm.archetype === MARKER_ARCHETYPES.REFERENCE || vm.archetype === MARKER_ARCHETYPES.DERIVED) {
    return 'sprite'
  }
  if (vm.archetype === MARKER_ARCHETYPES.PIN) return 'sprite'
  return 'track'
}

function attachHazardEffect(vm, enriched) {
  const hazard = enriched.environmentHazard || null
  const profile = getHazardEffectProfile(hazard)
  if (!profile) {
    vm.hazardEffect = null
    vm.modelUrl = ''
    return vm
  }
  vm.hazardEffect = profile
  vm.modelUrl = getHazardModelUrl(profile.modelId)
  const anim2d = profile.anim2dClass
  if (anim2d) {
    vm.animationClass = [vm.animationClass, anim2d].filter(Boolean).join(' ')
  }
  return vm
}

function pinVM(evt) {
  const enriched = enrichEventMarkerVisuals(evt)
  const behavior = getArchetypeBehavior(MARKER_ARCHETYPES.PIN)
  const recency = getAnimationState(enriched.timestamp)
  const vm = {
    id: enriched.id,
    archetype: MARKER_ARCHETYPES.PIN,
    kind: 'event',
    lat: enriched.lat,
    lng: enriched.lng,
    color: eventMarkerColor(enriched),
    radiusGl: eventMarkerRadiusGl(enriched),
    sizePx: getSeveritySize(enriched.severity),
    opacity: resolveArchetypeOpacity(MARKER_ARCHETYPES.PIN, enriched, behavior),
    severity: enriched.severity,
    priority: enriched.priority,
    dimension: enriched.dimension,
    environmentHazard: enriched.environmentHazard || null,
    markerIconUrl: enriched.markerIconUrl || '',
    title: enriched.title,
    recency,
    animationClass: resolveAnimationClass(MARKER_ARCHETYPES.PIN, { recency }),
    inspectorMode: behavior.inspectorMode,
    truth: truthLabel(MARKER_ARCHETYPES.PIN, enriched),
    raw: enriched,
  }
  return attachHazardEffect(vm, enriched)
}

function trackVM(evt, trackSubtype) {
  const mil = Boolean(evt.isMilitary)
  const behavior = getArchetypeBehavior(MARKER_ARCHETYPES.TRACK)
  let color = TRACK_COLORS[trackSubtype] || TRACK_COLORS.aircraft
  if (trackSubtype === 'aircraft' && mil) color = TRACK_COLORS.aircraftMilitary
  if (trackSubtype === 'satellite' && mil) color = TRACK_COLORS.satelliteMilitary

  const radiusGl = trackSubtype === 'storm' ? 0.55
    : trackSubtype === 'aircraft' ? (mil ? 0.45 : 0.38)
      : trackSubtype === 'vessel' ? 0.4 : 0.32

  const enriched = trackSubtype === 'storm' ? enrichEventMarkerVisuals(evt) : evt
  if (trackSubtype === 'storm' && enriched.environmentHazard) {
    color = resolveHazardFill(enriched.environmentHazard, enriched.severity ?? evt.severity)
  }

  const vm = {
    id: evt.id,
    archetype: MARKER_ARCHETYPES.TRACK,
    trackSubtype,
    kind: trackSubtype,
    lat: evt.lat,
    lng: evt.lng,
    color,
    radiusGl,
    sizePx: trackSizePx(trackSubtype),
    opacity: 1,
    severity: evt.severity,
    priority: evt.priority,
    dimension: evt.dimension,
    environmentHazard: enriched.environmentHazard || null,
    markerIconUrl: enriched.markerIconUrl || '',
    title: evt.title,
    recency: 'static',
    animationClass: null,
    inspectorMode: behavior.inspectorMode,
    truth: truthLabel(MARKER_ARCHETYPES.TRACK, evt),
    raw: enriched,
  }
  if (trackSubtype === 'storm') attachHazardEffect(vm, enriched)
  else {
    vm.hazardEffect = null
    vm.modelUrl = ''
  }
  return vm
}

/**
 * Build per-kind marker view-model lists from filtered layer events.
 */
export function buildMarkerViewModels({
  globePlottedEvents = [],
  tacticalAircraft = [],
  tacticalVessels = [],
  tacticalSatellites = [],
  stormOverlays = [],
  referenceMarkers = [],
  derivedMarkers = [],
  layerRevealAt = {},
} = {}) {
  const eventMarkers = globePlottedEvents.map((evt) => {
    const vm = pinVM(evt)
    const layerKey = eventSourceToGlobeDataLayerKey(evt)
    return withRevealOpacity(vm, layerKey, layerRevealAt, evt.cacheStale)
  })
  const aircraftMarkers = tacticalAircraft.map((evt) =>
    withRevealOpacity(trackVM(evt, 'aircraft'), 'adsb', layerRevealAt, evt.cacheStale),
  )
  const vesselMarkers = tacticalVessels.map((evt) =>
    withRevealOpacity(trackVM(evt, 'vessel'), 'ais', layerRevealAt, evt.cacheStale),
  )
  const satelliteMarkers = tacticalSatellites.map((evt) =>
    withRevealOpacity(trackVM(evt, 'satellite'), 'satellites', layerRevealAt, evt.cacheStale),
  )
  const stormMarkers = stormOverlays
    .filter((s) => s.lat != null && s.lng != null)
    .map((evt) => withRevealOpacity(trackVM(evt, 'storm'), 'nhcStorms', layerRevealAt, evt.cacheStale))

  const refMarkers = referenceMarkers.map((vm) =>
    withRevealOpacity(vm, vm.refKind === 'chokepoint' ? 'referenceChokepoints' : 'referenceNuclear', layerRevealAt),
  )
  const derMarkers = derivedMarkers.map((vm) =>
    withRevealOpacity(vm, 'derivedSignals', layerRevealAt),
  )

  return {
    eventMarkers,
    aircraftMarkers,
    vesselMarkers,
    satelliteMarkers,
    stormMarkers,
    referenceMarkers: refMarkers,
    derivedMarkers: derMarkers,
    allMarkers: [
      ...refMarkers,
      ...eventMarkers,
      ...derMarkers,
      ...aircraftMarkers,
      ...vesselMarkers,
      ...satelliteMarkers,
      ...stormMarkers,
    ],
  }
}

/** Classify legacy VM kind for filters during migration. */
export function isSpriteArchetype(vm) {
  return vm.archetype === MARKER_ARCHETYPES.PIN
    || vm.archetype === MARKER_ARCHETYPES.REFERENCE
    || vm.archetype === MARKER_ARCHETYPES.DERIVED
    || vm.kind === 'event'
}

export function isTrackArchetype(vm) {
  return vm.archetype === MARKER_ARCHETYPES.TRACK
    || (vm.kind && vm.kind !== 'event' && !vm.archetype)
}

export { trackSubtypeFromEntity }
