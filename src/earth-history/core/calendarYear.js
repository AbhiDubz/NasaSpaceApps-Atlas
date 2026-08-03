/**
 * Calendar-year helpers for Holocene Earth History UX.
 * Convention: positive = CE, negative = BCE (year 0 unused; -1 = 1 BCE).
 * YBP uses "present" ≈ current calendar year (same as formatDeepTime).
 */

import { normalizeYbp } from './timeScale.js'

/** Holocene / civilization window (years before present). */
export const HOLOCENE_MAX_YBP = 12_000

export function presentCalendarYear(now = new Date()) {
  return now.getFullYear()
}

/**
 * Convert YBP → approximate historical calendar year (CE positive, BCE negative).
 * @param {number} ybp
 * @param {number} [nowYear]
 */
export function ybpToCalendarYear(ybp, nowYear = presentCalendarYear()) {
  const t = normalizeYbp(ybp)
  const raw = nowYear - t
  if (raw >= 1) return Math.round(raw)
  // Map 1 BCE → -1 (skip year 0)
  return Math.round(raw) - 1
}

/**
 * Calendar year → YBP.
 * @param {number} year CE positive / BCE negative
 * @param {number} [nowYear]
 */
export function calendarYearToYbp(year, nowYear = presentCalendarYear()) {
  const y = Number(year)
  if (!Number.isFinite(y) || y === 0) return normalizeYbp(nowYear)
  const ce = y > 0 ? y : y + 1 // -1 (1 BCE) → year 0 CE axis
  return normalizeYbp(nowYear - ce)
}

/**
 * @param {number} year
 */
export function formatCalendarYear(year) {
  const y = Math.round(Number(year))
  if (!Number.isFinite(y) || y === 0) return '1 BCE'
  if (y > 0) return String(y)
  return `${Math.abs(y)} BCE`
}

/**
 * Holocene when playhead is within civilization window.
 * @param {number} ybp
 */
export function isHolocenePlayhead(ybp) {
  return normalizeYbp(ybp) <= HOLOCENE_MAX_YBP + 1e-6
}

/**
 * Chronas-inspired cultural era bands (calendar years).
 * Used only as Holocene timeline chrome.
 */
export const HOLOCENE_ERA_BANDS = Object.freeze([
  { id: 'bronze', name: 'Bronze Age', startYear: -3000, endYear: -1200, color: '#8b6914' },
  { id: 'iron', name: 'Iron Age', startYear: -1200, endYear: -500, color: '#6b5b4a' },
  { id: 'classical', name: 'Classical', startYear: -500, endYear: 500, color: '#8a4a3a' },
  { id: 'early-med', name: 'Early Medieval', startYear: 500, endYear: 1000, color: '#4a5a7a' },
  { id: 'high-med', name: 'High Medieval', startYear: 1000, endYear: 1300, color: '#3a6a5a' },
  { id: 'late-med', name: 'Late Medieval', startYear: 1300, endYear: 1500, color: '#5a4a6a' },
  { id: 'early-mod', name: 'Early Modern', startYear: 1500, endYear: 1800, color: '#6a4a3a' },
  { id: 'modern', name: 'Modern', startYear: 1800, endYear: 2100, color: '#3a5a6a' },
])

/**
 * Format playhead for Holocene UI: calendar year + deep-time fallback.
 * @param {number} ybp
 */
export function formatHolocenePlayhead(ybp) {
  if (!isHolocenePlayhead(ybp)) return null
  const year = ybpToCalendarYear(ybp)
  return formatCalendarYear(year)
}
