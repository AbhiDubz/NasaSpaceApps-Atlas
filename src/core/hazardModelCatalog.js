/**
 * Hazard GLB URL catalog + preload for Map3D Model3D markers.
 */
import { listHazardModelIds } from './environmentHazardEffects.js'

const BASE = `${import.meta.env.BASE_URL || '/'}models/hazards`

/**
 * @param {string} modelId
 * @returns {string}
 */
export function getHazardModelUrl(modelId) {
  if (!modelId) return ''
  return `${BASE}/${modelId}.glb`
}

/**
 * Warm HTTP cache for all hazard GLBs (fire-and-forget).
 * @returns {Promise<void>}
 */
export function preloadHazardModels() {
  if (typeof fetch !== 'function') return Promise.resolve()
  const ids = listHazardModelIds()
  return Promise.all(
    ids.map((id) =>
      fetch(getHazardModelUrl(id), { mode: 'cors', cache: 'force-cache' }).catch(() => null),
    ),
  ).then(() => undefined)
}
