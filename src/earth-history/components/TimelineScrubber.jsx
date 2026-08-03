import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import {
  formatDeepTime,
  maToYbp,
  nudgeStepYbp,
  sliderToYbp,
  ybpToMa,
  ybpToSlider,
} from '../core/timeScale'
import {
  canDrillInterval,
  drilldownTrack,
  intervalsAtRank,
  nextDrillRank,
  resolveEraContext,
  viridisColor,
} from '../core/eraCatalog'
import { DEEP_TIME_EVENTS, eventYbp, eventsInRange } from '../core/eventsCatalog'
import {
  HOLOCENE_ERA_BANDS,
  calendarYearToYbp,
  formatHolocenePlayhead,
  isHolocenePlayhead,
} from '../core/calendarYear'

/**
 * Deep-time scrubber. Three stacked rows so the drag rail owns its entire
 * surface: band strip (click to focus, double-click to drill), pure drag rail,
 * and a ruler carrying boundary ticks plus event markers.
 *
 * Scrub visuals (thumb, fill) are written straight to the DOM every pointer
 * move; the store commit is rAF-coalesced and the exact position commits on
 * pointerup, so range ends are always reachable.
 */
export default function TimelineScrubber() {
  const rangeStartYbp = useEarthHistoryStore((s) => s.rangeStartYbp)
  const rangeEndYbp = useEarthHistoryStore((s) => s.rangeEndYbp)
  const timelineDrillRank = useEarthHistoryStore((s) => s.timelineDrillRank)
  const colorblindSafe = useEarthHistoryStore((s) => s.colorblindSafe)
  const showEvents = useEarthHistoryStore((s) => s.layers.events)
  const selectedEventId = useEarthHistoryStore((s) => s.selectedEventId)
  const setRange = useEarthHistoryStore((s) => s.setRange)
  const setTimelineDrillRank = useEarthHistoryStore((s) => s.setTimelineDrillRank)

  const railRef = useRef(null)
  const thumbRef = useRef(null)
  const fillRef = useRef(null)
  const railWidth = useRef(0)
  const rafRef = useRef(0)
  const pendingU = useRef(null)

  const range = useMemo(
    () => ({ startYbp: rangeStartYbp, endYbp: rangeEndYbp }),
    [rangeStartYbp, rangeEndYbp],
  )
  const rangeRef = useRef(range)
  rangeRef.current = range

  // ---- Playhead visuals: imperative, zero React renders while scrubbing ----

  const positionPlayhead = useCallback((ybp) => {
    const rail = railRef.current
    if (!rail) return
    const w = railWidth.current || rail.getBoundingClientRect().width
    railWidth.current = w
    const u = ybpToSlider(ybp, rangeRef.current)
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate3d(${u * w}px, -50%, 0)`
    }
    if (fillRef.current) {
      fillRef.current.style.transform = `scaleX(${u})`
    }
    const holocene = isHolocenePlayhead(ybp)
    const label = holocene
      ? `${formatHolocenePlayhead(ybp)}, ${resolveEraContext(ybp).label}`
      : `${formatDeepTime(ybp)}, ${resolveEraContext(ybp).label}`
    rail.setAttribute('aria-valuenow', String(ybp))
    rail.setAttribute('aria-valuetext', label)
  }, [])

  useEffect(() => {
    const apply = (s) => positionPlayhead(s.playheadYbp)
    apply(useEarthHistoryStore.getState())
    const unsubscribe = useEarthHistoryStore.subscribe((s, prev) => {
      if (
        s.playheadYbp !== prev.playheadYbp ||
        s.rangeStartYbp !== prev.rangeStartYbp ||
        s.rangeEndYbp !== prev.rangeEndYbp
      ) {
        apply(s)
      }
    })
    return unsubscribe
  }, [positionPlayhead])

  useEffect(() => {
    const rail = railRef.current
    if (!rail || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => {
      railWidth.current = rail.getBoundingClientRect().width
      positionPlayhead(useEarthHistoryStore.getState().playheadYbp)
    })
    ro.observe(rail)
    return () => ro.disconnect()
  }, [positionPlayhead])

  // ---- Store commit: rAF-coalesced during drag ----

  const commitU = useCallback((u, scrubbing) => {
    pendingU.current = u
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const v = pendingU.current
      if (v == null) return
      pendingU.current = null
      const store = useEarthHistoryStore.getState()
      store.clearPinnedEvent()
      store.setPlayheadYbp(sliderToYbp(v, rangeRef.current), { scrubbing })
    })
  }, [])

  const flushExact = useCallback((u) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    pendingU.current = null
    const store = useEarthHistoryStore.getState()
    store.clearPinnedEvent()
    store.setPlayheadYbp(sliderToYbp(u, rangeRef.current), { scrubbing: false })
  }, [])

  const uFromPointer = useCallback((clientX) => {
    const rail = railRef.current
    if (!rail) return 0
    const rect = rail.getBoundingClientRect()
    railWidth.current = rect.width
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }, [])

  // ---- Pointer contract: down captures, move tracks, up commits exactly ----

  const onPointerDown = useCallback(
    (e) => {
      if (e.button != null && e.button !== 0) return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      useEarthHistoryStore.getState().setScrubbing(true)
      railRef.current?.setAttribute('data-scrubbing', 'true')
      const u = uFromPointer(e.clientX)
      positionPlayhead(sliderToYbp(u, rangeRef.current))
      commitU(u, true)
    },
    [commitU, positionPlayhead, uFromPointer],
  )

  const onPointerMove = useCallback(
    (e) => {
      if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return
      const u = uFromPointer(e.clientX)
      positionPlayhead(sliderToYbp(u, rangeRef.current))
      commitU(u, true)
    },
    [commitU, positionPlayhead, uFromPointer],
  )

  const endScrub = useCallback(() => {
    railRef.current?.removeAttribute('data-scrubbing')
    const store = useEarthHistoryStore.getState()
    store.setScrubbing(false)
    store.syncUrl()
  }, [])

  const onPointerUp = useCallback(
    (e) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
        const u = uFromPointer(e.clientX)
        positionPlayhead(sliderToYbp(u, rangeRef.current))
        flushExact(u)
      }
      endScrub()
    },
    [endScrub, flushExact, positionPlayhead, uFromPointer],
  )

  const onLostPointerCapture = useCallback(() => {
    endScrub()
  }, [endScrub])

  // ---- Keyboard: APG contract with geologic semantics ----

  const boundaryStep = useCallback((ybp, rank, dir) => {
    const ma = ybpToMa(ybp)
    const edges = new Set()
    for (const it of intervalsAtRank(rank)) {
      edges.add(it.startMa)
      edges.add(it.endMa)
    }
    const sorted = [...edges].sort((a, b) => a - b)
    if (dir > 0) {
      // older: smallest edge strictly greater than current ma
      const next = sorted.find((b) => b > ma + 1e-9)
      return next != null ? maToYbp(next) : null
    }
    // younger: largest edge strictly less than current ma
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i] < ma - 1e-9) return maToYbp(sorted[i])
    }
    return null
  }, [])

  const onKeyDown = useCallback(
    (e) => {
      const store = useEarthHistoryStore.getState()
      const ybp = store.playheadYbp
      const go = (next) => {
        if (next == null) return
        e.preventDefault()
        store.clearPinnedEvent()
        store.setPlayheadYbp(next)
        store.syncUrl()
      }

      const older = e.key === 'ArrowLeft' || e.key === 'ArrowDown'
      const younger = e.key === 'ArrowRight' || e.key === 'ArrowUp'

      if ((older || younger) && e.shiftKey) {
        go(boundaryStep(ybp, store.timelineDrillRank, older ? 1 : -1))
      } else if (older || younger) {
        const step = nudgeStepYbp(ybp)
        go(ybp + (older ? step : -step))
      } else if (e.key === 'PageUp' || e.key === 'PageDown') {
        go(boundaryStep(ybp, 'era', e.key === 'PageUp' ? 1 : -1))
      } else if (e.key === 'Home') {
        go(store.rangeStartYbp)
      } else if (e.key === 'End') {
        go(store.rangeEndYbp)
      }
    },
    [boundaryStep],
  )

  // ---- Band strip: interval focus / drill (PBDB Navigator mechanic) ----

  const colorblind = colorblindSafe

  const bandSource = useMemo(() => {
    if (isHolocenePlayhead(rangeStartYbp) && isHolocenePlayhead(rangeEndYbp)) {
      return HOLOCENE_ERA_BANDS.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        startMa: ybpToMa(calendarYearToYbp(p.startYear)),
        endMa: ybpToMa(calendarYearToYbp(p.endYear)),
        rank: 'epoch',
        holocene: true,
      }))
    }
    const startMa = ybpToMa(rangeStartYbp)
    const endMa = ybpToMa(rangeEndYbp)
    const list = drilldownTrack(timelineDrillRank, {
      rangeStartMa: startMa,
      rangeEndMa: endMa,
    })
    return fillWithCoarser(
      list,
      timelineDrillRank,
      Math.min(startMa, endMa),
      Math.max(startMa, endMa),
    )
  }, [rangeStartYbp, rangeEndYbp, timelineDrillRank])

  const bands = useMemo(() => {
    const mids = bandSource.map((p) => (p.startMa + p.endMa) / 2)
    const minMid = Math.min(...mids, 0)
    const maxMid = Math.max(...mids, 1)
    return bandSource
      .map((p) => {
        const u0 = ybpToSlider(maToYbp(p.startMa), range)
        const u1 = ybpToSlider(maToYbp(p.endMa), range)
        const left = Math.max(0, Math.min(u0, u1))
        const right = Math.min(1, Math.max(u0, u1))
        if (right <= left) return null
        const mid = (p.startMa + p.endMa) / 2
        const t01 = maxMid === minMid ? 0.5 : (maxMid - mid) / (maxMid - minMid)
        const color = colorblind && !p.holocene ? viridisColor(t01) : p.color
        return { ...p, color, left: left * 100, width: (right - left) * 100 }
      })
      .filter(Boolean)
  }, [bandSource, range, colorblind])

  const focusInterval = useCallback(
    (interval, { forceDrill = false } = {}) => {
      if (!interval || interval.holocene) return
      const startYbp = maToYbp(interval.startMa)
      const endYbp = maToYbp(interval.endMa)
      const store = useEarthHistoryStore.getState()

      setRange(startYbp, endYbp)
      store.clearPinnedEvent()
      store.setPlayheadYbp(clampMid(store.playheadYbp, startYbp, endYbp))

      // Focusing an interval reveals its children; double-click forces the
      // drill even on intervals without finer subdivisions in range.
      if (forceDrill || canDrillInterval(interval)) {
        const next = nextDrillRank(interval.rank)
        if (next) setTimelineDrillRank(next)
      }

      store.setScrubbing(false)
      store.syncUrl()
    },
    [setRange, setTimelineDrillRank],
  )

  // ---- Event markers + boundary ticks on the ruler row ----

  const markers = useMemo(() => {
    if (!showEvents) return []
    return eventsInRange(range, DEEP_TIME_EVENTS).map((e) => ({
      ...e,
      u: ybpToSlider(eventYbp(e), range),
    }))
  }, [range, showEvents])

  const jumpToEvent = useCallback((e, event) => {
    e.stopPropagation()
    e.preventDefault()
    const store = useEarthHistoryStore.getState()
    store.pinEvent(event.id)
    store.setPlayheadYbp(eventYbp(event))
    store.setScrubbing(false)
    store.syncUrl()
  }, [])

  const startLabel = isHolocenePlayhead(rangeStartYbp)
    ? formatHolocenePlayhead(rangeStartYbp) || formatDeepTime(rangeStartYbp)
    : formatDeepTime(rangeStartYbp)
  const endLabel = isHolocenePlayhead(rangeEndYbp)
    ? formatHolocenePlayhead(rangeEndYbp) || formatDeepTime(rangeEndYbp)
    : formatDeepTime(rangeEndYbp)

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  return (
    <div className="eh-scrub">
      <div className="eh-scrub__bands" role="group" aria-label="Geologic intervals">
        {bands.map((b) => (
          <button
            key={b.id}
            type="button"
            className="eh-scrub__band"
            title={
              b.holocene
                ? b.name
                : `${b.name} — click to focus${canDrillInterval(b) ? ', double-click to drill' : ''}`
            }
            aria-label={`Focus ${b.name}`}
            style={{
              left: `${b.left}%`,
              width: `${Math.max(b.width, 0.15)}%`,
              background: b.color,
            }}
            onClick={(e) => {
              e.preventDefault()
              focusInterval(b)
            }}
            onDoubleClick={(e) => {
              e.preventDefault()
              focusInterval(b, { forceDrill: true })
            }}
          />
        ))}
      </div>

      <div
        ref={railRef}
        className="eh-scrub__rail"
        role="slider"
        tabIndex={0}
        aria-valuemin={rangeEndYbp}
        aria-valuemax={rangeStartYbp}
        aria-label="Deep time playhead"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onLostPointerCapture}
        onKeyDown={onKeyDown}
      >
        <div className="eh-scrub__track" aria-hidden />
        <div ref={fillRef} className="eh-scrub__fill" aria-hidden />
        <div ref={thumbRef} className="eh-scrub__thumb" aria-hidden />
      </div>

      <div className="eh-scrub__ruler" aria-hidden={!showEvents}>
        {bands.map((b) => (
          <span key={`tick-${b.id}`} className="eh-scrub__tick" style={{ left: `${b.left}%` }} />
        ))}
        <span className="eh-scrub__tick eh-scrub__tick--end" style={{ left: '100%' }} />
        {markers.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`eh-scrub__marker eh-scrub__marker--${m.kind}${
              selectedEventId === m.id ? ' eh-scrub__marker--active' : ''
            }`}
            style={{ left: `${m.u * 100}%` }}
            title={`${m.name} · ${formatDeepTime(eventYbp(m))}`}
            aria-label={`${m.name}, ${formatDeepTime(eventYbp(m))}`}
            onClick={(e) => jumpToEvent(e, m)}
          />
        ))}
      </div>

      <div className="eh-scrub__ends" aria-hidden>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  )
}

const RANK_ORDER = ['eon', 'era', 'period', 'epoch', 'age']

/**
 * Deep time has no period-rank intervals before 541 Ma; without a fill, the
 * band strip only covers the Phanerozoic half of a full-Earth range. Pad the
 * uncovered spans with the nearest coarser intervals (Precambrian eras, then
 * the Hadean eon) so the strip always spans the whole rail.
 */
function fillWithCoarser(list, rank, loMa, hiMa) {
  const chosen = [...list]
  const idx = RANK_ORDER.indexOf(rank)
  for (let i = idx - 1; i >= 0; i--) {
    for (const it of intervalsAtRank(RANK_ORDER[i])) {
      if (!(it.endMa < hiMa && it.startMa > loMa)) continue
      const overlapping = chosen.some((c) => it.startMa > c.endMa && c.startMa > it.endMa)
      if (!overlapping) chosen.push(it)
    }
  }
  return chosen.sort((a, b) => b.startMa - a.startMa)
}

function clampMid(ybp, startYbp, endYbp) {
  const lo = Math.min(startYbp, endYbp)
  const hi = Math.max(startYbp, endYbp)
  if (ybp >= lo && ybp <= hi) return ybp
  return Math.round((lo + hi) / 2)
}
