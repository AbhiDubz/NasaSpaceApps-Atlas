/**
 * Sparse Phanerozoic Earth-system almanac — load once, interpolate by age.
 */

const ALMANAC_URL = '/geo/earth-history/almanac/index.json'

/** @type {object | null | undefined} */
let cached = undefined
/** @type {Promise<object | null> | null} */
let loadPromise = null

const RANGE_KEYS = ['co2Ppm', 'o2Pct', 'tempC']
const SCALAR_KEYS = ['dayLengthHours', 'daysPerYear', 'seaLevelM', 'srRatio']

async function loadAlmanac(signal) {
  if (cached !== undefined) return cached
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const res = await fetch(ALMANAC_URL, {
          method: 'GET',
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!res.ok) return null
        const data = await res.json()
        if (!data?.keyframes?.length) return null
        data.keyframes = data.keyframes
          .slice()
          .sort((a, b) => b.ageMa - a.ageMa)
        return data
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        return null
      } finally {
        loadPromise = null
      }
    })()
  }
  cached = await loadPromise
  return cached
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpRange(a, b, t) {
  if (!a && !b) return null
  if (!a) return { ...b }
  if (!b) return { ...a }
  return {
    mid: lerp(a.mid, b.mid, t),
    low: lerp(a.low, b.low, t),
    high: lerp(a.high, b.high, t),
  }
}

/**
 * Linear interpolate almanac fields between neighboring keyframes.
 * @param {object[]} keyframes oldest→youngest or any order (sorted desc by ageMa expected)
 * @param {number} ageMa
 */
export function interpolateAlmanac(keyframes, ageMa) {
  if (!keyframes?.length) return null
  const t = Number(ageMa)
  if (!Number.isFinite(t)) return null

  const sorted = keyframes[0].ageMa >= keyframes[keyframes.length - 1].ageMa
    ? keyframes
    : keyframes.slice().sort((a, b) => b.ageMa - a.ageMa)

  if (t >= sorted[0].ageMa) return cloneFrame(sorted[0], t)
  if (t <= sorted[sorted.length - 1].ageMa) {
    return cloneFrame(sorted[sorted.length - 1], t)
  }

  let older = sorted[0]
  let younger = sorted[sorted.length - 1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t <= sorted[i].ageMa && t >= sorted[i + 1].ageMa) {
      older = sorted[i]
      younger = sorted[i + 1]
      break
    }
  }

  const span = older.ageMa - younger.ageMa
  const u = span > 0 ? (older.ageMa - t) / span : 0

  const out = { ageMa: t }
  for (const key of RANGE_KEYS) {
    out[key] = lerpRange(older[key], younger[key], u)
  }
  for (const key of SCALAR_KEYS) {
    out[key] = lerp(Number(older[key]) || 0, Number(younger[key]) || 0, u)
  }
  return out
}

function cloneFrame(frame, ageMa) {
  const out = { ageMa }
  for (const key of RANGE_KEYS) {
    out[key] = frame[key] ? { ...frame[key] } : null
  }
  for (const key of SCALAR_KEYS) {
    out[key] = frame[key]
  }
  return out
}

/**
 * @param {number} ageMa
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchAlmanacAtAge(ageMa, opts = {}) {
  const data = await loadAlmanac(opts.signal)
  if (!data) {
    return { ok: false, reason: 'Almanac data unavailable.', ageMa }
  }
  const values = interpolateAlmanac(data.keyframes, ageMa)
  if (!values) {
    return { ok: false, reason: 'Almanac interpolation failed.', ageMa }
  }
  return {
    ok: true,
    ageMa: values.ageMa,
    values,
    citations: data.citations || [],
    citation: data.citation || '',
  }
}

/** Test helper */
export function __resetAlmanacCacheForTests() {
  cached = undefined
  loadPromise = null
}
