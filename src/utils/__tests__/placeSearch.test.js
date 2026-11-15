import { describe, expect, it } from 'vitest'
import { photonFeatureToSuggestion } from '../placeSearch'

const feature = (properties, coordinates = [-122.3321, 47.6062]) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties,
})

describe('photonFeatureToSuggestion', () => {
  it('labels a street address by house number and street', () => {
    const s = photonFeatureToSuggestion(feature({
      osm_type: 'N', osm_id: 1, type: 'house',
      housenumber: '400', street: 'Broad Street', city: 'Seattle', state: 'Washington', country: 'United States',
    }))
    expect(s.main).toBe('400 Broad Street')
    expect(s.secondary).toBe('Seattle, Washington, United States')
    expect(s.types).toEqual(['street_address'])
    expect(s.resolved.lat).toBeCloseTo(47.6062)
    // Point results get a small synthetic viewport so the camera zooms to street level.
    expect(s.resolved.viewport.north - s.resolved.viewport.south).toBeLessThan(0.01)
  })

  it('uses the extent for areas and maps cities to locality', () => {
    const s = photonFeatureToSuggestion(feature({
      osm_type: 'R', osm_id: 2, type: 'city', name: 'Seattle', state: 'Washington', country: 'United States',
      extent: [-122.46, 47.73, -122.22, 47.49],
    }))
    expect(s.main).toBe('Seattle')
    expect(s.types).toContain('locality')
    expect(s.resolved.viewport).toEqual({ north: 47.73, south: 47.49, east: -122.22, west: -122.46 })
  })

  it('keeps the street line as secondary text for named buildings', () => {
    const s = photonFeatureToSuggestion(feature({
      type: 'house', name: 'Space Needle', housenumber: '400', street: 'Broad Street', city: 'Seattle',
    }))
    expect(s.main).toBe('Space Needle')
    expect(s.secondary).toBe('400 Broad Street, Seattle')
  })

  it('drops features without coordinates or a label', () => {
    expect(photonFeatureToSuggestion({ properties: { name: 'x' }, geometry: null })).toBeNull()
    expect(photonFeatureToSuggestion(feature({}))).toBeNull()
  })
})
