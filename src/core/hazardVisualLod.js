/**
 * LOD helpers for environment hazard 3D models vs animated sprites.
 */
import { isMobileDevice } from '../config/qualityTiers.js'

/** Max concurrent Map3D Model3D hazard instances. */
export const MAX_HAZARD_MODELS = 48

/**
 * Prefer Model3D whenever quality allows — Map3D models are world-meter
 * scaled, so visibility at orbit is handled by camera-adaptive scale, not by
 * dropping to sprites.
 */
export const HAZARD_MODEL_MIN_SEVERITY = 1

/**
 * @param {object} opts
 * @param {string} [opts.resolvedTier]
 * @param {number | null} [opts.cameraRangeM] — kept for API compat; not used to block models
 * @param {number} [opts.severity]
 * @param {boolean} [opts.hasModel]
 * @param {boolean} [opts.reduceMotion]
 * @returns {'sprite' | 'model'}
 */
export function resolveHazardVisualLod({
  resolvedTier = 'high',
  severity = 1,
  hasModel = false,
  reduceMotion = false,
} = {}) {
  if (!hasModel) return 'sprite'
  if (reduceMotion) return 'sprite'
  if (isMobileDevice()) return 'sprite'
  if (resolvedTier === 'low') return 'sprite'
  if (severity < HAZARD_MODEL_MIN_SEVERITY) return 'sprite'
  return 'model'
}

/**
 * Pick up to `budget` VMs for Model3D; rest stay sprites.
 * Prefers higher severity then array order.
 * @param {Array<{ id: string, severity?: number, modelUrl?: string, environmentHazard?: string | null }>} markers
 * @param {number} [budget]
 * @returns {Set<string>}
 */
export function selectHazardModelIds(markers, budget = MAX_HAZARD_MODELS) {
  const eligible = markers
    .filter((m) => m.modelUrl && m.environmentHazard)
    .slice()
    .sort((a, b) => (b.severity || 0) - (a.severity || 0))
  const ids = new Set()
  for (const m of eligible) {
    if (ids.size >= budget) break
    ids.add(m.id)
  }
  return ids
}
