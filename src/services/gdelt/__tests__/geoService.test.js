import { describe, expect, it } from 'vitest'
import { choroplethToneRange, toneToChoroplethColor, toneToChoroplethRgba } from '../geoService.js'

const row = (tone, count) => ({ tone, count })

describe('choroplethToneRange', () => {
  it('is symmetric around zero', () => {
    const { min, max } = choroplethToneRange([row(-4, 10), row(-2, 8), row(3, 5), row(1, 4)])
    expect(min).toBe(-max)
    expect(max).toBeGreaterThan(0)
  })

  it('ignores a one-event outlier when setting the scale', () => {
    const rows = [row(-2, 100), row(-3, 50), row(-4, 40), row(1, 30), row(-14, 1)]
    expect(choroplethToneRange(rows).max).toBeLessThanOrEqual(4)
  })

  it('falls back to a default with no rows', () => {
    expect(choroplethToneRange([])).toEqual({ min: -5, max: 5 })
  })
})

describe('toneToChoroplethColor', () => {
  it('uses different hues for negative and positive tone', () => {
    const neg = toneToChoroplethColor(-3, -5, 5, 20)
    const pos = toneToChoroplethColor(3, -5, 5, 20)
    expect(neg.rgb).not.toEqual(pos.rgb)
    expect(neg.rgb[0]).toBeGreaterThan(neg.rgb[2])
    expect(pos.rgb[2]).toBeGreaterThan(pos.rgb[0])
  })

  it('keeps near-neutral countries almost clear and caps strong ones', () => {
    expect(toneToChoroplethColor(0.1, -5, 5, 20).alpha).toBeLessThan(0.1)
    expect(toneToChoroplethColor(-50, -5, 5, 20).alpha).toBeLessThanOrEqual(0.4)
  })

  it('dims countries backed by a single event', () => {
    const thin = toneToChoroplethColor(-5, -5, 5, 1).alpha
    const solid = toneToChoroplethColor(-5, -5, 5, 20).alpha
    expect(thin).toBeLessThan(solid)
  })

  it('formats an rgba string', () => {
    expect(toneToChoroplethRgba(-5, -5, 5, 20)).toMatch(/^rgba\(\d+,\d+,\d+,0\.\d+\)$/)
  })
})
