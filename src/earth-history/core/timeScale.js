/**
 * Deep-time scale: integer YBP (years before present) with piecewise slider mapping.
 * 0 = present; EARTH_BIRTH_YBP = formation of Earth.
 */

export const EARTH_BIRTH_YBP = 4_540_000_000
export const MA_YEARS = 1_000_000
export const KA_YEARS = 1_000

/** ICS-aligned segment boundaries in Ma (older → younger). */
export const TIME_SEGMENTS = Object.freeze([
  { id: 'precambrian', startMa: 4540, endMa: 541, share: 0.35 },
  { id: 'paleozoic', startMa: 541, endMa: 252, share: 0.15 },
  { id: 'mesozoic', startMa: 252, endMa: 66, share: 0.15 },
  { id: 'cenozoic', startMa: 66, endMa: 2.58, share: 0.15 },
  { id: 'quaternary', startMa: 2.58, endMa: 0.012, share: 0.1 },
  { id: 'holocene', startMa: 0.012, endMa: 0, share: 0.1 },
])

const SHARE_SUM = TIME_SEGMENTS.reduce((s, seg) => s + seg.share, 0)

function segmentSliderBounds() {
  let u = 0
  return TIME_SEGMENTS.map((seg) => {
    const u0 = u
    const u1 = u + seg.share / SHARE_SUM
    u = u1
    return { ...seg, u0, u1 }
  })
}

const SEGMENTS_U = segmentSliderBounds()

export function maToYbp(ma) {
  return Math.round(Number(ma) * MA_YEARS)
}

export function ybpToMa(ybp) {
  return Number(ybp) / MA_YEARS
}

/** Present snaps to 0; all other values are non-negative integers. */
export function normalizeYbp(ybp) {
  const n = Math.round(Number(ybp))
  if (!Number.isFinite(n) || n <= 0) return 0
  if (n >= EARTH_BIRTH_YBP) return EARTH_BIRTH_YBP
  return n
}

/**
 * @param {{ startYbp: number, endYbp: number }} range — start older, end nearer present
 */
export function clampYbpToRange(ybp, range) {
  const start = normalizeYbp(range.startYbp)
  const end = normalizeYbp(range.endYbp)
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  return Math.min(hi, Math.max(lo, normalizeYbp(ybp)))
}

/**
 * Validate editable range. start = older, end = younger (nearer 0).
 * @returns {{ ok: true, startYbp: number, endYbp: number } | { ok: false, error: string }}
 */
export function validateRange(startYbp, endYbp) {
  const start = normalizeYbp(startYbp)
  const end = normalizeYbp(endYbp)
  if (start <= end) {
    return { ok: false, error: 'Start must be older than end (larger YBP / earlier age).' }
  }
  if (start > EARTH_BIRTH_YBP) {
    return { ok: false, error: 'Start cannot precede Earth formation (4540 Ma).' }
  }
  if (end < 0) {
    return { ok: false, error: 'End cannot be in the future.' }
  }
  return { ok: true, startYbp: start, endYbp: end }
}

function ybpToGlobalU(ybp) {
  const t = normalizeYbp(ybp)
  const ma = ybpToMa(t)
  for (const seg of SEGMENTS_U) {
    if (ma <= seg.startMa && ma >= seg.endMa) {
      const span = seg.startMa - seg.endMa
      const local = span <= 0 ? 0 : (seg.startMa - ma) / span
      return seg.u0 + local * (seg.u1 - seg.u0)
    }
  }
  return ma >= SEGMENTS_U[0].startMa ? 0 : 1
}

function globalUToYbp(u) {
  const x = Math.min(1, Math.max(0, Number(u)))
  for (const seg of SEGMENTS_U) {
    if (x >= seg.u0 && x <= seg.u1) {
      const local = seg.u1 === seg.u0 ? 0 : (x - seg.u0) / (seg.u1 - seg.u0)
      const ma = seg.startMa - local * (seg.startMa - seg.endMa)
      return normalizeYbp(maToYbp(ma))
    }
  }
  return 0
}

/**
 * Map YBP → slider u in [0,1] within an editable window (piecewise of global scale).
 * u=0 is range start (older); u=1 is range end (younger / present).
 */
export function ybpToSlider(ybp, range) {
  const start = normalizeYbp(range.startYbp)
  const end = normalizeYbp(range.endYbp)
  const uStart = ybpToGlobalU(start)
  const uEnd = ybpToGlobalU(end)
  const u = ybpToGlobalU(ybp)
  if (uEnd === uStart) return 0
  return Math.min(1, Math.max(0, (u - uStart) / (uEnd - uStart)))
}

export function sliderToYbp(u, range) {
  const start = normalizeYbp(range.startYbp)
  const end = normalizeYbp(range.endYbp)
  const uStart = ybpToGlobalU(start)
  const uEnd = ybpToGlobalU(end)
  const x = Math.min(1, Math.max(0, Number(u)))
  const globalU = uStart + x * (uEnd - uStart)
  return clampYbpToRange(globalUToYbp(globalU), { startYbp: start, endYbp: end })
}

/** Scale-aware keyboard nudge in YBP. */
export function nudgeStepYbp(ybp, { shift = false } = {}) {
  const ma = ybpToMa(normalizeYbp(ybp))
  let stepMa
  if (ma >= 541) stepMa = shift ? 200 : 50
  else if (ma >= 66) stepMa = shift ? 20 : 5
  else if (ma >= 2.58) stepMa = shift ? 5 : 1
  else if (ma >= 0.012) stepMa = shift ? 0.1 : 0.02
  else stepMa = shift ? 0.001 : 0.0001
  return Math.max(1, Math.round(stepMa * MA_YEARS))
}

export function formatDeepTime(ybp, { precision } = {}) {
  const t = normalizeYbp(ybp)
  if (t === 0) return 'Present'
  if (t >= MA_YEARS) {
    const ma = t / MA_YEARS
    const digits = precision ?? (ma >= 100 ? 0 : ma >= 10 ? 1 : 2)
    return `${ma.toFixed(digits)} Ma`
  }
  if (t >= KA_YEARS) {
    const ka = t / KA_YEARS
    const digits = precision ?? (ka >= 10 ? 0 : 1)
    return `${ka.toFixed(digits)} ka`
  }
  const year = new Date().getFullYear() - t
  if (year >= 1) return String(Math.round(year))
  return `${t} YBP`
}

/**
 * Parse human input: "4.5 Ga", "541 Ma", "12 ka", "12000 BCE", "2026-07-22", "Present".
 * @returns {{ ok: true, ybp: number } | { ok: false, error: string }}
 */
export function parseDeepTimeInput(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return { ok: false, error: 'Enter an age or date.' }

  if (/^(present|now|today)$/i.test(s)) return { ok: true, ybp: 0 }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const y = Number(iso[1])
    const nowY = new Date().getFullYear()
    if (y > nowY) return { ok: false, error: 'Date cannot be in the future.' }
    return { ok: true, ybp: normalizeYbp(nowY - y) }
  }

  const bce = s.match(/^(\d+(?:\.\d+)?)\s*(BCE|BC|bce|bc)\s*$/)
  if (bce) {
    const n = Number(bce[1])
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Invalid BCE year.' }
    return { ok: true, ybp: normalizeYbp(Math.round(n + new Date().getFullYear())) }
  }

  const unit = s.match(/^([+-]?\d+(?:\.\d+)?)\s*(Ga|ga|MA|Ma|ma|ka|Ka|KA|ybp|YBP|yr|years?)?\s*$/)
  if (unit) {
    const n = Number(unit[1])
    if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Age must be non-negative.' }
    const u = (unit[2] || 'Ma').toLowerCase()
    let ybp
    if (u === 'ga') ybp = n * 1_000 * MA_YEARS
    else if (u === 'ma') ybp = n * MA_YEARS
    else if (u === 'ka') ybp = n * KA_YEARS
    else ybp = n
    return { ok: true, ybp: normalizeYbp(ybp) }
  }

  const yearOnly = s.match(/^(\d{1,4})$/)
  if (yearOnly) {
    const y = Number(yearOnly[1])
    const nowY = new Date().getFullYear()
    if (y <= nowY && y >= 1000) return { ok: true, ybp: normalizeYbp(nowY - y) }
  }

  return { ok: false, error: 'Unrecognized format. Try "541 Ma", "12 ka", "12000 BCE", or "2026-07-22".' }
}

export function getSegmentBoundsForUi() {
  return SEGMENTS_U.map(({ id, startMa, endMa, u0, u1, share }) => ({
    id,
    startMa,
    endMa,
    u0,
    u1,
    share,
  }))
}

/** Snap playhead to nearest ICS boundary within tolerance (optional). */
export function snapToEraBoundary(ybp, boundariesMa, toleranceMa = 2) {
  const ma = ybpToMa(normalizeYbp(ybp))
  let best = null
  let bestDist = Infinity
  for (const b of boundariesMa) {
    const d = Math.abs(ma - b)
    if (d < bestDist) {
      bestDist = d
      best = b
    }
  }
  if (best != null && bestDist <= toleranceMa) return normalizeYbp(maToYbp(best))
  return normalizeYbp(ybp)
}
