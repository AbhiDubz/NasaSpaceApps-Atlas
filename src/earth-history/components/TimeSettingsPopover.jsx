import { useEffect, useMemo, useRef, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { formatDeepTime, maToYbp, parseDeepTimeInput } from '../core/timeScale'
import { DRILL_RANKS } from '../core/eraCatalog'
import { DEEP_TIME_MILESTONES, milestonesSorted } from '../core/eventsCatalog'
import TourControls from './TourControls'
import SavedViews from './SavedViews'

const RANGE_PRESETS = [
  { id: 'all', label: 'All Earth', start: '4540 Ma', end: 'Present' },
  { id: 'phanerozoic', label: 'Phanerozoic', start: '541 Ma', end: 'Present' },
  { id: 'mesozoic', label: 'Mesozoic', start: '252 Ma', end: '66 Ma' },
  { id: 'cenozoic', label: 'Cenozoic', start: '66 Ma', end: 'Present' },
  { id: 'holocene', label: 'Holocene', start: '12 ka', end: 'Present' },
]

const SPEEDS = [
  { value: 0.5, label: '0.5×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
]

/**
 * Every time control that is not the scrubber itself, in one anchored
 * popover: range, timescale detail, milestone jumps, playback, tours,
 * saved views, and the keyboard contract.
 */
export default function TimeSettingsPopover({ onClose }) {
  const rangeStartYbp = useEarthHistoryStore((s) => s.rangeStartYbp)
  const rangeEndYbp = useEarthHistoryStore((s) => s.rangeEndYbp)
  const banner = useEarthHistoryStore((s) => s.banner)
  const timelineDrillRank = useEarthHistoryStore((s) => s.timelineDrillRank)
  const colorblindSafe = useEarthHistoryStore((s) => s.colorblindSafe)
  const reducedMotion = useEarthHistoryStore((s) => s.reducedMotion)
  const autoplaySpeed = useEarthHistoryStore((s) => s.autoplaySpeed)
  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const setRange = useEarthHistoryStore((s) => s.setRange)
  const setTimelineDrillRank = useEarthHistoryStore((s) => s.setTimelineDrillRank)
  const toggleColorblindSafe = useEarthHistoryStore((s) => s.toggleColorblindSafe)
  const setAutoplaySpeed = useEarthHistoryStore((s) => s.setAutoplaySpeed)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)

  const rootRef = useRef(null)
  const [startText, setStartText] = useState(() => formatDeepTime(rangeStartYbp))
  const [endText, setEndText] = useState(() => formatDeepTime(rangeEndYbp))
  const [localError, setLocalError] = useState(null)

  useEffect(() => {
    setStartText(formatDeepTime(rangeStartYbp))
    setEndText(formatDeepTime(rangeEndYbp))
  }, [rangeStartYbp, rangeEndYbp])

  // Escape and outside-click close the popover; never a timer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target) &&
        !e.target.closest?.('.eh-timeline__settings')
      ) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  const commitRange = () => {
    const a = parseDeepTimeInput(startText)
    const b = parseDeepTimeInput(endText)
    if (!a.ok) return setLocalError(a.error)
    if (!b.ok) return setLocalError(b.error)
    if (setRange(a.ybp, b.ybp)) {
      setLocalError(null)
      syncUrl()
    }
  }

  const applyPreset = (preset) => {
    const a = parseDeepTimeInput(preset.start)
    const b = parseDeepTimeInput(preset.end)
    if (!a.ok || !b.ok) return
    if (setRange(a.ybp, b.ybp)) {
      setLocalError(null)
      syncUrl()
    }
  }

  // ---- Milestone jump ----
  const sorted = useMemo(() => milestonesSorted(), [])
  const selectValue = useMemo(() => {
    let best = ''
    let bestDist = Infinity
    for (const m of sorted) {
      const d = Math.abs(maToYbp(m.ageMa) - playheadYbp)
      const tol = Math.max(maToYbp(m.ageMa) * 0.02, 500)
      if (d <= tol && d < bestDist) {
        bestDist = d
        best = m.id
      }
    }
    return best
  }, [playheadYbp, sorted])

  const jumpTo = (milestone) => {
    if (!milestone) return
    const store = useEarthHistoryStore.getState()
    store.setScrubbing(false)
    store.setPlayheadYbp(maToYbp(milestone.ageMa))
    if (milestone.eventId) store.pinEvent(milestone.eventId)
    else store.clearPinnedEvent()
    store.syncUrl()
  }

  const stepMilestone = (delta) => {
    const idx = sorted.findIndex((m) => m.id === selectValue)
    const base =
      idx >= 0
        ? idx
        : sorted.reduce(
            (bi, m, i) =>
              Math.abs(maToYbp(m.ageMa) - playheadYbp) <
              Math.abs(maToYbp(sorted[bi].ageMa) - playheadYbp)
                ? i
                : bi,
            0,
          )
    const next = Math.min(sorted.length - 1, Math.max(0, base + delta))
    jumpTo(sorted[next])
  }

  return (
    <div
      ref={rootRef}
      className="eh-pop"
      role="dialog"
      aria-label="Timeline settings"
    >
      <section className="eh-pop__section">
        <h3 className="eh-pop__title">Range</h3>
        <div className="eh-pop__presets" role="group" aria-label="Range presets">
          {RANGE_PRESETS.map((p) => (
            <button key={p.id} type="button" className="eh-pop__chip" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="eh-pop__fields">
          <label className="eh-pop__field">
            <span>Start</span>
            <input
              type="text"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRange()
              }}
              aria-label="Range start age"
            />
          </label>
          <label className="eh-pop__field">
            <span>End</span>
            <input
              type="text"
              value={endText}
              onChange={(e) => setEndText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRange()
              }}
              aria-label="Range end age"
            />
          </label>
          <button type="button" className="eh-pop__apply" onClick={commitRange}>
            Apply
          </button>
        </div>
        {(localError || banner) && (
          <p className="eh-pop__error" role="alert">
            {localError || banner}
          </p>
        )}
      </section>

      <section className="eh-pop__section">
        <h3 className="eh-pop__title">Timescale</h3>
        <div className="eh-pop__segments" role="group" aria-label="Timescale detail level">
          {DRILL_RANKS.map((rank) => (
            <button
              key={rank}
              type="button"
              className={`eh-pop__segment${timelineDrillRank === rank ? ' eh-pop__segment--on' : ''}`}
              aria-pressed={timelineDrillRank === rank}
              onClick={() => setTimelineDrillRank(rank)}
            >
              {rank}
            </button>
          ))}
        </div>
        <label className="eh-pop__switch-row">
          <span>Colorblind-safe band colors</span>
          <button
            type="button"
            role="switch"
            aria-checked={colorblindSafe}
            className={`eh-pop__switch${colorblindSafe ? ' eh-pop__switch--on' : ''}`}
            onClick={() => toggleColorblindSafe()}
          >
            <span className="eh-pop__switch-knob" />
          </button>
        </label>
      </section>

      <section className="eh-pop__section">
        <h3 className="eh-pop__title">Jump to</h3>
        <div className="eh-pop__jump">
          <select
            className="eh-pop__select"
            value={selectValue}
            onChange={(e) => {
              const m = DEEP_TIME_MILESTONES.find((x) => x.id === e.target.value)
              jumpTo(m)
            }}
            aria-label="Jump to milestone"
          >
            <option value="">Milestone…</option>
            {sorted.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="eh-pop__step"
            aria-label="Previous milestone (older)"
            onClick={() => stepMilestone(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className="eh-pop__step"
            aria-label="Next milestone (younger)"
            onClick={() => stepMilestone(1)}
          >
            →
          </button>
        </div>
      </section>

      {!reducedMotion && (
        <section className="eh-pop__section">
          <h3 className="eh-pop__title">Playback</h3>
          <div className="eh-pop__segments" role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`eh-pop__segment${autoplaySpeed === s.value ? ' eh-pop__segment--on' : ''}`}
                aria-pressed={autoplaySpeed === s.value}
                onClick={() => setAutoplaySpeed(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {!reducedMotion && (
        <section className="eh-pop__section">
          <h3 className="eh-pop__title">Tours</h3>
          <TourControls />
        </section>
      )}

      <section className="eh-pop__section">
        <h3 className="eh-pop__title">Saved views</h3>
        <SavedViews />
      </section>

      <section className="eh-pop__section eh-pop__section--kbd">
        <h3 className="eh-pop__title">Keyboard</h3>
        <dl className="eh-pop__kbd">
          <div>
            <dt>
              <kbd>←</kbd> <kbd>→</kbd>
            </dt>
            <dd>Step milestones · fine step on the slider</dd>
          </div>
          <div>
            <dt>
              <kbd>Shift</kbd>+<kbd>←→</kbd>
            </dt>
            <dd>Interval boundary at current detail</dd>
          </div>
          <div>
            <dt>
              <kbd>PgUp</kbd> <kbd>PgDn</kbd>
            </dt>
            <dd>Era boundary</dd>
          </div>
          <div>
            <dt>
              <kbd>Home</kbd> <kbd>End</kbd>
            </dt>
            <dd>Range ends</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
