import { useCallback, useEffect, useRef } from 'react'
import { AUTOPLAY_DURATION_MS, useEarthHistoryStore } from '../store/earthHistoryStore'
import { formatDeepTime, maToYbp, sliderToYbp, ybpToMa, ybpToSlider } from '../core/timeScale'
import { resolveEraContext } from '../core/eraCatalog'
import { milestonesSorted, nearestEvent, nearestMilestoneIndex } from '../core/eventsCatalog'
import { getTourById, resolveChapter } from '../core/narrativeTours'
import { formatHolocenePlayhead } from '../core/calendarYear'
import TimelineScrubber from './TimelineScrubber'
import TimeSettingsPopover from './TimeSettingsPopover'
import ActiveFilterChips from './ActiveFilterChips'

const STEP_THROTTLE_MS = 150

/** Playhead readout: the one number the surface is about. */
function TimeReadout() {
  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const erasBlurbs = useEarthHistoryStore((s) => s.erasBlurbs)
  const ctx = resolveEraContext(playheadYbp, { blurbs: erasBlurbs || undefined })
  const holoceneLabel = formatHolocenePlayhead(playheadYbp)
  const age = holoceneLabel || formatDeepTime(playheadYbp)
  const interval = ctx.primary?.name || ctx.label

  return (
    <div className="eh-timeline__readout" aria-live="off">
      <span className="eh-timeline__readout-label">Time</span>
      <span className="eh-timeline__readout-age">{age}</span>
      <span className="eh-timeline__readout-era">{interval}</span>
    </div>
  )
}

/**
 * Bottom timeline panel — the single parent time control. Hosts the readout,
 * play/pause, the scrubber, and the settings popover trigger. Also runs the
 * always-mounted engines: autoplay loop, tour chapter advance, global
 * milestone arrow keys, and the nearest-event highlight.
 */
export default function TimelinePanel() {
  const autoplay = useEarthHistoryStore((s) => s.autoplay)
  const reducedMotion = useEarthHistoryStore((s) => s.reducedMotion)
  const timePopoverOpen = useEarthHistoryStore((s) => s.timePopoverOpen)
  const toggleAutoplay = useEarthHistoryStore((s) => s.toggleAutoplay)
  const setTimePopoverOpen = useEarthHistoryStore((s) => s.setTimePopoverOpen)

  // ---- Autoplay: constant slider-space speed across the active range ----
  const rangeStartYbp = useEarthHistoryStore((s) => s.rangeStartYbp)
  const rangeEndYbp = useEarthHistoryStore((s) => s.rangeEndYbp)
  const autoplaySpeed = useEarthHistoryStore((s) => s.autoplaySpeed)

  useEffect(() => {
    if (!autoplay || reducedMotion) return undefined
    const range = { startYbp: rangeStartYbp, endYbp: rangeEndYbp }
    const duration = AUTOPLAY_DURATION_MS / (autoplaySpeed || 1)
    let raf = 0
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min(64, now - last)
      last = now
      const store = useEarthHistoryStore.getState()
      const u = ybpToSlider(store.playheadYbp, range)
      const nextU = u + dt / duration
      if (nextU >= 1) {
        store.setPlayheadYbp(rangeEndYbp)
        store.setAutoplay(false)
        store.syncUrl()
        return
      }
      // scrubbing stays false so texture prefetch keeps pace with the playhead
      store.setPlayheadYbp(sliderToYbp(nextU, range))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      useEarthHistoryStore.getState().syncUrl()
    }
  }, [autoplay, reducedMotion, rangeStartYbp, rangeEndYbp, autoplaySpeed])

  // ---- Tour engine: dwell on the chapter, then advance ----
  const tourPlaying = useEarthHistoryStore((s) => s.tourPlaying)
  const activeTourId = useEarthHistoryStore((s) => s.activeTourId)
  const tourChapterIndex = useEarthHistoryStore((s) => s.tourChapterIndex)

  useEffect(() => {
    if (!tourPlaying || !activeTourId || reducedMotion) return undefined
    const tour = getTourById(activeTourId)
    if (!tour) return undefined
    const chapter = resolveChapter(tour.chapters[tourChapterIndex] || tour.chapters[0])
    const timer = window.setTimeout(() => {
      useEarthHistoryStore.getState().advanceTourChapter()
    }, chapter.dwellMs)
    return () => window.clearTimeout(timer)
  }, [tourPlaying, activeTourId, tourChapterIndex, reducedMotion])

  // ---- Global ← / → milestone stepping (outside inputs and the rail) ----
  const lastStepAt = useRef(0)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target
      if (
        t instanceof HTMLElement &&
        (t.closest('input, textarea, select, [contenteditable="true"]') ||
          t.closest('.eh-scrub__rail') ||
          t.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      const now = performance.now()
      if (now - lastStepAt.current < STEP_THROTTLE_MS) return
      lastStepAt.current = now

      const store = useEarthHistoryStore.getState()
      const sorted = milestonesSorted()
      const idx = nearestMilestoneIndex(ybpToMa(store.playheadYbp), sorted)
      const next = Math.min(sorted.length - 1, Math.max(0, idx + (e.key === 'ArrowLeft' ? -1 : 1)))
      if (next === idx) return
      const m = sorted[next]
      store.setScrubbing(false)
      store.setPlayheadYbp(maToYbp(m.ageMa))
      if (m.eventId) store.pinEvent(m.eventId)
      else store.clearPinnedEvent()
      store.syncUrl()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ---- Nearest-event highlight: imperative, writes only on change ----
  useEffect(() => {
    const apply = (s) => {
      if (!s.layers.events) {
        if (!s.pinnedEventId && s.selectedEventId) s.setSelectedEventId(null)
        return
      }
      if (s.pinnedEventId) {
        if (s.selectedEventId !== s.pinnedEventId) s.setSelectedEventId(s.pinnedEventId)
        return
      }
      const hit = nearestEvent(s.playheadYbp, {
        startYbp: s.rangeStartYbp,
        endYbp: s.rangeEndYbp,
      })
      const id = hit?.event.id ?? null
      if (id !== s.selectedEventId) s.setSelectedEventId(id)
    }
    apply(useEarthHistoryStore.getState())
    return useEarthHistoryStore.subscribe((s, prev) => {
      if (
        s.playheadYbp !== prev.playheadYbp ||
        s.pinnedEventId !== prev.pinnedEventId ||
        s.layers.events !== prev.layers.events ||
        s.rangeStartYbp !== prev.rangeStartYbp ||
        s.rangeEndYbp !== prev.rangeEndYbp
      ) {
        apply(s)
      }
    })
  }, [])

  const onSettingsClick = useCallback(() => {
    setTimePopoverOpen(!timePopoverOpen)
  }, [setTimePopoverOpen, timePopoverOpen])

  return (
    <div className="eh-timeline">
      <ActiveFilterChips />
      <div className="eh-timeline__panel">
        <div className="eh-timeline__head">
          {!reducedMotion ? (
            <button
              type="button"
              className={`eh-timeline__play${autoplay ? ' eh-timeline__play--on' : ''}`}
              onClick={toggleAutoplay}
              aria-pressed={autoplay}
              aria-label={autoplay ? 'Pause playback through time' : 'Play through time'}
            >
              {autoplay ? (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <rect x="3.5" y="2.5" width="3" height="11" fill="currentColor" />
                  <rect x="9.5" y="2.5" width="3" height="11" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                  <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
                </svg>
              )}
            </button>
          ) : (
            <span className="eh-timeline__play-spacer" aria-hidden />
          )}

          <TimeReadout />

          <button
            type="button"
            className={`eh-timeline__settings${timePopoverOpen ? ' eh-timeline__settings--on' : ''}`}
            onClick={onSettingsClick}
            aria-expanded={timePopoverOpen}
            aria-haspopup="dialog"
            aria-label="Timeline settings"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path
                d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="10.5" cy="4.5" r="1.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <circle cx="5.5" cy="11.5" r="1.8" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
          </button>
        </div>

        <TimelineScrubber />
      </div>

      {timePopoverOpen && <TimeSettingsPopover onClose={() => setTimePopoverOpen(false)} />}
    </div>
  )
}
