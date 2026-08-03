import { describe, expect, it } from 'vitest'
import {
  diversityPlayheadU,
  diversitySparkPath,
} from '../../../services/earthHistory/fetchPbdbDiversity.js'

const BINS = [
  { maxMa: 100, minMa: 90, sampled: 10, nOccs: 20 },
  { maxMa: 50, minMa: 40, sampled: 40, nOccs: 80 },
  { maxMa: 10, minMa: 0, sampled: 20, nOccs: 40 },
]

describe('diversitySparkPath', () => {
  it('builds a path and reports peak', () => {
    const { path, max } = diversitySparkPath(BINS)
    expect(max).toBe(40)
    expect(path.startsWith('M ')).toBe(true)
    expect(path.includes(' L ')).toBe(true)
  })
})

describe('diversityPlayheadU', () => {
  it('maps oldest to 0 and youngest toward 1', () => {
    expect(diversityPlayheadU(BINS, 100)).toBeCloseTo(0, 5)
    expect(diversityPlayheadU(BINS, 0)).toBeCloseTo(1, 5)
    expect(diversityPlayheadU(BINS, 50)).toBeGreaterThan(0.3)
  })
})
