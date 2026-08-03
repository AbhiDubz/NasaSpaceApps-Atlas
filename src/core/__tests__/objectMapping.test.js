import { describe, expect, it } from 'vitest'
import {
  deriveCountry,
  mapEventToObjects,
  mapEventsToObjects,
  objectKindForEvent,
  registryAliases,
  registryCanonicalId,
  shouldPersistEvent,
} from '../objectMapping.js'

function makeEvent(overrides = {}) {
  return {
    id: 'evt1',
    title: 'M6.2 Earthquake near Sendai',
    dimension: 'environment',
    lat: 38.2,
    lng: 140.9,
    severity: 4,
    corroborationCount: 1,
    corroborationSources: ['usgs'],
    source: 'USGS',
    timestamp: '2026-08-01T00:00:00.000Z',
    tags: ['earthquake', 'Japan'],
    ...overrides,
  }
}

describe('registryCanonicalId', () => {
  it('keys vessels on MMSI and assets on NORAD / ICAO', () => {
    expect(registryCanonicalId({ mmsi: '123' }, 'vessel')).toBe('vessel:mmsi-123')
    expect(registryCanonicalId({ noradId: 25544 }, 'asset')).toBe('asset:norad-25544')
    expect(registryCanonicalId({ icao24: 'ABC123' }, 'asset')).toBe('asset:icao-abc123')
    expect(registryCanonicalId({ id: 'evt1' }, 'event')).toBeNull()
  })
})

describe('registryAliases', () => {
  it('collects registry labels without duplicates', () => {
    expect(registryAliases({
      shipName: 'EVER GIVEN',
      mmsi: '636019825',
      callsign: 'EVER',
    })).toEqual(['EVER GIVEN', 'MMSI 636019825', 'EVER'])
  })
})

describe('shouldPersistEvent', () => {
  it('keeps corroborated, high-severity, and registry-keyed records', () => {
    expect(shouldPersistEvent(makeEvent({ corroborationCount: 2 }))).toBe(true)
    expect(shouldPersistEvent(makeEvent({ severity: 3 }))).toBe(true)
    expect(shouldPersistEvent(makeEvent({
      corroborationSources: ['aisstream'],
      mmsi: '1',
      severity: 1,
      corroborationCount: 1,
    }))).toBe(true)
    expect(shouldPersistEvent(makeEvent({ severity: 1, corroborationCount: 1 }))).toBe(false)
  })
})

describe('objectKindForEvent', () => {
  it('types records by their source', () => {
    expect(objectKindForEvent(makeEvent())).toBe('event')
    expect(objectKindForEvent(makeEvent({ corroborationSources: ['aisstream'] }))).toBe('vessel')
    expect(objectKindForEvent(makeEvent({ corroborationSources: ['celestrak-tle'] }))).toBe('asset')
    expect(objectKindForEvent(makeEvent({ corroborationSources: ['fred'] }))).toBe('economic_indicator')
    expect(objectKindForEvent(makeEvent({ corroborationSources: ['gdelt'] }))).toBe('news_item')
  })

  it('falls back to a generic event for unregistered sources', () => {
    expect(objectKindForEvent(makeEvent({ corroborationSources: ['brand-new'] }))).toBe('event')
  })
})

describe('deriveCountry', () => {
  it('recognises a country named in the tags', () => {
    expect(deriveCountry(makeEvent())?.iso).toBe('JP')
  })

  it('reads the trailing segment of a location name', () => {
    const c = deriveCountry(makeEvent({ tags: [], locationName: 'Sendai, Japan' }))
    expect(c?.iso).toBe('JP')
    expect(c?.name).toBe('Japan')
  })

  it('returns null rather than guessing when nothing names a country', () => {
    expect(deriveCountry(makeEvent({ tags: ['earthquake'], locationName: '' }))).toBeNull()
  })
})

describe('mapEventToObjects', () => {
  it('carries dimension through to the object domain', () => {
    const { objects } = mapEventToObjects(makeEvent())
    const root = objects.find((o) => o.canonicalId === 'event:evt1')
    expect(root?.domain).toBe('environment')
  })

  it('links an event into its country', () => {
    const { objects, links } = mapEventToObjects(makeEvent())
    expect(objects.some((o) => o.canonicalId === 'country:jp')).toBe(true)
    expect(links).toContainEqual(expect.objectContaining({
      fromId: 'event:evt1',
      toId: 'country:jp',
      type: 'located_in',
    }))
  })

  it('links an indicator to its country with MEASURES, not LOCATED_IN', () => {
    const { links } = mapEventToObjects(makeEvent({
      corroborationSources: ['fred'],
      dimension: 'economy',
      tags: ['economic', 'United States'],
    }))
    expect(links).toContainEqual(expect.objectContaining({ type: 'measures', toId: 'country:us' }))
    expect(links.some((l) => l.type === 'located_in')).toBe(false)
  })

  it('attaches actors as involved_in for events and mentioned_in for news', () => {
    const conflict = mapEventToObjects(makeEvent({
      corroborationSources: ['gdelt-cameo'],
      actor1: 'Government of Kenya',
      actor2: 'Opposition Coalition',
    }))
    expect(conflict.objects.filter((o) => o.kind === 'actor')).toHaveLength(2)
    expect(conflict.links.every((l) => l.type !== 'mentioned_in')).toBe(true)
    expect(conflict.links.some((l) => l.type === 'involved_in')).toBe(true)

    const news = mapEventToObjects(makeEvent({
      corroborationSources: ['gdelt'],
      actor1: 'Government of Kenya',
    }))
    expect(news.links.some((l) => l.type === 'mentioned_in')).toBe(true)
  })

  it('keys vessels on MMSI rather than a slug of the ship name', () => {
    const { objects } = mapEventToObjects(makeEvent({
      corroborationSources: ['aisstream'],
      mmsi: '636019825',
      shipName: 'EVER GIVEN',
      title: 'EVER GIVEN',
    }))
    const vessel = objects.find((o) => o.kind === 'vessel')
    expect(vessel?.canonicalId).toBe('vessel:mmsi-636019825')
    expect(vessel?.aliases).toContain('EVER GIVEN')
  })

  it('writes corroboration clusters out as correlation links', () => {
    const { links } = mapEventToObjects(makeEvent({
      correlatedEventIds: ['evt2', 'evt3'],
      threadId: 'thread-a',
      corroborationScore: 0.82,
    }))
    const correlations = links.filter((l) => l.type === 'correlation')
    expect(correlations.map((l) => l.toId)).toEqual(['event:evt2', 'event:evt3'])
    expect(correlations[0].confidence).toBe(0.82)
  })

  it('drops null-island coordinates instead of placing objects there', () => {
    const { objects } = mapEventToObjects(makeEvent({ lat: 0, lng: 0, tags: [] }))
    expect(objects[0].lat).toBeUndefined()
  })

  it('ignores events without an id', () => {
    expect(mapEventToObjects({ title: 'orphan' })).toEqual({ objects: [], links: [] })
  })
})

describe('mapEventsToObjects', () => {
  it('merges repeated objects and unions their sources', () => {
    const { objects } = mapEventsToObjects([
      makeEvent({ id: 'a', tags: ['Japan'] }),
      makeEvent({ id: 'b', tags: ['Japan'], corroborationSources: ['gdacs'] }),
    ])
    const japan = objects.filter((o) => o.canonicalId === 'country:jp')
    expect(japan).toHaveLength(1)
    expect(japan[0].sourceIds.sort()).toEqual(['gdacs', 'usgs'])
  })

  it('de-duplicates identical links', () => {
    const { links } = mapEventsToObjects([
      makeEvent({ id: 'a', locationName: 'Sendai' }),
      makeEvent({ id: 'a', locationName: 'Sendai' }),
    ])
    const placeLinks = links.filter((l) => l.type === 'occurred_near')
    expect(placeLinks).toHaveLength(1)
  })
})
