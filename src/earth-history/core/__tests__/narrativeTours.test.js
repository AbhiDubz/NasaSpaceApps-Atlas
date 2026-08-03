import { describe, expect, it } from 'vitest'
import {
  NARRATIVE_TOURS,
  getTourById,
  resolveChapter,
  tourRangeYbp,
} from '../narrativeTours.js'
import { validateRange } from '../timeScale.js'

describe('narrativeTours', () => {
  it('has unique tour ids and valid ranges', () => {
    const ids = new Set()
    for (const tour of NARRATIVE_TOURS) {
      expect(ids.has(tour.id)).toBe(false)
      ids.add(tour.id)
      expect(tour.chapters.length).toBeGreaterThan(1)
      const range = tourRangeYbp(tour)
      expect(validateRange(range.startYbp, range.endYbp).ok).toBe(true)
    }
  })

  it('resolves event-linked chapters to YBP', () => {
    const tour = getTourById('big-five')
    const ch = resolveChapter(tour.chapters[0])
    expect(ch.eventId).toBe('ordovician-extinction')
    expect(ch.ybp).toBeGreaterThan(0)
    expect(ch.note.length).toBeGreaterThan(10)
  })
})
