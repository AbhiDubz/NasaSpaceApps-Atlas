import { memo, useDeferredValue } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { formatDeepTime } from '../core/timeScale'
import { resolveEraContext } from '../core/eraCatalog'
import { DEEP_TIME_EVENTS, eventYbp } from '../core/eventsCatalog'
import { formatHolocenePlayhead } from '../core/calendarYear'
import { getTourById } from '../core/narrativeTours'
import DiversitySpark from './DiversitySpark'

function Row({ label, value, accent = false }) {
  if (!value) return null
  return (
    <div className="eh-context__row">
      <span className="eh-context__label">{label}</span>
      <span className={`eh-context__value${accent ? ' eh-context__value--accent' : ''}`}>
        {value}
      </span>
    </div>
  )
}

const ContextRows = memo(function ContextRows({ ctx, eventLabel }) {
  const period = ctx.period?.name || ctx.era?.name || ctx.eon?.name || 'Deep time'
  const epoch = ctx.epoch?.name || ctx.age?.name || null

  return (
    <>
      <Row label="Period" value={period} />
      <Row label="Epoch" value={epoch} />
      <Row label="Life" value={eventLabel} accent />
    </>
  )
})

/**
 * Passive left context card — read-only rows for the current moment.
 * Fixed composition, never scrolls, hosts no controls. Heavy updates ride
 * useDeferredValue so scrubbing never waits on this card.
 */
export default function ContextCard() {
  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const scrubbing = useEarthHistoryStore((s) => s.scrubbing)
  const erasBlurbs = useEarthHistoryStore((s) => s.erasBlurbs)
  const showLife = useEarthHistoryStore((s) => s.layers.life)
  const showEvents = useEarthHistoryStore((s) => s.layers.events)
  const selectedEventId = useEarthHistoryStore((s) => s.selectedEventId)
  const pinnedEventId = useEarthHistoryStore((s) => s.pinnedEventId)
  const clearPinnedEvent = useEarthHistoryStore((s) => s.clearPinnedEvent)
  const texturePending = useEarthHistoryStore((s) => s.texturePending)
  const activeTourId = useEarthHistoryStore((s) => s.activeTourId)
  const tourNote = useEarthHistoryStore((s) => s.tourNote)

  const deferredYbp = useDeferredValue(playheadYbp)
  const ctx = resolveEraContext(deferredYbp, { blurbs: erasBlurbs || undefined })
  const holoceneLabel = formatHolocenePlayhead(deferredYbp)

  const selectedEvent =
    showEvents && selectedEventId
      ? DEEP_TIME_EVENTS.find((e) => e.id === selectedEventId) || null
      : null
  const eventLabel = selectedEvent
    ? `${selectedEvent.name} · ${formatDeepTime(eventYbp(selectedEvent))}`
    : null

  const tour = getTourById(activeTourId)
  const blurb =
    pinnedEventId && selectedEvent ? selectedEvent.summary : ctx.blurb

  return (
    <aside
      className="eh-context"
      aria-live="polite"
      data-scrubbing={scrubbing ? 'true' : undefined}
    >
      <div className="eh-context__body" key={ctx.primary?.id || ctx.label}>
        <ContextRows ctx={ctx} eventLabel={eventLabel} />
        {holoceneLabel && <Row label="Year" value={holoceneLabel} />}

        {blurb && (
          <p className="eh-context__blurb">
            {blurb}
            {pinnedEventId && selectedEvent && (
              <button
                type="button"
                className="eh-context__unpin"
                onClick={clearPinnedEvent}
              >
                Unpin
              </button>
            )}
          </p>
        )}

        {tour && tourNote && (
          <div className="eh-context__tour">
            <p className="eh-context__tour-kicker">Tour · {tour.name}</p>
            <p className="eh-context__tour-note">{tourNote}</p>
          </div>
        )}

        {showLife && (
          <div className="eh-context__row eh-context__row--spark">
            <span className="eh-context__label">Diversity</span>
            <DiversitySpark />
          </div>
        )}

        {texturePending && <p className="eh-context__pending">Loading map texture…</p>}
      </div>
    </aside>
  )
}
