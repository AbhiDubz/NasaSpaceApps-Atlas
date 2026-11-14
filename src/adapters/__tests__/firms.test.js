import { describe, expect, it } from 'vitest'
import { firmsSeverity, parseFirmsCsv, pickFirmsDetections } from '../firms.js'

const HEADER = 'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight'
const row = (lat, lng, date, time, conf, frp) => `${lat},${lng},330,0.5,0.5,${date},${time},N21,VIIRS,${conf},2.0NRT,280,${frp},D`

describe('FIRMS adapter', () => {
  it('parses HHMM times without leading zeros as UTC and maps confidence codes', () => {
    const rows = parseFirmsCsv([HEADER, row(10, 20, '2026-11-14', '104', 'h', 12.5), row(1, 2, '2026-11-14', '1830', 'n', 3)].join('\n'))
    expect(new Date(rows[0].timeMs).toISOString()).toBe('2026-11-14T01:04:00.000Z')
    expect(rows[0]).toMatchObject({ high: true, confidenceLabel: 'high', frp: 12.5 })
    expect(new Date(rows[1].timeMs).toISOString()).toBe('2026-11-14T18:30:00.000Z')
    expect(rows[1].high).toBe(false)
  })

  it('returns nothing for an empty or error response', () => {
    expect(parseFirmsCsv(HEADER)).toEqual([])
    expect(parseFirmsCsv('Invalid MAP_KEY.')).toEqual([])
    expect(parseFirmsCsv('')).toEqual([])
  })

  it('keeps the strongest recent fires first, then the strongest of the day', () => {
    const rows = [HEADER]
    for (let i = 0; i < 200; i++) rows.push(row(i % 80, i, '2026-11-14', String(100 + (i % 60)), 'n', i)) // around 01:00 UTC, up to 199 MW
    for (let i = 0; i < 60; i++) rows.push(row(-10, i, '2026-11-14', '2300', 'n', 5 + i)) // newest hour, weak
    const picked = pickFirmsDetections(parseFirmsCsv(rows.join('\n')))
    expect(picked).toHaveLength(80)
    const recent = picked.filter((d) => d.lat === -10)
    expect(recent).toHaveLength(40)
    expect(Math.min(...recent.map((d) => d.frp))).toBe(25)
    expect(Math.max(...picked.map((d) => d.frp))).toBe(199)
  })

  it('never gives a kept fire severity 1', () => {
    expect(firmsSeverity({ frp: 2, high: false })).toBe(2)
    expect(firmsSeverity({ frp: 60, high: true })).toBe(3)
    expect(firmsSeverity({ frp: 150, high: false })).toBe(3)
    expect(firmsSeverity({ frp: 400, high: false })).toBe(4)
  })
})
