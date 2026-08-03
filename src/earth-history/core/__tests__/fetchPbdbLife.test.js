import { describe, expect, it } from 'vitest'
import {
  PBDB_MAX_SUPPORTED_MA,
  colorForPhylum,
  isPbdbAgeSupported,
  pbdbAgeWindow,
  quantizePbdbAgeMa,
  recordToLifePoint,
} from '../../../services/earthHistory/fetchPbdbLife.js'

describe('pbdbAgeWindow', () => {
  it('keeps minMa <= maxMa', () => {
    const w = pbdbAgeWindow(66)
    expect(w.minMa).toBeLessThanOrEqual(w.maxMa)
    expect(w.minMa).toBeLessThan(66)
    expect(w.maxMa).toBeGreaterThan(66)
  })

  it('narrows near present', () => {
    const w = pbdbAgeWindow(0.01)
    expect(w.maxMa - w.minMa).toBeLessThan(0.1)
  })
})

describe('quantizePbdbAgeMa', () => {
  it('quantizes Cenozoic to whole Ma', () => {
    expect(quantizePbdbAgeMa(23.4)).toBe(23)
  })
})

describe('isPbdbAgeSupported', () => {
  it('supports Phanerozoic focus', () => {
    expect(isPbdbAgeSupported(0)).toBe(true)
    expect(isPbdbAgeSupported(PBDB_MAX_SUPPORTED_MA)).toBe(true)
    expect(isPbdbAgeSupported(PBDB_MAX_SUPPORTED_MA + 50)).toBe(false)
  })
})

describe('recordToLifePoint', () => {
  it('prefers paleocoordinates', () => {
    const pt = recordToLifePoint(
      {
        occurrence_no: 1,
        paleolat: 10,
        paleolng: 20,
        lat: 40,
        lng: -70,
        accepted_name: 'Testis',
        phylum: 'Chordata',
      },
      0,
    )
    expect(pt.lat).toBe(10)
    expect(pt.lng).toBe(20)
    expect(pt.paleo).toBe(true)
    expect(pt.color).toBe(colorForPhylum('Chordata'))
  })

  it('falls back to modern coords', () => {
    const pt = recordToLifePoint({ lat: 1, lng: 2, identified_name: 'X' }, 3)
    expect(pt.lat).toBe(1)
    expect(pt.paleo).toBe(false)
  })
})
