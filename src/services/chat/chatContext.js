/**
 * Ask Atlas — what the chatbot is told about the screen.
 *
 * Turns the open Trend Detective case (and the trend results the panel is
 * already showing) into a small JSON object for /api/chat, so the model can
 * quote the real numbers instead of guessing. Pure, no I/O.
 */
import { POWER_VARIABLES } from '../nasaPower/variables.js'
import { seasonById } from '../nasaPower/trendStats.js'
import { summarizeScan } from '../nasaPower/scan.js'
import { gridCell } from '../nasaPower/grid.js'
import { demoPlaceLabel, TREND_DEMOS } from '../nasaPower/demos.js'

/** The saved case whose places and variable match what is open, if any. */
function openSavedCase(trendCase) {
  const places = trendCase.places || []
  return TREND_DEMOS.find(
    (d) =>
      d.variable === trendCase.variable &&
      d.places.length === places.length &&
      d.places.every((p, i) => p.lat === places[i].lat && p.lng === places[i].lng),
  )
}

/** Four significant digits is plenty for a model to quote and keeps the payload small. */
function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Number(v.toPrecision(4)) : null
}

function placeName(place) {
  return place.label || demoPlaceLabel(place.lat, place.lng) || `${place.lat.toFixed(2)}, ${place.lng.toFixed(2)}`
}

/** The parts of a trend result worth quoting; the series themselves stay out. */
export function summarizeResult(data) {
  const out = {
    verdict: data.verdict,
    tested: data.step === 'year' ? `${data.seasonLabel} only (${data.seasonSpan}), one average per year` : 'every month, seasons removed',
    significant: Boolean(data.significant),
    direction: data.direction,
    ratePerDecade: num(data.slopePerDecade),
    range95: Array.isArray(data.ci95) ? data.ci95.map(num) : null,
    pValue: num(data.pValue),
    straightLineCheck: data.ols ? { ratePerDecade: num(data.ols.slopePerDecade), pValue: num(data.ols.pValue) } : null,
    pointsUsed: data.monthsUsed,
    from: data.firstMonth,
    to: data.lastMonth,
  }
  if (Number.isFinite(data.elevation)) out.elevationM = Math.round(data.elevation)
  if (Array.isArray(data.seasons) && data.seasons.length) {
    out.seasons = data.seasons.map((s) => ({
      season: `${s.label} (${s.span})`,
      ratePerDecade: num(s.slopePerDecade),
      pValue: num(s.pValue),
      significant: Boolean(s.significant),
      direction: s.direction,
    }))
  }
  if (data.oppositeSeasons) {
    const { rising, falling, crossYear } = data.oppositeSeasons
    out.oppositeSeasons = {
      rising: seasonById(rising)?.label || rising,
      falling: seasonById(falling)?.label || falling,
      trendLinesCross: crossYear || null,
    }
  }
  return out
}

/**
 * @param {object} input
 * @param {object | null} input.trendCase — the store's trendCase
 * @param {({ data?: object, error?: string, loading?: boolean } | undefined)[]} [input.results] — useTrend() per place
 * @param {Record<string, { data?: object, error?: string }>} [input.scan] — useTrendScan() for a single place
 * @returns {object | null}
 */
export function buildChatContext({ trendCase, results = [], scan } = {}) {
  if (!trendCase) return null
  const meta = POWER_VARIABLES[trendCase.variable] || POWER_VARIABLES.T2M
  const season = seasonById(trendCase.season)

  const places = (trendCase.places || []).map((place, i) => {
    const cell = gridCell(place.lat, place.lng, meta.code)
    const entry = {
      name: placeName(place),
      lat: num(place.lat),
      lng: num(place.lng),
      gridCell: `about ${cell.kmNS} × ${cell.kmEW} km (${cell.source})`,
    }
    const r = results[i]
    if (r?.data) entry.result = summarizeResult(r.data)
    else if (r?.error) entry.result = { error: r.error }
    else entry.result = { status: 'still loading' }
    return entry
  })

  const context = {
    panel: 'Trend Detective',
    variable: { code: meta.code, name: meta.label, unit: meta.unit, definition: meta.definition },
    partOfYear: season ? `${season.label} (${season.span})` : 'whole year',
    places,
  }
  const saved = openSavedCase(trendCase)
  if (saved) context.openSavedCase = saved.title
  if (!places.length) context.note = 'No place picked yet: the user still needs to click a spot in Washington or open a saved case.'
  if (trendCase.pickingCompare) context.note = 'The user is about to click a second place to compare.'

  // "What is changing here?": every measure at the single open place.
  if (places.length === 1 && scan) {
    const summary = summarizeScan(scan, season?.id || 'all')
    const ready = summary.rows.filter((row) => row.status === 'ready')
    if (ready.length) {
      context.everyMeasureHere = {
        complete: summary.complete,
        measures: ready.map((row) => ({
          code: row.code,
          name: POWER_VARIABLES[row.code].label,
          unit: POWER_VARIABLES[row.code].unit,
          ratePerDecade: num(row.slopePerDecade),
          pValue: num(row.pValue),
          significant: row.significant,
          direction: row.direction,
          ...(row.opposite
            ? { oppositeSeasons: `${seasonById(row.opposite.rising)?.label} rising, ${seasonById(row.opposite.falling)?.label} falling` }
            : {}),
        })),
      }
    }
  }
  return context
}

/** Questions to offer before the first message, fitted to what is open. */
export function suggestedQuestions(trendCase, firstResult) {
  if (!trendCase || !trendCase.places?.length) {
    return [
      'What was the temperature in Seattle last February?',
      'What is changing in Spokane?',
      'Which year had the deepest snow at Snoqualmie Pass?',
    ]
  }
  const meta = POWER_VARIABLES[trendCase.variable] || POWER_VARIABLES.T2M
  const name = placeName(trendCase.places[0]).split(',')[0]
  const qs = []
  if (trendCase.places.length > 1) {
    qs.push(`How do these two places compare on ${meta.label.toLowerCase()}?`)
  } else {
    qs.push(`Is this ${meta.label.toLowerCase()} trend real or just noise?`)
  }
  if (firstResult?.oppositeSeasons) qs.push('Why do the seasons trend in opposite directions?')
  else if (firstResult?.significant) qs.push('What might be causing this?')
  else qs.push('What does "not significant yet" mean?')
  if (trendCase.places.length === 1) qs.push(`What else is changing at ${name}?`)
  return qs
}

/**
 * Read an NDJSON reply from /api/chat, calling `onEvent` for each line
 * ({ t } text, { done }, or { error }).
 * @param {ReadableStream<Uint8Array>} body
 * @param {(event: object) => void} onEvent
 */
export async function readNdjson(body, onEvent) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const flush = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      onEvent(JSON.parse(trimmed))
    } catch {
      // A malformed line is skipped rather than ending the reply.
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let cut
    while ((cut = buffer.indexOf('\n')) !== -1) {
      flush(buffer.slice(0, cut))
      buffer = buffer.slice(cut + 1)
    }
  }
  flush(buffer + decoder.decode())
}
