import { describe, expect, it } from 'vitest'
import {
  MACROSTRAT_MAX_SUPPORTED_MA,
  columnFeatureStyle,
  isMacrostratAgeSupported,
  normalizeMacrostratFeatures,
  quantizeMacrostratAgeMa,
} from '../../../services/earthHistory/fetchMacrostratGeology.js'

describe('quantizeMacrostratAgeMa', () => {
  it('uses 1 Ma steps in the Cenozoic', () => {
    expect(quantizeMacrostratAgeMa(12.4)).toBe(12)
  })

  it('uses coarser steps deeper in time', () => {
    expect(quantizeMacrostratAgeMa(203)).toBe(205)
    expect(quantizeMacrostratAgeMa(1010)).toBe(1000)
  })
})

describe('isMacrostratAgeSupported', () => {
  it('supports Macrostrat rock-record span', () => {
    expect(isMacrostratAgeSupported(0)).toBe(true)
    expect(isMacrostratAgeSupported(MACROSTRAT_MAX_SUPPORTED_MA)).toBe(true)
    expect(isMacrostratAgeSupported(MACROSTRAT_MAX_SUPPORTED_MA + 10)).toBe(false)
  })
})

describe('normalizeMacrostratFeatures', () => {
  it('tags features for geology overlay styling', () => {
    const features = normalizeMacrostratFeatures(
      [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [0, 0] },
          properties: {
            col_id: 1,
            col_name: 'Test',
            lith: [{ class: 'sedimentary' }],
          },
        },
      ],
      100,
    )
    expect(features).toHaveLength(1)
    expect(features[0].__ehKind).toBe('geology')
    expect(features[0].properties.__ehCap).toContain('rgba')
    expect(columnFeatureStyle(features[0]).cap).toBeTruthy()
  })
})
