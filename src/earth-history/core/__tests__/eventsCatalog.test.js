import { describe, expect, it } from 'vitest'
import {
  DEEP_TIME_EVENTS,
  eventYbp,
  eventsInRange,
  nearestEvent,
} from '../eventsCatalog.js'
import { EARTH_BIRTH_YBP, maToYbp } from '../timeScale.js'

describe('eventsCatalog', () => {
  it('has unique ids and finite ages', () => {
    const ids = new Set()
    for (const e of DEEP_TIME_EVENTS) {
      expect(e.id).toBeTruthy()
      expect(ids.has(e.id)).toBe(false)
      ids.add(e.id)
      expect(Number.isFinite(e.ageMa)).toBe(true)
      expect(e.ageMa).toBeGreaterThanOrEqual(0)
      expect(e.summary.length).toBeGreaterThan(10)
    }
  })

  it('filters events to editable range', () => {
    const meso = eventsInRange({ startYbp: maToYbp(252), endYbp: maToYbp(66) })
    expect(meso.some((e) => e.id === 'permian-triassic')).toBe(true)
    expect(meso.some((e) => e.id === 'kt-extinction')).toBe(true)
    expect(meso.some((e) => e.id === 'agriculture')).toBe(false)
  })

  it('finds nearest event in slider space within threshold', () => {
    const range = { startYbp: EARTH_BIRTH_YBP, endYbp: 0 }
    const hit = nearestEvent(eventYbp({ ageMa: 66 }), range)
    expect(hit?.event.id).toBe('kt-extinction')
  })

  it('returns null when playhead is far from any marker', () => {
    const range = { startYbp: EARTH_BIRTH_YBP, endYbp: 0 }
    const hit = nearestEvent(maToYbp(1000), range, { maxSliderDist: 0.005 })
    expect(hit).toBeNull()
  })
})
