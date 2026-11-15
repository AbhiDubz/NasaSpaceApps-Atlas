/**
 * Trend Detective — "case file" panel.
 *
 * Note: index.css has an unlayered `* { margin: 0; padding: 0 }` reset that
 * outranks Tailwind's layered utilities, so spacing classes here carry `!`.
 *
 * Click anywhere in Washington State (the study region) → pick a variable → see the monthly record,
 * the same record with the seasons removed, the fitted trend, and a
 * plain-language verdict backed by a Mann-Kendall test.
 */
import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GitCompareArrows, MapPin, Search, X } from 'lucide-react'
import { useAtlasStore } from '../../store/atlasStore'
import { useTrend } from '../../hooks/useNasaPower'
import { cn } from '../../lib/utils'
import {
  POWER_CREDIT,
  POWER_THEMES,
  POWER_VARIABLES,
  POWER_VARIABLE_CODES,
  variablesForTheme,
} from '../../services/nasaPower/variables.js'
import { TREND_DEMOS, demoPlaceLabel } from '../../services/nasaPower/demos.js'
import { fmtP } from '../../services/nasaPower/trendStats.js'
import { OUTSIDE_REGION_MESSAGE, REGION_BBOX, REGION_NAME } from '../../services/nasaPower/region.js'
import { gridCell } from '../../services/nasaPower/grid.js'
import { TREND_PLACE_COLORS } from '../../hooks/useTrendOverlays'
import { PlaceNewsTips, RegionNewsTips } from './NewsTips'

const PLACE_COLORS = TREND_PLACE_COLORS
const TREND_COLOR = '#facc15'
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

function SeriesChart({ rows, color, unit, height, showTrend, yearTicks }) {
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
            formatter={(v, name) => [`${Number(v).toFixed(2)} ${unit}`, name]}
          />
          {showTrend ? <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" /> : null}
          <Line
            type="linear"
            dataKey={showTrend ? 'anomaly' : 'value'}
            name={showTrend ? 'Difference from normal' : 'Monthly value'}
            stroke={color}
            strokeWidth={1}
            strokeOpacity={showTrend ? 0.75 : 1}
            dot={false}
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
        {clipped} extreme {clipped === 1 ? 'month runs' : 'months run'} off this chart. The trend test still counts {clipped === 1 ? 'it' : 'them'}, and is built to not be thrown by outliers.
      </p>
    ) : null}
    </>
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

function CaseSection({ place, variable, color, compact, onRemove }) {
  const meta = POWER_VARIABLES[variable]
  const { data, loading, error } = useTrend({ lat: place.lat, lng: place.lng, variable })

  const rows = useMemo(() => {
    if (!data?.months) return []
    return data.months.map((month, i) => ({
      month,
      value: data.values[i],
      anomaly: data.anomalies[i],
      trend: data.trendLine[i],
    }))
  }, [data])

  const yearTicks = useMemo(
    () => rows.filter((r) => r.month.endsWith('-01') && Number(r.month.slice(0, 4)) % 10 === 0).map((r) => r.month),
    [rows],
  )

  const unit = meta.unit.startsWith('(') ? '' : meta.unit
  const d = meta.decimals
  const cell = gridCell(place.lat, place.lng, variable)

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
          Pulling 45 years of NASA records…
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
              Verdict{data.significant ? ' · significant' : data.slopePerDecade == null ? '' : ' · not significant yet'}
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

          <div>
            <p className="mb-1! text-sm text-muted">
              With the seasons removed ({unit || 'index'}, difference from that month's normal) and the{' '}
              <span style={{ color: TREND_COLOR }}>trend line</span>
            </p>
            <SeriesChart rows={rows} color={color} unit={unit} height={compact ? 150 : 180} showTrend yearTicks={yearTicks} />
          </div>
          {!compact ? (
            <div>
              <p className="mb-1! text-sm text-muted">What was measured each month ({unit || 'index'})</p>
              <SeriesChart rows={rows} color={color} unit={unit} height={140} yearTicks={yearTicks} />
            </div>
          ) : null}
          <p className="text-sm leading-normal text-muted">
            {data.monthsUsed} months tested, {data.firstMonth?.slice(0, 4)}–{data.lastMonth?.slice(0, 4)}
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
      className={cn(BTN, 'fixed right-4 bottom-14 z-40 border-accent-border bg-[rgba(3,7,18,0.94)] px-5! py-2.5! text-base text-accent shadow-xl')}
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

  if (!trendCase) return null
  const { places, variable, theme, pickingCompare, outsideClick } = trendCase
  const meta = POWER_VARIABLES[variable] || POWER_VARIABLES.T2M
  const options = theme ? variablesForTheme(theme) : POWER_VARIABLE_CODES.map((c) => POWER_VARIABLES[c])
  const comparing = places.length > 1

  const chooseTheme = (id) => {
    const next = id === theme ? null : id
    const first = next ? variablesForTheme(next)[0].code : variable
    updateTrendCase({ theme: next, variable: first })
  }

  const openDemo = (demo) => {
    openTrendCase({ places: demo.places, variable: demo.variable, theme: POWER_VARIABLES[demo.variable].theme })
    if (demo.places.length > 1) {
      flyToRegion(flyToLocation)
      return
    }
    const p = demo.places[0]
    const half = 1.5
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
        <button type="button" className={cn(BTN, BTN_IDLE)} onClick={closeTrendCase} aria-label="Close case file">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto px-4! py-4!">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">1. What are you curious about?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Topic">
            {POWER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={theme === t.id}
                className={cn(BTN, theme === t.id ? BTN_ACTIVE : BTN_IDLE)}
                onClick={() => chooseTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">
            2. {theme ? 'Suggested things to measure' : 'What to measure'}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Variable">
            {options.map((v) => (
              <button
                key={v.code}
                type="button"
                aria-pressed={variable === v.code}
                className={cn(BTN, variable === v.code ? BTN_ACTIVE : BTN_IDLE)}
                onClick={() => updateTrendCase({ variable: v.code })}
              >
                {v.label}
              </button>
            ))}
          </div>
          <p className="text-sm leading-normal text-muted">
            <span className="text-text">{meta.label}:</span> {meta.definition}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-text">3. Where in {REGION_NAME}?</p>
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

        {places.length === 0 ? (
          <RegionNewsTips
            onOpen={(tip) => {
              openTrendCase({
                places: [{ lat: tip.lat, lng: tip.lng, label: tip.label }],
                variable: tip.variable,
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
            color={PLACE_COLORS[i]}
            compact={comparing}
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

        <p className="text-sm leading-normal text-muted">
          {POWER_CREDIT} Values are model-based estimates for the whole grid cell outlined on the map (about 55 × 47 km; sunlight uses larger 1° cells), not a single weather station.
        </p>
      </div>
    </aside>
  )
}
