/**
 * Trend Detective — "What is changing here?"
 *
 * Tests every variable at the chosen place and lists them with the ones
 * that are changing first, so the user does not have to guess which
 * variable to look at. Picking a row opens that variable's full case.
 * Once everything has loaded, the variables with no clear trend fold away
 * behind a button so the list stays short.
 *
 * Note: index.css has an unlayered `* { margin: 0; padding: 0 }` reset that
 * outranks Tailwind's layered utilities, so spacing classes here carry `!`.
 */
import { useMemo, useState } from 'react'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTrendScan } from '../../hooks/useNasaPower'
import { POWER_VARIABLES } from '../../services/nasaPower/variables.js'
import { summarizeScan } from '../../services/nasaPower/scan.js'
import { fmtP, seasonById } from '../../services/nasaPower/trendStats.js'
import { cn } from '../../lib/utils'
import { variableIcon } from './themeIcons'

const ROW =
  'flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-md border px-3! py-1.5! text-left text-sm transition-colors'
const ROW_IDLE = 'border-line bg-surface hover:border-line-strong'
const ROW_ACTIVE = 'border-accent-border bg-accent-dim'

function signed(v, decimals) {
  const s = Math.abs(v).toFixed(decimals)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`
}

function headline({ done, total, complete, significantCount, hiddenCount }, seasonName) {
  if (!complete) return `Testing all ${total} measures at this spot… ${done} of ${total} done.`
  const when = seasonName ? ` in ${seasonName}` : ''
  const lead =
    significantCount === 0
      ? `None of the ${total} measures shows a significant trend here${when}.`
      : `${significantCount} of ${total} measures ${significantCount === 1 ? 'shows' : 'show'} a significant trend here${when}.`
  if (!hiddenCount) return lead
  return `${lead} ${hiddenCount} more ${hiddenCount === 1 ? 'looks' : 'look'} flat over the whole year but ${hiddenCount === 1 ? 'hides' : 'hide'} opposite trends in different seasons.`
}

function Row({ row, active, onPick }) {
  const meta = POWER_VARIABLES[row.code]
  const Icon = variableIcon(row.code)
  const unit = meta.unit.startsWith('(') ? '' : ` ${meta.unit}`
  const ready = row.status === 'ready'
  const Arrow = row.direction === 'rising' ? TrendingUp : row.direction === 'falling' ? TrendingDown : Minus
  const word = !ready ? null : row.significant ? (row.direction === 'rising' ? meta.rising : meta.falling) : 'No clear trend'
  const falling = row.opposite ? seasonById(row.opposite.falling) : null
  const rising = row.opposite ? seasonById(row.opposite.rising) : null

  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        className={cn(ROW, active ? ROW_ACTIVE : ROW_IDLE)}
        onClick={() => onPick(row.code)}
      >
        {Icon ? <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-muted')} aria-hidden="true" /> : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-text">{meta.label}</span>
          {ready ? (
            <span className={row.significant ? 'text-emerald-300' : 'text-muted'}>{word}</span>
          ) : (
            <span className="text-muted">
              {row.status === 'loading' ? 'Testing…' : row.status === 'short' ? 'Not enough data to test' : 'Could not load'}
            </span>
          )}
          {falling && rising ? (
            <span className="text-amber-200">
              Seasons disagree: {falling.label.toLowerCase()} falling, {rising.label.toLowerCase()} rising
            </span>
          ) : null}
        </span>
        {ready ? (
          <span className="flex shrink-0 flex-col items-end">
            <span className={cn('flex items-center gap-1 font-data font-semibold', row.significant ? 'text-text' : 'text-muted')}>
              <Arrow className="h-4 w-4" aria-hidden="true" />
              {signed(row.slopePerDecade, meta.decimals)}
              {unit}
            </span>
            <span className="text-muted">{fmtP(row.pValue)}</span>
          </span>
        ) : null}
      </button>
    </li>
  )
}

/**
 * @param {{ place: { lat: number, lng: number }, variable: string, season: string, onPickVariable: (code: string) => void }} props
 */
export default function PlaceScan({ place, variable, season, onPickVariable }) {
  const results = useTrendScan({ lat: place.lat, lng: place.lng })
  const scan = useMemo(() => summarizeScan(results, season), [results, season])
  const chosen = seasonById(season)
  const [showAll, setShowAll] = useState(false)

  // Changing (or hiding a seasonal flip) stays in view, as does whatever is open below.
  const notable = (row) => row.significant || Boolean(row.opposite) || row.code === variable
  const quiet = scan.complete ? scan.rows.filter((row) => !notable(row)) : []
  const fold = quiet.length > 1 && quiet.length < scan.rows.length && !showAll
  const rows = fold ? scan.rows.filter(notable) : scan.rows

  return (
    <section className="flex flex-col gap-2" aria-label="What is changing here">
      <p className="text-sm font-semibold text-text">What is changing here?</p>
      <p className="text-sm leading-normal text-muted" role="status">
        {headline(scan, chosen?.label.toLowerCase())}
      </p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <Row key={row.code} row={row} active={variable === row.code} onPick={onPickVariable} />
        ))}
      </ul>
      {quiet.length > 1 && quiet.length < scan.rows.length ? (
        <button
          type="button"
          aria-expanded={!fold}
          className={cn(ROW, ROW_IDLE, 'justify-center text-muted hover:text-text')}
          onClick={() => setShowAll((v) => !v)}
        >
          {fold ? `Show the ${quiet.length} with no clear trend` : 'Hide the ones with no clear trend'}
        </button>
      ) : null}
      <p className="text-sm leading-normal text-muted">
        Change per decade{chosen ? ` (${chosen.span} only)` : ''}, most certain first. Pick one to open its full case below.
      </p>
    </section>
  )
}
