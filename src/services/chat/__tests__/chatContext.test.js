import { describe, expect, it } from 'vitest'
import { buildChatContext, readNdjson, suggestedQuestions } from '../chatContext.js'

const SEATTLE = { lat: 47.61, lng: -122.33, label: 'Seattle, Washington' }

const result = {
  verdict: 'Getting more humid: about 0.8 % more per decade.',
  step: 'month',
  significant: true,
  direction: 'rising',
  slopePerDecade: 0.812345,
  ci95: [0.41234, 1.2001],
  pValue: 0.00123456,
  ols: { slopePerDecade: 0.79, pValue: 0.002 },
  monthsUsed: 540,
  firstMonth: '1981-01',
  lastMonth: '2025-12',
  elevation: 112.4,
  // Bulky series must not be sent to the model.
  values: new Array(540).fill(70),
  seasons: [{ id: 'summer', label: 'Summer', span: 'Jun–Aug', slopePerDecade: 1.2, pValue: 0.01, significant: true, direction: 'rising' }],
  oppositeSeasons: { rising: 'summer', falling: 'spring', crossYear: 2003 },
}

describe('buildChatContext', () => {
  it('returns null when no case is open', () => {
    expect(buildChatContext({ trendCase: null })).toBeNull()
  })

  it('summarizes the open case with rounded numbers and no raw series', () => {
    const ctx = buildChatContext({
      trendCase: { places: [SEATTLE], variable: 'RH2M', season: 'all' },
      results: [{ data: result }],
    })
    expect(ctx.variable.code).toBe('RH2M')
    expect(ctx.partOfYear).toBe('whole year')
    const r = ctx.places[0].result
    expect(ctx.places[0].name).toBe('Seattle, Washington')
    expect(r.ratePerDecade).toBe(0.8123)
    expect(r.range95).toEqual([0.4123, 1.2])
    expect(r.pValue).toBe(0.001235)
    expect(r.oppositeSeasons).toEqual({ rising: 'Summer', falling: 'Spring', trendLinesCross: 2003 })
    expect(r.elevationM).toBe(112)
    expect(JSON.stringify(ctx)).not.toContain('"values"')
    expect(ctx.openSavedCase).toBeUndefined()
  })

  it('names the saved case when it is the one open', () => {
    const ctx = buildChatContext({ trendCase: { places: [SEATTLE], variable: 'AOD_55', season: 'all' } })
    expect(ctx.openSavedCase).toBe('Seattle haze: two seasons, two answers')
  })

  it('marks places whose results are loading or failed', () => {
    const ctx = buildChatContext({
      trendCase: { places: [SEATTLE, { lat: 46.6, lng: -120.51 }], variable: 'T2M', season: 'summer' },
      results: [{ loading: true }, { error: 'Grid file responded 500' }],
    })
    expect(ctx.partOfYear).toBe('Summer (Jun–Aug)')
    expect(ctx.places[0].result).toEqual({ status: 'still loading' })
    expect(ctx.places[1].result).toEqual({ error: 'Grid file responded 500' })
  })

  it('lists every measure at a single place from the scan', () => {
    const ctx = buildChatContext({
      trendCase: { places: [SEATTLE], variable: 'RH2M', season: 'all' },
      results: [{ data: result }],
      scan: { RH2M: { data: result }, T2M: { error: 'down' } },
    })
    expect(ctx.everyMeasureHere.complete).toBe(false)
    expect(ctx.everyMeasureHere.measures).toHaveLength(1)
    expect(ctx.everyMeasureHere.measures[0]).toMatchObject({ code: 'RH2M', significant: true, oppositeSeasons: 'Summer rising, Spring falling' })
  })
})

describe('suggestedQuestions', () => {
  it('offers getting-started questions with no place picked', () => {
    expect(suggestedQuestions(null)[0]).toMatch(/Trend Detective/)
  })

  it('asks about opposite seasons when the case has them', () => {
    const qs = suggestedQuestions({ places: [SEATTLE], variable: 'RH2M', season: 'all' }, result)
    expect(qs).toContain('Why do the seasons trend in opposite directions?')
    expect(qs).toContain('What else is changing at Seattle?')
  })
})

describe('readNdjson', () => {
  it('reassembles lines split across chunks and skips bad lines', async () => {
    const enc = new TextEncoder()
    const parts = ['{"t":"Hel', 'lo"}\n{"t":" world"}\nnot json\n', '{"done":true}']
    const body = new ReadableStream({
      start(c) {
        parts.forEach((p) => c.enqueue(enc.encode(p)))
        c.close()
      },
    })
    const events = []
    await readNdjson(body, (e) => events.push(e))
    expect(events).toEqual([{ t: 'Hello' }, { t: ' world' }, { done: true }])
  })
})
