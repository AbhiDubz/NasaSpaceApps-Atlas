import { describe, expect, it } from 'vitest'
import {
  buildKeyframeIndex,
  nearestFrameIndex,
  pickKeyframe,
  validateManifest,
} from '../keyframeIndex.js'

const FRAMES = [
  { id: 'a', ageMa: 100, texture: '/a.png' },
  { id: 'b', ageMa: 50, texture: '/b.png' },
  { id: 'c', ageMa: 0, texture: '/c.png' },
]

describe('pickKeyframe', () => {
  it('picks older frame at/above oldest age', () => {
    const { nearest, blend } = pickKeyframe(FRAMES, 120)
    expect(nearest.id).toBe('a')
    expect(blend).toBe(0)
  })

  it('picks present at/below youngest age', () => {
    const { nearest } = pickKeyframe(FRAMES, -1)
    expect(nearest.id).toBe('c')
  })

  it('picks nearest mid-span and reports blend toward younger', () => {
    const { nearest, prev, next, blend } = pickKeyframe(FRAMES, 60)
    expect(nearest.id).toBe('b')
    expect(prev.id).toBe('a')
    expect(next.id).toBe('b')
    expect(blend).toBeCloseTo(0.8, 5)
  })

  it('ties prefer older frame', () => {
    const { nearest } = pickKeyframe(FRAMES, 75)
    expect(nearest.id).toBe('a')
  })
})

describe('buildKeyframeIndex', () => {
  it('sorts older to younger and reuses the index per frames array', () => {
    const index = buildKeyframeIndex(FRAMES)
    expect(index.frames.map((f) => f.id)).toEqual(['a', 'b', 'c'])
    expect(index.ages).toEqual([100, 50, 0])
    expect(buildKeyframeIndex(FRAMES)).toBe(index)
  })
})

describe('nearestFrameIndex', () => {
  const dense = Array.from({ length: 109 }, (_, i) => ({
    id: `ma-${540 - i * 5}`,
    ageMa: 540 - i * 5,
    texture: `/ma-${540 - i * 5}.png`,
  }))
  const index = buildKeyframeIndex(dense)

  it('matches a linear scan across the whole span', () => {
    for (let age = -10; age <= 560; age += 1.25) {
      let best = 0
      for (let i = 1; i < dense.length; i += 1) {
        const d = Math.abs(index.ages[i] - age)
        const bestD = Math.abs(index.ages[best] - age)
        if (d < bestD) best = i
      }
      expect(nearestFrameIndex(index, age)).toBe(best)
    }
  })

  it('resolves ties to the older frame', () => {
    expect(index.frames[nearestFrameIndex(index, 537.5)].ageMa).toBe(540)
  })

  it('clamps outside the manifest span', () => {
    expect(nearestFrameIndex(index, 9000)).toBe(0)
    expect(nearestFrameIndex(index, -5)).toBe(dense.length - 1)
    expect(nearestFrameIndex(index, Number.NaN)).toBe(dense.length - 1)
  })
})

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const r = validateManifest({
      version: '1',
      frames: [{ id: 'x', ageMa: 0, texture: '/x.png' }],
    })
    expect(r.ok).toBe(true)
  })

  it('rejects missing frames', () => {
    const r = validateManifest({ version: '1', frames: [] })
    expect(r.ok).toBe(false)
  })
})
