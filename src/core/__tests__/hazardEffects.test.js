import { describe, expect, it } from 'vitest'
import { HAZARD_TYPES } from '../environmentHazardClassifier.js'
import {
  getHazardEffectProfile,
  listHazardModelIds,
  resolveHazardModelScale,
  HAZARD_EFFECT_PROFILES,
} from '../environmentHazardEffects.js'
import { resolveHazardVisualLod, selectHazardModelIds } from '../hazardVisualLod.js'

describe('environmentHazardEffects', () => {
  it('covers all 16 hazard types', () => {
    for (const t of Object.values(HAZARD_TYPES)) {
      expect(getHazardEffectProfile(t)).toBeTruthy()
      expect(HAZARD_EFFECT_PROFILES[t].modelId).toBeTruthy()
      expect(HAZARD_EFFECT_PROFILES[t].anim2dClass).toMatch(/^atlas-hazard--/)
    }
  })

  it('lists unique model ids', () => {
    const ids = listHazardModelIds()
    expect(ids.length).toBeGreaterThan(8)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('scales models by severity and camera range', () => {
    const p = getHazardEffectProfile(HAZARD_TYPES.HURRICANE)
    expect(resolveHazardModelScale(p, 5, 500_000)).toBeGreaterThan(resolveHazardModelScale(p, 2, 500_000))
    expect(resolveHazardModelScale(p, 3, 24_000_000)).toBeGreaterThan(resolveHazardModelScale(p, 3, 50_000))
  })
})

describe('hazardVisualLod', () => {
  it('forces sprite on low quality only (orbit still uses models)', () => {
    expect(
      resolveHazardVisualLod({
        resolvedTier: 'low',
        hasModel: true,
        severity: 4,
        cameraRangeM: 100_000,
      }),
    ).toBe('sprite')
    expect(
      resolveHazardVisualLod({
        resolvedTier: 'high',
        hasModel: true,
        severity: 4,
        cameraRangeM: 24_000_000,
      }),
    ).toBe('model')
  })

  it('allows model when near and severity ok', () => {
    expect(
      resolveHazardVisualLod({
        resolvedTier: 'high',
        hasModel: true,
        severity: 3,
        cameraRangeM: 500_000,
        reduceMotion: false,
      }),
    ).toBe('model')
  })

  it('caps model selection by budget', () => {
    const markers = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`,
      severity: i,
      modelUrl: '/m.glb',
      environmentHazard: 'wildfire',
    }))
    const ids = selectHazardModelIds(markers, 3)
    expect(ids.size).toBe(3)
    expect(ids.has('e9')).toBe(true)
  })
})
