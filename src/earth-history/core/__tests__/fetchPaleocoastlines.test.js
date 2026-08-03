import { describe, expect, it } from 'vitest'
import {
  GWS_MODEL_MAX_MA,
  isCoastlineAgeSupported,
  localCoastlineMatchToleranceMa,
  pickNearestCoastlineFrame,
  quantizeCoastlineAgeMa,
} from '../../../services/earthHistory/fetchPaleocoastlines.js'

describe('quantizeCoastlineAgeMa', () => {
  it('uses 0.5 Ma steps in the Cenozoic', () => {
    expect(quantizeCoastlineAgeMa(12.24)).toBe(12)
    expect(quantizeCoastlineAgeMa(12.3)).toBe(12.5)
  })

  it('uses 5 Ma steps in most of the Phanerozoic', () => {
    expect(quantizeCoastlineAgeMa(203)).toBe(205)
    expect(quantizeCoastlineAgeMa(66)).toBe(66)
  })

  it('uses 25 Ma steps deeper in time', () => {
    expect(quantizeCoastlineAgeMa(1010)).toBe(1000)
  })
})

describe('isCoastlineAgeSupported', () => {
  it('supports CAO2024 span', () => {
    expect(isCoastlineAgeSupported(0)).toBe(true)
    expect(isCoastlineAgeSupported(GWS_MODEL_MAX_MA)).toBe(true)
    expect(isCoastlineAgeSupported(GWS_MODEL_MAX_MA + 10)).toBe(false)
  })
})

describe('pickNearestCoastlineFrame', () => {
  const frames = [
    { ageMa: 0, path: '/c/0.json' },
    { ageMa: 66, path: '/c/66.json' },
    { ageMa: 252, path: '/c/252.json' },
  ]

  it('picks the closest baked age', () => {
    expect(pickNearestCoastlineFrame(frames, 70)?.ageMa).toBe(66)
    expect(pickNearestCoastlineFrame(frames, 200)?.ageMa).toBe(252)
  })

  it('returns null for empty frames', () => {
    expect(pickNearestCoastlineFrame([], 10)).toBe(null)
  })
})

describe('localCoastlineMatchToleranceMa', () => {
  it('widens tolerance deeper in time', () => {
    expect(localCoastlineMatchToleranceMa(10)).toBe(3)
    expect(localCoastlineMatchToleranceMa(200)).toBe(20)
    expect(localCoastlineMatchToleranceMa(1000)).toBe(80)
  })
})
