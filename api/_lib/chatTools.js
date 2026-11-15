/**
 * Ask Atlas data tools: Gemini calls these to read the NASA records behind
 * Trend Detective, so it can answer "what was the temperature in Seattle in
 * February 2024?" with the real number instead of a guess.
 *
 * Every tool takes a Washington point (lat/lng the model fills in from the
 * place name) and returns small, plain JSON. Errors come back as
 * `{ error }` so the model can explain them.
 */
import { POWER_END_YEAR, POWER_START_YEAR, POWER_VARIABLES, POWER_VARIABLE_CODES, normalizeLatLng } from '../../src/services/nasaPower/variables.js'
import { isInRegion, OUTSIDE_REGION_MESSAGE } from '../../src/services/nasaPower/region.js'
import { seasonalMeans, seasonById, SEASON_IDS } from '../../src/services/nasaPower/trendStats.js'
import { summarizeScan } from '../../src/services/nasaPower/scan.js'
import { gridCell } from '../../src/services/nasaPower/grid.js'
import { summarizeResult } from '../../src/services/chat/chatContext.js'
import { loadSeries, loadTrend } from './trendData.js'

const MAX_ROWS = 120
const WHOLE_YEAR = { label: 'Whole year', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toPrecision(4)) : null)

const POINT_PROPS = {
  place_name: { type: 'string', description: 'The place as the user named it, e.g. "Seattle".' },
  lat: { type: 'number', description: 'Latitude of the place, decimal degrees. Must be inside Washington State.' },
  lng: { type: 'number', description: 'Longitude of the place, decimal degrees (negative = west).' },
}
const VARIABLE_PROP = { type: 'string', enum: POWER_VARIABLE_CODES, description: 'Variable code from the catalog.' }
const SEASON_PROP = {
  type: 'string',
  enum: ['all', ...SEASON_IDS],
  description: '"all" for the whole year, or one season: winter (Dec–Feb), spring (Mar–May), summer (Jun–Aug), fall (Sep–Nov).',
}

export const TOOL_DECLARATIONS = [
  {
    name: 'get_values',
    description:
      'Measured values of one variable at one place. step "month" gives each month with that month\'s long-term normal; step "year" gives one average per year (or per season). Also returns the lowest, highest and average value over the range. Use it for questions like "what was it in Feb 2024", "which year was hottest", "how did 2023 compare to normal".',
    parameters: {
      type: 'object',
      properties: {
        ...POINT_PROPS,
        variable: VARIABLE_PROP,
        step: { type: 'string', enum: ['month', 'year'], description: 'One row per month, or one average per year.' },
        from: { type: 'string', description: 'First month "YYYY-MM" (or year "YYYY" when step is year). Defaults to two years before the end of the record.' },
        to: { type: 'string', description: 'Last month "YYYY-MM" (or year "YYYY"). Defaults to the end of the record.' },
        season: { ...SEASON_PROP, description: 'Only with step "year": average just this season each year. Default "all".' },
      },
      required: ['lat', 'lng', 'variable', 'step'],
    },
  },
  {
    name: 'test_trend',
    description:
      "Trend Detective's full trend test for one variable at one place: verdict, Sen's slope per decade with its 95% range, Mann-Kendall p-value, a straight-line cross-check, and the four seasons tested separately.",
    parameters: {
      type: 'object',
      properties: { ...POINT_PROPS, variable: VARIABLE_PROP, season: SEASON_PROP },
      required: ['lat', 'lng', 'variable'],
    },
  },
  {
    name: 'scan_place',
    description:
      'Test every variable at one place and list which are changing, most significant first. Use it for "what is changing in X" or to find the strongest trend at a place. Slower than the other tools.',
    parameters: {
      type: 'object',
      properties: { ...POINT_PROPS, season: SEASON_PROP },
      required: ['lat', 'lng'],
    },
  },
]

function readPoint(args) {
  const point = normalizeLatLng(args?.lat, args?.lng)
  if (!point) return { error: 'lat and lng must be numbers.' }
  if (!isInRegion(point.lat, point.lng)) return { error: `${args?.place_name || 'That point'} is not in Washington State. ${OUTSIDE_REGION_MESSAGE}` }
  return point
}

function readVariable(code) {
  const meta = POWER_VARIABLES[String(code || '').toUpperCase()]
  return meta || null
}

function where(args, point, code) {
  const cell = gridCell(point.lat, point.lng, code)
  return {
    place: args.place_name || `${point.lat}, ${point.lng}`,
    lat: point.lat,
    lng: point.lng,
    gridCell: `about ${cell.kmNS} × ${cell.kmEW} km (${cell.source}); values are for that whole cell, not one station`,
  }
}

function stats(rows, key) {
  const valid = rows.filter((r) => r.value != null)
  if (!valid.length) return null
  const lo = valid.reduce((a, b) => (b.value < a.value ? b : a))
  const hi = valid.reduce((a, b) => (b.value > a.value ? b : a))
  return {
    lowest: { [key]: lo[key], value: lo.value },
    highest: { [key]: hi[key], value: hi.value },
    average: num(valid.reduce((s, r) => s + r.value, 0) / valid.length),
    count: valid.length,
  }
}

function recordSpan(months, values) {
  const first = values.findIndex((v) => v != null)
  let last = values.length - 1
  while (last >= 0 && values[last] == null) last--
  return first < 0 ? null : { first: months[first], last: months[last] }
}

async function getValues(args, origin) {
  const point = readPoint(args)
  if (point.error) return point
  const meta = readVariable(args.variable)
  if (!meta) return { error: `Unknown variable "${args.variable}".` }
  const step = args.step === 'year' ? 'year' : 'month'

  const { months, values } = await loadSeries(origin, meta.code, point.lat, point.lng)
  const span = recordSpan(months, values)
  if (!span) return { error: `No ${meta.label.toLowerCase()} record at this spot.` }
  const base = { ...where(args, point, meta.code), variable: meta.code, name: meta.label, unit: meta.unit, recordCovers: `${span.first} to ${span.last}` }

  if (step === 'month') {
    const to = /^\d{4}-\d{2}$/.test(args.to || '') ? args.to : span.last
    const defaultFrom = `${Number(to.slice(0, 4)) - 2}-${to.slice(5, 7)}`
    const from = /^\d{4}-\d{2}$/.test(args.from || '') ? args.from : defaultFrom
    // Long-term normal for each calendar month, over the whole record.
    const sums = Array.from({ length: 12 }, () => ({ s: 0, n: 0 }))
    months.forEach((ym, i) => {
      if (values[i] == null) return
      const m = Number(ym.slice(5, 7)) - 1
      sums[m].s += values[i]
      sums[m].n += 1
    })
    const normal = sums.map(({ s, n }) => (n ? s / n : null))
    const rows = []
    months.forEach((ym, i) => {
      if (ym < from || ym > to) return
      const v = values[i]
      const nm = normal[Number(ym.slice(5, 7)) - 1]
      rows.push({ month: ym, value: num(v), normal: num(nm), differenceFromNormal: v == null || nm == null ? null : num(v - nm) })
    })
    if (!rows.length) {
      return { ...base, error: `No months between ${from} and ${to}. The record covers ${span.first} to ${span.last}.` }
    }
    return {
      ...base,
      range: `${from} to ${to}`,
      normalMeans: `average of that calendar month over ${span.first.slice(0, 4)}–${span.last.slice(0, 4)}`,
      summary: stats(rows, 'month'),
      ...(rows.length > MAX_ROWS ? { note: `Only the first ${MAX_ROWS} months are listed; the summary covers all ${rows.length}.` } : {}),
      months: rows.slice(0, MAX_ROWS),
    }
  }

  const season = args.season && args.season !== 'all' ? seasonById(args.season) : null
  if (args.season && args.season !== 'all' && !season) return { error: `Unknown season "${args.season}".` }
  const { years, values: means } = seasonalMeans(months, values, season || WHOLE_YEAR)
  const lastYear = Number(span.last.slice(0, 4))
  const toYear = Number(String(args.to || '').slice(0, 4)) || lastYear
  const fromYear = Number(String(args.from || '').slice(0, 4)) || Number(span.first.slice(0, 4))
  const rows = years
    .map((y, i) => ({ year: y, value: num(means[i]) }))
    .filter((r) => r.year >= fromYear && r.year <= toYear)
  return {
    ...base,
    averaged: season ? `${season.label} (${season.span}) average each year` : 'whole-year average (years missing any month are null)',
    range: `${fromYear} to ${toYear}`,
    summary: stats(rows, 'year'),
    years: rows.slice(0, MAX_ROWS),
  }
}

async function testTrend(args, origin) {
  const point = readPoint(args)
  if (point.error) return point
  const meta = readVariable(args.variable)
  if (!meta) return { error: `Unknown variable "${args.variable}".` }
  const season = args.season && args.season !== 'all' ? args.season : 'all'
  const data = await loadTrend(origin, meta.code, point.lat, point.lng, season)
  return { ...where(args, point, meta.code), variable: meta.code, name: meta.label, unit: meta.unit, ...summarizeResult(data) }
}

async function scanPlace(args, origin) {
  const point = readPoint(args)
  if (point.error) return point
  const season = args.season && args.season !== 'all' ? args.season : 'all'
  const results = {}
  await Promise.all(
    POWER_VARIABLE_CODES.map(async (code) => {
      try {
        results[code] = { data: await loadTrend(origin, code, point.lat, point.lng) }
      } catch (err) {
        results[code] = { error: err?.message || 'Could not load data.' }
      }
    }),
  )
  const summary = summarizeScan(results, season)
  return {
    place: args.place_name || `${point.lat}, ${point.lng}`,
    lat: point.lat,
    lng: point.lng,
    partOfYear: season === 'all' ? 'whole year' : seasonById(season).label,
    significantCount: summary.significantCount,
    measures: summary.rows.map((row) => {
      const m = POWER_VARIABLES[row.code]
      if (row.status !== 'ready') return { code: row.code, name: m.label, status: row.status === 'short' ? 'too little data' : row.error }
      return {
        code: row.code,
        name: m.label,
        unit: m.unit,
        ratePerDecade: num(row.slopePerDecade),
        pValue: num(row.pValue),
        significant: row.significant,
        direction: row.direction,
        ...(row.opposite ? { oppositeSeasons: `${seasonById(row.opposite.rising).label} rising, ${seasonById(row.opposite.falling).label} falling` } : {}),
      }
    }),
  }
}

const TOOLS = { get_values: getValues, test_trend: testTrend, scan_place: scanPlace }

/**
 * Run one tool call. Never throws: failures come back as `{ error }`.
 * @param {string} origin — a URL on this deployment, for the static grid files
 */
export async function runTool(name, args, origin) {
  const fn = TOOLS[name]
  if (!fn) return { error: `Unknown tool "${name}".` }
  try {
    return await fn(args || {}, origin)
  } catch (err) {
    return { error: err?.message || 'The NASA record could not be loaded right now.' }
  }
}

/** A short line for the chat panel while a tool runs, e.g. "Reading average air temperature at Seattle…". */
export function describeCall(name, args) {
  const place = args?.place_name || 'this spot'
  const meta = readVariable(args?.variable)
  if (name === 'scan_place') return `Testing every measure at ${place}…`
  if (name === 'test_trend') return `Testing the ${meta ? meta.label.toLowerCase() : ''} trend at ${place}…`
  return `Reading ${meta ? meta.label.toLowerCase() : 'the record'} at ${place}…`
}

export const RECORD_NOTE = `NASA POWER records run ${POWER_START_YEAR}-01 to ${POWER_END_YEAR}-12; instrument records start later (see each variable) and also end ${POWER_END_YEAR}-12.`
