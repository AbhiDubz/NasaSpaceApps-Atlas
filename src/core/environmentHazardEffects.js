/**
 * Environment hazard effect profiles — motion + 3D model catalog for globe LOD.
 * Orthogonal to marker archetypes (pin/track); see MARKER_GRAMMAR.md.
 */
import { HAZARD_TYPES } from './environmentHazardClassifier.js'

/**
 * @typedef {object} HazardEffectProfile
 * @property {string} modelId — GLB basename under /models/hazards/
 * @property {number} spinDegPerSec
 * @property {number} pulseHz
 * @property {number} baseScale — Map3D Model3D scale at severity 3
 * @property {number} severityScale — extra scale per severity step from 3
 * @property {number} altitudeM — RELATIVE_TO_GROUND altitude for Model3D
 * @property {boolean} heroParticles — eligible for Globe.GL L2 accents
 * @property {string} anim2dClass — CSS class for L0 sprite animation
 * @property {string} family — motion family for FlatMap / shared styling
 */

/** @type {Record<string, HazardEffectProfile>} */
export const HAZARD_EFFECT_PROFILES = {
  [HAZARD_TYPES.WILDFIRE]: {
    modelId: 'fire',
    spinDegPerSec: 0,
    pulseHz: 2.2,
    baseScale: 18,
    severityScale: 4,
    altitudeM: 2200,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--flame',
    family: 'flame',
  },
  [HAZARD_TYPES.VOLCANO]: {
    modelId: 'volcano',
    spinDegPerSec: 0,
    pulseHz: 1.1,
    baseScale: 22,
    severityScale: 5,
    altitudeM: 2800,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--plume',
    family: 'plume',
  },
  [HAZARD_TYPES.HURRICANE]: {
    modelId: 'cyclone',
    spinDegPerSec: 90,
    pulseHz: 0.6,
    baseScale: 28,
    severityScale: 6,
    altitudeM: 3500,
    heroParticles: true,
    anim2dClass: 'atlas-hazard--vortex',
    family: 'vortex',
  },
  [HAZARD_TYPES.TYPHOON]: {
    modelId: 'cyclone',
    spinDegPerSec: 95,
    pulseHz: 0.6,
    baseScale: 28,
    severityScale: 6,
    altitudeM: 3500,
    heroParticles: true,
    anim2dClass: 'atlas-hazard--vortex',
    family: 'vortex',
  },
  [HAZARD_TYPES.TORNADO]: {
    modelId: 'tornado',
    spinDegPerSec: 140,
    pulseHz: 1.4,
    baseScale: 20,
    severityScale: 5,
    altitudeM: 2400,
    heroParticles: true,
    anim2dClass: 'atlas-hazard--vortex',
    family: 'vortex',
  },
  [HAZARD_TYPES.STORM]: {
    modelId: 'cloud_with_rain',
    spinDegPerSec: 12,
    pulseHz: 0.9,
    baseScale: 16,
    severityScale: 3,
    altitudeM: 2000,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--wave',
    family: 'wave',
  },
  [HAZARD_TYPES.FLOOD]: {
    modelId: 'ocean',
    spinDegPerSec: 0,
    pulseHz: 1.0,
    baseScale: 18,
    severityScale: 4,
    altitudeM: 1600,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--wave',
    family: 'wave',
  },
  [HAZARD_TYPES.TSUNAMI]: {
    modelId: 'ocean',
    spinDegPerSec: 0,
    pulseHz: 1.3,
    baseScale: 24,
    severityScale: 5,
    altitudeM: 1800,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--wave',
    family: 'wave',
  },
  [HAZARD_TYPES.MONSOON]: {
    modelId: 'cloud_with_rain',
    spinDegPerSec: 8,
    pulseHz: 1.0,
    baseScale: 17,
    severityScale: 3,
    altitudeM: 2000,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--wave',
    family: 'wave',
  },
  [HAZARD_TYPES.EARTHQUAKE]: {
    modelId: 'collision',
    spinDegPerSec: 0,
    pulseHz: 1.6,
    baseScale: 16,
    severityScale: 4,
    altitudeM: 1500,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--quake',
    family: 'quake',
  },
  [HAZARD_TYPES.DUSTSTORM]: {
    modelId: 'fog',
    spinDegPerSec: 25,
    pulseHz: 0.7,
    baseScale: 18,
    severityScale: 3,
    altitudeM: 2100,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--dust',
    family: 'dust',
  },
  [HAZARD_TYPES.BLIZZARD]: {
    modelId: 'snowflake',
    spinDegPerSec: 35,
    pulseHz: 0.8,
    baseScale: 16,
    severityScale: 3,
    altitudeM: 2000,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--ice',
    family: 'ice',
  },
  [HAZARD_TYPES.AVALANCHE]: {
    modelId: 'mountain',
    spinDegPerSec: 0,
    pulseHz: 1.2,
    baseScale: 18,
    severityScale: 4,
    altitudeM: 2200,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--ice',
    family: 'ice',
  },
  [HAZARD_TYPES.LIGHTNING]: {
    modelId: 'zap',
    spinDegPerSec: 0,
    pulseHz: 3.5,
    baseScale: 15,
    severityScale: 3,
    altitudeM: 2400,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--bolt',
    family: 'bolt',
  },
  [HAZARD_TYPES.DROUGHT]: {
    modelId: 'sun',
    spinDegPerSec: 18,
    pulseHz: 0.5,
    baseScale: 16,
    severityScale: 3,
    altitudeM: 2000,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--heat',
    family: 'heat',
  },
  [HAZARD_TYPES.HEATWAVE]: {
    modelId: 'thermometer',
    spinDegPerSec: 0,
    pulseHz: 0.9,
    baseScale: 16,
    severityScale: 3,
    altitudeM: 2000,
    heroParticles: false,
    anim2dClass: 'atlas-hazard--heat',
    family: 'heat',
  },
}

/**
 * @param {string | null | undefined} hazardType
 * @returns {HazardEffectProfile | null}
 */
export function getHazardEffectProfile(hazardType) {
  if (!hazardType) return null
  return HAZARD_EFFECT_PROFILES[hazardType] || null
}

/**
 * Map3D model scale from profile + severity + camera range.
 * Model3D is world-meter sized (not sizePreserved), so scale must grow with
 * camera range or pins vanish at the default 24e6 m orbit.
 * @param {HazardEffectProfile} profile
 * @param {number} [severity]
 * @param {number} [cameraRangeM]
 */
export function resolveHazardModelScale(profile, severity = 3, cameraRangeM = 500_000) {
  const sev = Number.isFinite(severity) ? severity : 3
  const character = Math.max(8, profile.baseScale + (sev - 3) * profile.severityScale)
  const range = Math.max(5_000, Number(cameraRangeM) || 500_000)
  // ~0.35% of camera range → readable from orbit; clamp street ↔ globe
  const rangeFactor = Math.min(160_000, Math.max(40, range * 0.0035))
  return rangeFactor * (character / 18)
}

/**
 * Lift models slightly more at far camera so they clear terrain/tiles.
 * @param {HazardEffectProfile} profile
 * @param {number} [cameraRangeM]
 */
export function resolveHazardModelAltitudeM(profile, cameraRangeM = 500_000) {
  const base = profile.altitudeM || 2200
  const range = Math.max(5_000, Number(cameraRangeM) || 500_000)
  if (range > 8_000_000) return Math.max(base, range * 0.002)
  if (range > 1_500_000) return Math.max(base, 12_000)
  return base
}

/**
 * Unique model ids used by the pack (for preload).
 * @returns {string[]}
 */
export function listHazardModelIds() {
  return [...new Set(Object.values(HAZARD_EFFECT_PROFILES).map((p) => p.modelId))]
}
