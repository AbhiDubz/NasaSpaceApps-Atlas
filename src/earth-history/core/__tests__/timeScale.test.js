import { describe, expect, it } from 'vitest'
import {
  EARTH_BIRTH_YBP,
  clampYbpToRange,
  formatDeepTime,
  maToYbp,
  normalizeYbp,
  nudgeStepYbp,
  parseDeepTimeInput,
  sliderToYbp,
  validateRange,
  ybpToMa,
  ybpToSlider,
} from '../timeScale.js'
import { pickKeyframe, validateManifest } from '../keyframeIndex.js'

const FULL = { startYbp: EARTH_BIRTH_YBP, endYbp: 0 }

describe('normalizeYbp', () => {
  it('snaps present and clamps birth', () => {
    expect(normalizeYbp(0)).toBe(0)
    expect(normalizeYbp(-10)).toBe(0)
    expect(normalizeYbp(EARTH_BIRTH_YBP + 99)).toBe(EARTH_BIRTH_YBP)
    expect(normalizeYbp(541.4 * 1e6)).toBe(541400000)
  })
})

describe('piecewise slider round-trip', () => {
  it('is monotonic across the full domain', () => {
    let prevU = -1
    for (let ma = 4540; ma >= 0; ma -= 50) {
      const u = ybpToSlider(maToYbp(ma), FULL)
      expect(u).toBeGreaterThanOrEqual(prevU - 1e-9)
      prevU = u
    }
  })

  it('round-trips within each major band', () => {
    const samples = [4000, 1000, 541, 300, 100, 66, 20, 2.58, 0.1, 0.01, 0]
    for (const ma of samples) {
      const ybp = maToYbp(ma)
      const u = ybpToSlider(ybp, FULL)
      const back = sliderToYbp(u, FULL)
      const errMa = Math.abs(ybpToMa(back) - ma)
      const tol = ma >= 100 ? 5 : ma >= 1 ? 0.5 : 0.05
      expect(errMa).toBeLessThanOrEqual(tol)
    }
  })

  it('maps range window ends to 0 and 1', () => {
    const range = { startYbp: maToYbp(541), endYbp: maToYbp(66) }
    expect(ybpToSlider(maToYbp(541), range)).toBeCloseTo(0, 5)
    expect(ybpToSlider(maToYbp(66), range)).toBeCloseTo(1, 5)
  })
})

describe('validateRange', () => {
  it('rejects crossed or equal ranges', () => {
    expect(validateRange(0, 100).ok).toBe(false)
    expect(validateRange(100, 100).ok).toBe(false)
    expect(validateRange(maToYbp(541), maToYbp(66)).ok).toBe(true)
  })
})

describe('clampYbpToRange', () => {
  it('clamps playhead inside window', () => {
    const range = { startYbp: maToYbp(100), endYbp: maToYbp(10) }
    expect(clampYbpToRange(maToYbp(200), range)).toBe(maToYbp(100))
    expect(clampYbpToRange(maToYbp(1), range)).toBe(maToYbp(10))
  })
})

describe('formatDeepTime / parseDeepTimeInput', () => {
  it('formats Ma / ka / present', () => {
    expect(formatDeepTime(0)).toBe('Present')
    expect(formatDeepTime(maToYbp(541))).toMatch(/541/)
    expect(formatDeepTime(12_000)).toMatch(/12/)
  })

  it('parses common suffixes and dates', () => {
    expect(parseDeepTimeInput('Present').ybp).toBe(0)
    expect(parseDeepTimeInput('4.54 Ga').ybp).toBe(EARTH_BIRTH_YBP)
    expect(parseDeepTimeInput('541 Ma').ybp).toBe(maToYbp(541))
    expect(parseDeepTimeInput('12 ka').ybp).toBe(12_000)
    expect(parseDeepTimeInput('bogus').ok).toBe(false)
  })
})

describe('nudgeStepYbp', () => {
  it('grows for deep time', () => {
    expect(nudgeStepYbp(maToYbp(1000))).toBeGreaterThan(nudgeStepYbp(maToYbp(1)))
  })
})

describe('keyframeIndex', () => {
  const frames = [
    { id: 'a', ageMa: 100, texture: '/a.png' },
    { id: 'b', ageMa: 50, texture: '/b.png' },
    { id: 'c', ageMa: 0, texture: '/c.png' },
  ]

  it('picks nearest', () => {
    expect(pickKeyframe(frames, 60).nearest.id).toBe('b')
    expect(pickKeyframe(frames, 90).nearest.id).toBe('a')
    expect(pickKeyframe(frames, 5).nearest.id).toBe('c')
  })

  it('validates manifest', () => {
    expect(validateManifest({ version: '1', frames }).ok).toBe(true)
    expect(validateManifest({ version: '1', frames: [] }).ok).toBe(false)
  })
})
