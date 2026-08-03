import { describe, expect, it } from 'vitest'
import {
  calendarYearToYbp,
  formatCalendarYear,
  formatHolocenePlayhead,
  isHolocenePlayhead,
  ybpToCalendarYear,
} from '../calendarYear.js'

describe('calendarYear helpers', () => {
  it('round-trips CE years', () => {
    const now = 2026
    const ybp = calendarYearToYbp(1000, now)
    expect(ybpToCalendarYear(ybp, now)).toBe(1000)
  })

  it('formats BCE', () => {
    expect(formatCalendarYear(-500)).toBe('500 BCE')
    expect(formatCalendarYear(1000)).toBe('1000')
  })

  it('detects Holocene playhead', () => {
    expect(isHolocenePlayhead(1000)).toBe(true)
    expect(isHolocenePlayhead(100_000)).toBe(false)
  })

  it('formatHolocenePlayhead returns calendar string in Holocene', () => {
    // ~1000 CE when present ≈ 2026
    expect(formatHolocenePlayhead(1026)).toBe('1000')
  })
})
