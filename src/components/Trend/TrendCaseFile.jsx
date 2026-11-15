/**
 * Trend Detective — "case file" panel.
 *
 * Note: index.css has an unlayered `* { margin: 0; padding: 0 }` reset that
 * outranks Tailwind's layered utilities, so spacing classes here carry `!`.
 *
 * Click anywhere in Washington State (the study region) → pick a variable → see the monthly record,
 * the same record with the seasons removed, the fitted trend, and a
 * plain-language verdict backed by a Mann-Kendall test.
 *
 * With one place chosen, the panel first tests every variable there and lists
 * what is changing (PlaceScan), so the user need not guess which to open.
 *
 * Every case also tests the four seasons separately. When one season rises
 * and another falls at the same place, the panel says so and charts the two
 * side by side; any single season can be opened as its own test.
 */
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GitCompareArrows, MapPin, Minus, Search, Sparkles, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useAtlasStore } from '../../store/atlasStore'
import { useTrend } from '../../hooks/useNasaPower'
import { cn } from '../../lib/utils'
import {
  POWER_CREDIT,
  POWER_END_YEAR,
  POWER_START_YEAR,
  POWER_THEMES,
  POWER_VARIABLES,
  POWER_VARIABLE_CODES,
  variablesForTheme,
} from '../../services/nasaPower/variables.js'
import { TREND_DEMOS, demoPlaceLabel } from '../../services/nasaPower/demos.js'
import { fmtP, SEASONS, seasonById } from '../../services/nasaPower/trendStats.js'
import { OUTSIDE_REGION_MESSAGE, REGION_BBOX, REGION_NAME } from '../../services/nasaPower/region.js'
import { gridCell } from '../../services/nasaPower/grid.js'
import { gridCredit, INSTRUMENT_GRIDS } from '../../services/nasaPower/instrumentGrids.js'
import { TREND_PLACE_COLORS } from '../../hooks/useTrendOverlays'
import { PlaceNewsTips, RegionNewsTips } from './NewsTips'
import PlaceScan from './PlaceScan'
import { THEME_ICONS, variableIcon } from './themeIcons'

const PLACE_COLORS = TREND_PLACE_COLORS
const TREND_COLOR = '#facc15'
const SEASON_COLORS = { winter: '#93c5fd', spring: '#4ade80', summer: '#f87171', fall: '#c4b5fd' }
const SEASON_OPTIONS = [{ id: 'all', label: 'Whole year' }, ...SEASONS]
const AXIS_TICK = { fill: 'rgba(226,232,240,0.6)', fontSize: 11 }
const GRID_STROKE = 'rgba(255,255,255,0.08)'
const TOOLTIP_STYLE = {
  background: 'rgba(3,7,18,0.95)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 8,
  fontSize: 12,
}
const BTN =
  'inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3! py-1.5! text-sm transition-colors'
const BTN_IDLE = 'border-line bg-surface text-muted hover:text-text'
const BTN_ACTIVE = 'border-accent-border bg-accent-dim text-accent'

function formatCoords(lat, lng) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`
}

function placeName(place) {
  return place.label || demoPlaceLabel(place.lat, place.lng) || formatCoords(place.lat, place.lng)
}

function signed(v, decimals) {
  if (v == null) return '—'
  const s = Math.abs(v).toFixed(decimals)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`
}

/** Drop the empty stretch before a record begins (haze starts in 2001, sunlight in 1984). */
function fromFirstValue(rows, valueOf) {
  const first = rows.findIndex((r) => valueOf(r) != null)
  return first > 0 ? rows.slice(first) : rows
}

/**
 * Y range that ignores the most extreme 1% of months, so a single freak
 * value cannot flatten the whole chart. Returns how many months fall outside.
 */
function robustDomain(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => v != null).sort((a, b) => a - b)
  if (vals.length < 20) return { domain: ['auto', 'auto'], clipped: 0 }
  const lo = vals[Math.floor(vals.length * 0.005)]
  const hi = vals[Math.ceil(vals.length * 0.995) - 1]
  const pad = (hi - lo) * 0.25 || 1
  const min = Math.max(vals[0], lo - pad)
  const max = Math.min(vals[vals.length - 1], hi + pad)
  const clipped = vals.filter((v) => v < min || v > max).length
  return { domain: [min, max], clipped }
}

function SeriesChart({ rows, color, unit, height, showTrend, yearTicks, yearly, digits = 2 }) {
  const { domain, clipped } = useMemo(() => robustDomain(rows, showTrend ? 'anomaly' : 'value'), [rows, showTrend])
  return (
    <>
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="month" ticks={yearTicks} tickFormatter={(m) => m.slice(0, 4)} tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} width={44} domain={domain} allowDataOverflow tickFormatter={(v) => Number(v.toPrecision(2))} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            formatter={(v, name) => [`${Number(v).toFixed(digits)} ${unit}`, name]}
          />
          {showTrend ? <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" /> : null}
          <Line
            type="linear"
            dataKey={showTrend ? 'anomaly' : 'value'}
            name={showTrend ? 'Difference from normal' : yearly ? 'Season average' : 'Monthly value'}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={showTrend ? 0.75 : 1}
            dot={yearly ? { r: 2, fill: color, strokeWidth: 0 } : false}
            isAnimationActive={false}
            connectNulls={false}
          />
          {showTrend ? (
            <Line
              type="linear"
              dataKey="trend"
              name="Trend line"
              stroke={TREND_COLOR}
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
    {clipped ? (
      <p className="text-sm leading-normal text-muted">
        {clipped} extreme {yearly ? (clipped === 1 ? 'year runs' : 'years run') : clipped === 1 ? 'month runs' : 'months run'} off this chart. The trend test still counts {clipped === 1 ? 'it' : 'them'}, and is built to not be thrown by outliers.
      </p>
    ) : null}
    </>
  )
}

/** Two seasons at one place: yearly averages (thin, dotted) and their trend lines (dashed). */
function SeasonPairChart({ falling, rising, unit, digits }) {
  const rows = useMemo(
    () =>
      fromFirstValue(
        falling.years.map((year, i) => ({
          year,
          falling: falling.values[i],
          fallingTrend: falling.trendLine[i],
          rising: rising.values[i],
          risingTrend: rising.trendLine[i],
        })),
        (r) => r.falling ?? r.rising,
      ),
    [falling, rising],
  )
  const ticks = rows.filter((r) => r.year % 5 === 0).map((r) => r.year)
  const pair = [
    { key: 'falling', season: falling },
    { key: 'rising', season: rising },
  ]
  return (
    <div style={{ height: 170 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="year" ticks={ticks} tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} width={44} domain={['auto', 'auto']} tickFormatter={(v) => Number(v.toPrecision(2))} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
            formatter={(v, name) => [`${Number(v).toFixed(digits)} ${unit}`, name]}
          />
          {pair.map(({ key, season }) => (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              name={`${season.label} average`}
              stroke={SEASON_COLORS[season.id]}
              strokeWidth={1}
              strokeOpacity={0.8}
              dot={{ r: 2, fill: SEASON_COLORS[season.id], strokeWidth: 0 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
          {pair.map(({ key, season }) => (
            <Line
              key={`${key}Trend`}
              type="linear"
              dataKey={`${key}Trend`}
              name={`${season.label} trend`}
              stroke={SEASON_COLORS[season.id]}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1)

/**
 * The four seasons tested one by one. Each tile opens that season's own
 * test; opposite significant trends get a callout and a side-by-side chart.
 */
function SeasonScan({ data, meta, unit, season, compact, showNotes, onPickSeason }) {
  const seasons = data.seasons
  if (!seasons?.length) return null
  const d = meta.decimals
  const opp = data.oppositeSeasons
  const falling = opp ? seasons.find((s) => s.id === opp.falling) : null
  const rising = opp ? seasons.find((s) => s.id === opp.rising) : null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-normal text-muted">
        The same place, one season at a time (change per decade{unit ? `, ${unit}` : ''}). Pick a season to open its test.
      </p>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Season trends">
        {seasons.map((s) => {
          const Icon = s.direction === 'rising' ? TrendingUp : s.direction === 'falling' ? TrendingDown : Minus
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={season === s.id}
              className={cn(BTN, 'h-auto flex-col gap-0 px-1! py-2!', season === s.id ? BTN_ACTIVE : BTN_IDLE)}
              onClick={() => onPickSeason(season === s.id ? 'all' : s.id)}
            >
              <span className="flex items-center gap-1 text-sm text-text">
                <span className="h-2 w-2 rounded-full" style={{ background: SEASON_COLORS[s.id] }} aria-hidden="true" />
                {s.label}
              </span>
              <span className={cn('flex items-center gap-1 font-data text-sm font-semibold', s.significant ? 'text-text' : 'text-muted')}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {signed(s.slopePerDecade, d)}
              </span>
              <span className={cn('text-sm', s.significant ? 'text-emerald-300' : 'text-muted')}>
                {s.slopePerDecade == null ? 'too short' : s.significant ? 'significant' : 'not yet'}
              </span>
            </button>
          )
        })}
      </div>

      {falling && rising ? (
        <div className="flex flex-col gap-2 rounded-lg border border-accent-border bg-accent-dim px-3! py-3!">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Opposite trends in one place</p>
          <p className="text-base leading-normal text-text">
            <span style={{ color: SEASON_COLORS[falling.id] }}>{falling.label}</span>: {lowerFirst(meta.falling)}.{' '}
            <span style={{ color: SEASON_COLORS[rising.id] }}>{rising.label}</span>: {lowerFirst(meta.rising)}. A whole-year test blends the two together.
          </p>
          {!compact ? (
            <>
              <SeasonPairChart falling={falling} rising={rising} unit={unit} digits={Math.max(2, d)} />
              <p className="text-sm leading-normal text-muted">
                Each dot is one season's average; dashed lines are the trends.
                {opp.crossYear
                  ? ` The trend lines cross around ${opp.crossYear}: ${falling.label.toLowerCase()} used to have the higher values, and now ${rising.label.toLowerCase()} does.`
                  : ''}
              </p>
            </>
          ) : null}
          {showNotes && meta.seasonNote ? <p className="text-sm leading-normal text-muted">{meta.seasonNote}</p> : null}
        </div>
      ) : null}
      {showNotes ? (
        <p className="text-sm leading-normal text-muted">
          Four seasons means four tests, so one of them can look significant by luck. Trust a season more when its neighbors agree or the result is far below p = 0.05.
        </p>
      ) : null}
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3! py-2!">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-data text-base font-semibold leading-normal text-text">{value}</p>
      {hint ? <p className="text-sm leading-normal text-muted">{hint}</p> : null}
    </div>
  )
}

function CaseSection({ place, variable, season, color, compact, showNotes = true, onRemove, onPickSeason }) {
  const meta = POWER_VARIABLES[variable]
  const { data, loading, error } = useTrend({ lat: place.lat, lng: place.lng, variable, season })
  // One point per year when a single season is being tested.
  const yearly = data?.step === 'year'
  const seasonName = yearly ? data.seasonLabel.toLowerCase() : null

  const rows = useMemo(() => {
    if (!data?.months) return []
    const all = data.months.map((month, i) => ({
      month,
      value: data.values[i],
      anomaly: data.anomalies[i],
      trend: data.trendLine[i],
    }))
    return fromFirstValue(all, (r) => r.value)
  }, [data])

  const yearTicks = useMemo(
    () =>
      rows
        .filter((r) => (yearly ? Number(r.month) % 5 === 0 : r.month.endsWith('-01') && Number(r.month.slice(0, 4)) % 10 === 0))
        .map((r) => r.month),
    [rows, yearly],
  )

  const unit = meta.unit.startsWith('(') ? '' : meta.unit
  const d = meta.decimals
  const digits = Math.max(2, d)
  const cell = gridCell(place.lat, place.lng, variable)
  const recordYears = POWER_END_YEAR - (meta.startYear || POWER_START_YEAR) + 1

  return (
    <section className="flex flex-col gap-3" aria-label={`Trend at ${placeName(place)}`}>
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-normal text-text">{placeName(place)}</p>
          {placeName(place) !== formatCoords(place.lat, place.lng) ? (
            <p className="font-data text-sm text-muted">{formatCoords(place.lat, place.lng)}</p>
          ) : null}
          <p className="text-sm leading-normal text-muted">
            Data covers the{' '}
            <span className="font-semibold" style={{ color }}>
              outlined box
            </span>{' '}
            on the map: about {cell.kmNS} × {cell.kmEW} km ({cell.source} grid cell)
          </p>
        </div>
        {onRemove ? (
          <button type="button" className={cn(BTN, BTN_IDLE)} onClick={onRemove} aria-label={`Remove ${placeName(place)}`}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="rounded-lg border border-line bg-surface px-3! py-6! text-center text-sm text-muted" role="status">
          Pulling {recordYears} years of NASA records…
        </p>
      ) : error ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3! py-3! text-sm leading-normal text-red-200" role="alert">
          {error} Try another spot in Washington, or one of the saved cases.
        </p>
      ) : data ? (
        <>
          <div
            className={cn(
              'rounded-lg border px-3! py-3!',
              data.significant ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-line-strong bg-surface-2',
            )}
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Verdict{yearly ? ` · ${seasonName} only (${data.seasonSpan})` : ' · whole year'}
              {data.significant ? ' · significant' : data.slopePerDecade == null ? '' : ' · not significant yet'}
            </p>
            <p className="mt-1! text-base leading-normal text-text">{data.verdict}</p>
          </div>

          {data.slopePerDecade != null ? (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Rate per decade" value={`${signed(data.slopePerDecade, d)} ${unit}`} hint="Sen's slope" />
              <Stat
                label="95% range"
                value={`${signed(data.ci95[0], d)} to ${signed(data.ci95[1], d)}`}
                hint="Where the true rate likely sits"
              />
              <Stat label="Chance it's just noise" value={fmtP(data.pValue)} hint="Mann-Kendall test" />
              <Stat
                label="Second check"
                value={`${signed(data.ols.slopePerDecade, d)} ${unit}`}
                hint={`Straight-line fit, ${fmtP(data.ols.pValue)}`}
              />
            </div>
          ) : null}

          <SeasonScan data={data} meta={meta} unit={unit} season={season} compact={compact || yearly} showNotes={showNotes} onPickSeason={onPickSeason} />

          <div>
            <p className="mb-1! text-sm text-muted">
              {yearly
                ? `Each ${seasonName}'s average (${data.seasonSpan}), as the difference from a normal ${seasonName} (${unit || 'index'}), and the `
                : `With the seasons removed (${unit || 'index'}, difference from that month's normal) and the `}
              <span style={{ color: TREND_COLOR }}>trend line</span>
            </p>
            <SeriesChart rows={rows} color={color} unit={unit} height={compact ? 150 : 180} showTrend yearTicks={yearTicks} yearly={yearly} digits={digits} />
          </div>
          {!compact ? (
            <div>
              <p className="mb-1! text-sm text-muted">
                What was measured each {yearly ? seasonName : 'month'} ({unit || 'index'})
              </p>
              <SeriesChart rows={rows} color={color} unit={unit} height={140} yearTicks={yearTicks} yearly={yearly} digits={digits} />
            </div>
          ) : null}
          <p className="text-sm leading-normal text-muted">
            {data.monthsUsed} {yearly ? `${seasonName}s` : 'months'} tested, {data.firstMonth?.slice(0, 4)}–{data.lastMonth?.slice(0, 4)}
            {data.cached ? ' · saved copy' : ''}
          </p>
        </>
      ) : null}
    </section>
  )
}

/** Frame the whole study region. */
function flyToRegion(flyToLocation) {
  const b = REGION_BBOX
  flyToLocation({ lat: (b.north + b.south) / 2, lng: (b.east + b.west) / 2, bbox: b })
}

export function TrendLauncher() {
  const open = useAtlasStore((s) => Boolean(s.trendCase))
  const openTrendCase = useAtlasStore((s) => s.openTrendCase)
  const flyToLocation = useAtlasStore((s) => s.flyToLocation)
  if (open) return null
  return (
    <button
      type="button"
      onClick={() => {
        openTrendCase()
        flyToRegion(flyToLocation)
      }}
      data-tour="trend"
      className={cn(BTN, 'border-accent-border bg-[rgba(3,7,18,0.94)] px-5! py-2.5! text-base text-accent shadow-xl')}
    >
      <Search className="h-5 w-5" />
      Trend Detective
    </button>
  )
}

export default function TrendCaseFile() {
  const trendCase = useAtlasStore((s) => s.trendCase)
  const closeTrendCase = useAtlasStore((s) => s.closeTrendCase)
  const updateTrendCase = useAtlasStore((s) => s.updateTrendCase)
  const openTrendCase = useAtlasStore((s) => s.openTrendCase)
  const flyToLocation = useAtlasStore((s) => s.flyToLocation)
  const askOpen = useAtlasStore((s) => s.askAtlasOpen)
  const openAskAtlas = useAtlasStore((s) => s.openAskAtlas)

  if (!trendCase) return null
  const { places, variable, theme, pickingCompare, outsideClick } = trendCase
  const season = seasonById(trendCase.season)?.id || 'all'
  const meta = POWER_VARIABLES[variable] || POWER_VARIABLES.T2M
  const options = theme ? variablesForTheme(theme) : POWER_VARIABLE_CODES.map((c) => POWER_VARIABLES[c])
  const comparing = places.length > 1

  const chooseTheme = (id) => {
    const next = id === theme ? null : id
    const first = next ? variablesForTheme(next)[0].code : variable
    updateTrendCase({ theme: next, variable: first })
  }

  const openDemo = (demo) => {
    openTrendCase({
      places: demo.places,
      variable: demo.variable,
      season: demo.season || 'all',
      theme: POWER_VARIABLES[demo.variable].theme,
    })
    if (demo.places.length > 1) {
      flyToRegion(flyToLocation)
      return
    }
    const p = demo.places[0]
    // Frame about three grid cells either side: small satellite cells get a closer view.
    const half = Math.min(1.5, Math.max(0.4, gridCell(p.lat, p.lng, demo.variable).dLat * 3))
    flyToLocation({
      lat: p.lat,
      lng: p.lng,
      bbox: { north: p.lat + half, south: p.lat - half, east: p.lng + half, west: p.lng - half },
    })
  }

  return (
    <aside
      className="fixed top-14 right-3 z-40 flex max-h-[calc(100vh-7rem)] w-[min(27.5rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-line-strong bg-[rgba(3,7,18,0.94)] shadow-2xl backdrop-blur-md pointer-events-auto"
      aria-label="Trend Detective case file"
    >
      <header className="flex items-center gap-2 border-b border-line px-4! py-2!">
        <Search className="h-5 w-5 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-normal text-text">Trend Detective</h2>
          <p className="text-sm text-muted">{REGION_NAME}</p>
        </div>
        <button
          type="button"
          aria-pressed={askOpen}
          className={cn(BTN, askOpen ? BTN_ACTIVE : BTN_IDLE)}
          onClick={openAskAtlas}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ask
        </button>
        <button type="button" className={cn(BTN, BTN_IDLE)} onClick={closeTrendCase} aria-label="Close case file">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto px-4! py-4!">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">1. What are you curious about?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Topic">
            {POWER_THEMES.map((t) => {
              const Icon = THEME_ICONS[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={theme === t.id}
                  className={cn(BTN, theme === t.id ? BTN_ACTIVE : BTN_IDLE)}
                  onClick={() => chooseTheme(t.id)}
                >
                  {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">
            2. {theme ? 'Suggested things to measure' : 'What to measure'}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Variable">
            {options.map((v) => {
              const Icon = variableIcon(v.code)
              return (
                <button
                  key={v.code}
                  type="button"
                  aria-pressed={variable === v.code}
                  className={cn(BTN, variable === v.code ? BTN_ACTIVE : BTN_IDLE)}
                  onClick={() => updateTrendCase({ variable: v.code })}
                >
                  {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                  {v.label}
                </button>
              )
            })}
          </div>
          <p className="text-sm leading-normal text-muted">
            <span className="text-text">{meta.label}:</span> {meta.definition}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">3. Which part of the year?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Part of the year">
            {SEASON_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-pressed={season === o.id}
                className={cn(BTN, season === o.id ? BTN_ACTIVE : BTN_IDLE)}
                onClick={() => updateTrendCase({ season: o.id })}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-sm leading-normal text-muted">
            {season === 'all'
              ? 'Every month is tested, with the normal seasonal ups and downs removed first.'
              : `Only ${seasonById(season).span} is tested: one average per year. A place can trend one way in one season and the opposite way in another.`}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">4. Where in {REGION_NAME}?</p>
          {outsideClick ? (
            <p className="rounded-lg border border-amber-300/40 bg-amber-400/10 px-3! py-2! text-sm leading-normal text-amber-100" role="status">
              {formatCoords(outsideClick.lat, outsideClick.lng)} is outside the study region. {OUTSIDE_REGION_MESSAGE}
            </p>
          ) : null}
          {places.length === 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-dashed border-accent-border bg-accent-dim px-3! py-3! text-sm leading-normal text-text">
              <MapPin className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
              Click any spot in Washington to open its case, or start with a saved case below.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={pickingCompare}
                className={cn(BTN, pickingCompare ? BTN_ACTIVE : BTN_IDLE)}
                onClick={() => updateTrendCase({ pickingCompare: !pickingCompare })}
              >
                <GitCompareArrows className="h-4 w-4" />
                {pickingCompare ? 'Now click a second place in Washington…' : comparing ? 'Change second place' : 'Compare with another place'}
              </button>
              {!pickingCompare ? <p className="text-sm text-muted">or click elsewhere in Washington for a new case</p> : null}
            </div>
          )}
        </div>

        {places.length === 1 ? (
          <PlaceScan
            place={places[0]}
            variable={meta.code}
            season={season}
            onPickVariable={(code) => updateTrendCase({ variable: code, theme: null })}
          />
        ) : null}

        {places.length === 0 ? (
          <RegionNewsTips
            onOpen={(tip) => {
              openTrendCase({
                places: [{ lat: tip.lat, lng: tip.lng, label: tip.label }],
                variable: tip.variable,
                season: 'all',
                theme: POWER_VARIABLES[tip.variable].theme,
              })
              flyToLocation({ lat: tip.lat, lng: tip.lng })
            }}
          />
        ) : (
          <PlaceNewsTips
            variable={meta.code}
            onPickVariable={(code) => updateTrendCase({ variable: code, theme: null })}
          />
        )}

        {places.map((place, i) => (
          <CaseSection
            key={`${place.lat},${place.lng},${i}`}
            place={place}
            variable={meta.code}
            season={season}
            color={PLACE_COLORS[i]}
            compact={comparing}
            showNotes={i === places.length - 1}
            onPickSeason={(id) => updateTrendCase({ season: id })}
            onRemove={
              comparing
                ? () => updateTrendCase({ places: places.filter((_, j) => j !== i), pickingCompare: false })
                : null
            }
          />
        ))}

        <div className="flex flex-col gap-2 border-t border-line pt-4!">
          <p className="text-sm font-semibold text-text">Saved cases</p>
          {TREND_DEMOS.map((demo) => (
            <button
              key={demo.id}
              type="button"
              className={cn(BTN, BTN_IDLE, 'h-auto w-full flex-col items-start gap-0 whitespace-normal py-2! text-left')}
              onClick={() => openDemo(demo)}
            >
              <span className="text-base text-text">{demo.title}</span>
              <span className="text-sm text-muted">{demo.blurb}</span>
            </button>
          ))}
        </div>

        {INSTRUMENT_GRIDS[meta.code] ? (
          <p className="text-sm leading-normal text-muted">
            {gridCredit(meta.code)} {meta.label} comes from {INSTRUMENT_GRIDS[meta.code].instrument}.{' '}
            {INSTRUMENT_GRIDS[meta.code].via === 'gibs'
              ? `Values are read back from NASA's color-coded maps, so each reading is rounded to about ${INSTRUMENT_GRIDS[meta.code].step}, then averaged over the grid cell outlined on the map.`
              : 'Values are the product’s own numbers for the grid cell outlined on the map.'}
          </p>
        ) : (
          <p className="text-sm leading-normal text-muted">
            {POWER_CREDIT} Values are satellite- and model-based estimates for the whole grid cell outlined on the map (about 55 × 47 km; sunlight and haze use much larger cells), not a single weather station.
          </p>
        )}
      </div>
    </aside>
  )
}
