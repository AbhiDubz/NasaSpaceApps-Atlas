/**
 * Nearest / adjacent keyframe selection for paleomap textures.
 */

/**
 * @typedef {{
 *   id: string,
 *   ageMa: number,
 *   texture: string,
 *   textureMobile?: string,
 *   relief?: string,
 *   reliefMobile?: string,
 *   textureRelief?: string,
 *   width?: number,
 *   height?: number,
 *   source?: string,
 * }} Keyframe
 */

/**
 * @typedef {{ frames: Keyframe[], ages: number[] }} KeyframeIndex
 */

/** Reuse the sorted view per manifest array; scrubbing resolves frames every animation frame. */
const indexCache = new WeakMap()

/**
 * Sorted (older → younger) view of the manifest frames, memoised per array identity.
 * @param {Keyframe[]} frames
 * @returns {KeyframeIndex}
 */
export function buildKeyframeIndex(frames) {
  if (!frames?.length) throw new Error('buildKeyframeIndex: empty frames')
  const cached = indexCache.get(frames)
  if (cached) return cached
  const sorted = [...frames].sort((a, b) => b.ageMa - a.ageMa)
  const index = { frames: sorted, ages: sorted.map((f) => f.ageMa) }
  indexCache.set(frames, index)
  return index
}

/** First position whose age is at or below `t`, in an age-descending list. */
function lowerBound(ages, t) {
  let lo = 0
  let hi = ages.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (ages[mid] <= t) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * Position of the closest frame to `ageMa`; ties resolve to the older frame.
 * @param {KeyframeIndex} index
 * @param {number} ageMa
 * @returns {number}
 */
export function nearestFrameIndex(index, ageMa) {
  const { ages } = index
  const t = Number(ageMa)
  if (!Number.isFinite(t)) return ages.length - 1
  if (t >= ages[0]) return 0
  if (t <= ages[ages.length - 1]) return ages.length - 1
  const younger = lowerBound(ages, t)
  const older = younger - 1
  return ages[older] - t <= t - ages[younger] ? older : younger
}

/**
 * @param {Keyframe[]} frames — any order; sorted internally by ageMa descending (older first)
 * @param {number} ageMa
 * @returns {{ nearest: Keyframe, prev: Keyframe | null, next: Keyframe | null, blend: number }}
 */
export function pickKeyframe(frames, ageMa) {
  if (!frames?.length) {
    throw new Error('pickKeyframe: empty frames')
  }
  const index = buildKeyframeIndex(frames)
  const sorted = index.frames
  const t = Number(ageMa)
  if (!Number.isFinite(t)) {
    return { nearest: sorted[sorted.length - 1], prev: null, next: null, blend: 0 }
  }

  // Exact or outside
  if (t >= sorted[0].ageMa) {
    return { nearest: sorted[0], prev: null, next: sorted[1] ?? null, blend: 0 }
  }
  const last = sorted[sorted.length - 1]
  if (t <= last.ageMa) {
    return { nearest: last, prev: sorted[sorted.length - 2] ?? null, next: null, blend: 0 }
  }

  const youngerIdx = lowerBound(index.ages, t)
  const older = sorted[youngerIdx - 1]
  const younger = sorted[youngerIdx]
  const span = older.ageMa - younger.ageMa
  const blend = span <= 0 ? 0 : (older.ageMa - t) / span
  const nearest = older.ageMa - t <= t - younger.ageMa ? older : younger
  return { nearest, prev: older, next: younger, blend }
}

/**
 * Lightweight manifest validation (no Zod required at call sites).
 * @param {unknown} data
 * @returns {{ ok: true, manifest: object } | { ok: false, error: string }}
 */
export function validateManifest(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Manifest must be an object.' }
  const m = /** @type {Record<string, unknown>} */ (data)
  if (!m.version) return { ok: false, error: 'Missing version.' }
  if (!Array.isArray(m.frames) || m.frames.length === 0) {
    return { ok: false, error: 'frames must be a non-empty array.' }
  }
  for (let i = 0; i < m.frames.length; i++) {
    const f = m.frames[i]
    if (!f || typeof f !== 'object') return { ok: false, error: `frames[${i}] invalid.` }
    if (typeof f.id !== 'string' || !f.id) return { ok: false, error: `frames[${i}].id required.` }
    if (typeof f.ageMa !== 'number' || !Number.isFinite(f.ageMa)) {
      return { ok: false, error: `frames[${i}].ageMa must be a number.` }
    }
    if (typeof f.texture !== 'string' || !f.texture) {
      return { ok: false, error: `frames[${i}].texture required.` }
    }
  }
  return { ok: true, manifest: m }
}
