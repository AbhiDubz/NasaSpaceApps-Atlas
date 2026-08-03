import { describe, expect, it, vi } from 'vitest'
import {
  FUZZY_MATCH_THRESHOLD,
  RESOLUTION_CONFIDENCE,
  buildCanonicalId,
  resolveEntity,
} from '../entityResolution.js'

const nullLookups = {
  byCanonicalId: async () => null,
  byAlias: async () => null,
  byFuzzy: async () => null,
}

function candidate(label, kind = 'actor') {
  return { canonicalId: buildCanonicalId(label, kind), label, kind }
}

describe('resolveEntity', () => {
  it('prefers an exact canonical id hit and skips the later legs', async () => {
    const row = { id: 'a', resolution_method: 'exact' }
    const byAlias = vi.fn(async () => ({ id: 'b' }))
    const byFuzzy = vi.fn(async () => ({ id: 'c' }))

    const result = await resolveEntity(candidate('Apple Inc'), {
      byCanonicalId: async () => row,
      byAlias,
      byFuzzy,
    })

    expect(result.match).toBe(row)
    expect(result.method).toBe('exact')
    expect(result.confidence).toBe(RESOLUTION_CONFIDENCE.exact)
    expect(byAlias).not.toHaveBeenCalled()
    expect(byFuzzy).not.toHaveBeenCalled()
  })

  it('falls through to alias before fuzzy', async () => {
    const byFuzzy = vi.fn(async () => ({ id: 'c' }))
    const result = await resolveEntity(candidate('AAPL'), {
      ...nullLookups,
      byAlias: async () => ({ id: 'b', resolution_method: 'exact' }),
      byFuzzy,
    })

    expect(result.method).toBe('alias')
    expect(result.confidence).toBe(RESOLUTION_CONFIDENCE.alias)
    expect(byFuzzy).not.toHaveBeenCalled()
  })

  it('accepts a fuzzy match with reduced confidence', async () => {
    const result = await resolveEntity(candidate('Apple Incorporated'), {
      ...nullLookups,
      byFuzzy: async () => ({ id: 'c', resolution_method: 'exact' }),
    })

    expect(result.method).toBe('fuzzy')
    expect(result.confidence).toBe(RESOLUTION_CONFIDENCE.fuzzy)
    expect(result.confidence).toBeLessThan(RESOLUTION_CONFIDENCE.alias)
  })

  it('passes the configured threshold to the fuzzy lookup', async () => {
    const byFuzzy = vi.fn(async () => null)
    await resolveEntity(candidate('Somewhere', 'place'), { ...nullLookups, byFuzzy })
    expect(byFuzzy).toHaveBeenCalledWith('Somewhere', 'place', FUZZY_MATCH_THRESHOLD)

    await resolveEntity(candidate('Somewhere', 'place'), { ...nullLookups, byFuzzy }, { threshold: 0.9 })
    expect(byFuzzy).toHaveBeenLastCalledWith('Somewhere', 'place', 0.9)
  })

  it('never fuzzy-matches events — two similar titles are two events', async () => {
    const byFuzzy = vi.fn(async () => ({ id: 'c' }))
    const result = await resolveEntity(
      { canonicalId: 'event:abc', label: 'M5.1 Earthquake near Tokyo', kind: 'event' },
      { ...nullLookups, byFuzzy },
    )

    expect(byFuzzy).not.toHaveBeenCalled()
    expect(result.method).toBe('new')
  })

  it('reports a manual row as manual however it was found', async () => {
    const result = await resolveEntity(candidate('Apple Computer'), {
      ...nullLookups,
      byFuzzy: async () => ({ id: 'c', resolution_method: 'manual' }),
    })

    expect(result.method).toBe('manual')
    expect(result.confidence).toBe(1.0)
  })

  it('returns new when nothing matches', async () => {
    const result = await resolveEntity(candidate('Entirely Novel Org'), nullLookups)
    expect(result.match).toBeNull()
    expect(result.method).toBe('new')
  })

  it('works without a fuzzy lookup at all', async () => {
    const result = await resolveEntity(candidate('No Fuzzy Available'), {
      byCanonicalId: async () => null,
      byAlias: async () => null,
    })
    expect(result.method).toBe('new')
  })
})
