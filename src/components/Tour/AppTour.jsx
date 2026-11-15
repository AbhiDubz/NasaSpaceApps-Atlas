/**
 * AppTour — first-run guided walkthrough of the live globe UI.
 *
 * - Auto-offered once (see `core/tourState` for who gets asked and when), as a small
 *   prompt the user can accept or skip. Replayable any time from the header "More" menu.
 * - Each step spotlights a real HUD control via its `data-tour="…"` attribute. Steps whose
 *   control isn't on screen (mobile layout, panel already open, signed-out-only UI…) are
 *   dropped automatically, so the same script works on desktop and phone.
 * - Skip / Finish are persisted locally and, when signed in, on the account.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useAtlasStore } from '../../store/atlasStore'
import {
  markActive,
  readLastActiveAt,
  saveTourDecision,
  shouldOfferTour,
  syncTourDecisionToAccount,
} from '../../core/tourState'

/** Read once at load, before this session bumps it — "were they here recently?" */
const LAST_ACTIVE_AT_SESSION_START = readLastActiveAt()
/** Let the HUD finish its entrance animation before prompting. */
const OFFER_DELAY_MS = 2600
const SPOT_PAD = 6
const CARD_GAP = 14
const EDGE = 12

/**
 * @typedef {{ id: string, target?: string, title: string, body: string, mobileBody?: string,
 *   signedIn?: boolean }} TourStep
 * `target` — value of a `data-tour` attribute. No target = centred card.
 * `signedIn` — true/false restricts the step to signed-in / signed-out users.
 */
/** @type {TourStep[]} */
const STEPS = [
  {
    id: 'globe',
    title: 'This is the live globe',
    body: 'Every pin is a news story or signal, placed where it happened. Drag to spin, scroll to zoom, and click a pin to open the full story.',
    mobileBody: 'Every pin is a news story or signal, placed where it happened. Drag to spin, pinch to zoom, and tap a pin to open the full story.',
  },
  {
    id: 'search',
    target: 'search',
    title: 'Search anywhere',
    body: 'Jump to a country, city or landmark. ATLAS flies you there so you can see what is happening nearby.',
  },
  {
    id: 'triage',
    target: 'triage',
    title: 'Triage',
    body: 'What changed since you last looked. The badge counts new high-severity events.',
  },
  {
    id: 'analytics',
    target: 'analytics',
    title: 'Analytics',
    body: 'Themes, spikes and trends across all incoming coverage, at a glance.',
  },
  {
    id: 'layers',
    target: 'layers',
    title: 'Globe layers',
    body: 'Turn data layers on or off: alerts, live movement, conditions, Earth observation and more.',
  },
  {
    id: 'settings',
    target: 'settings',
    title: 'Settings',
    body: 'Graphics quality, colour-blind mode, globe renderer and other preferences.',
  },
  {
    id: 'streetview',
    target: 'streetview',
    title: 'Street View',
    body: 'Switch this on, then click anywhere on the globe to drop into a ground-level panorama.',
  },
  {
    id: 'legend',
    target: 'legend',
    title: 'Legend',
    body: 'What the colours and shapes on the globe mean. Open it any time you are unsure.',
  },
  {
    id: 'trend',
    target: 'trend',
    title: 'Trend Detective',
    body: 'Pick a place and a variable to see decades of NASA climate data and whether it is really changing.',
  },
  {
    id: 'ask-atlas',
    target: 'ask-atlas',
    title: 'Ask Atlas',
    body: 'Ask questions in plain language and get answers grounded in the data on screen.',
  },
  {
    id: 'more',
    target: 'more',
    title: 'More actions',
    body: 'Share a link to this view, export briefs and reports, manage news sources, hide the HUD, or replay this tour.',
    mobileBody: 'Triage, globe layers and settings live here on mobile. You can also share a link, export briefs, manage sources, or replay this tour.',
  },
  {
    id: 'account-in',
    target: 'account',
    signedIn: true,
    title: 'Your account',
    body: 'Your sources, preferences and workspaces sync to your account across devices.',
  },
  {
    id: 'account-out',
    target: 'account',
    signedIn: false,
    title: 'Save your setup',
    body: 'Sign in to keep your sources and preferences, and to build investigation workspaces. No account needed to look around.',
  },
  {
    id: 'done',
    title: "You're all set",
    body: 'Shortcuts: F hides the HUD, Tab cycles through top events, Q W E R T jump to landmarks, and Esc closes panels. Replay this tour from the ••• menu.',
    mobileBody: 'Replay this tour any time from the ••• menu in the top right.',
  },
]

function findTarget(id) {
  if (!id) return null
  const el = document.querySelector(`[data-tour="${id}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return el
}

function sameRect(a, b) {
  if (!a || !b) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

/** Card position next to the spotlight, clamped to the viewport. */
function placeCard(rect, cardW, cardH) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect) {
    return { left: Math.max(EDGE, (vw - cardW) / 2), top: Math.max(EDGE, (vh - cardH) / 2) }
  }
  const cx = rect.left + rect.width / 2
  const left = Math.min(Math.max(EDGE, cx - cardW / 2), vw - cardW - EDGE)
  const below = rect.top + rect.height + SPOT_PAD + CARD_GAP
  const above = rect.top - SPOT_PAD - CARD_GAP - cardH
  const preferBelow = rect.top + rect.height / 2 < vh / 2
  let top = preferBelow ? below : above
  if (preferBelow && top + cardH > vh - EDGE) top = above
  if (!preferBelow && top < EDGE) top = below
  top = Math.min(Math.max(EDGE, top), vh - cardH - EDGE)
  return { left, top }
}

export default function AppTour({ hudHidden = false, onShowHud }) {
  const user = useAtlasStore((s) => s.user)
  const authReady = useAtlasStore((s) => s.authReady)
  const mobileMode = useAtlasStore((s) => s.mobileMode)
  const tourOpen = useAtlasStore((s) => s.tourOpen)
  const tourMode = useAtlasStore((s) => s.tourMode)
  const openTour = useAtlasStore((s) => s.openTour)
  const closeTour = useAtlasStore((s) => s.closeTour)
  const reduceMotion = useReducedMotion()

  /** 'prompt' = "take the tour?" card; 'tour' = walking through steps */
  const [phase, setPhase] = useState('prompt')
  const [steps, setSteps] = useState([])
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const [cardSize, setCardSize] = useState({ w: 340, h: 180 })
  const cardRef = useRef(null)
  const primaryRef = useRef(null)
  const offeredRef = useRef(false)
  const titleId = useId()
  const bodyId = useId()

  // Track "recently used" for anonymous visitors.
  useEffect(() => {
    markActive()
    const bump = () => markActive()
    window.addEventListener('pointerdown', bump, { passive: true })
    window.addEventListener('keydown', bump)
    return () => {
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [])

  // Signing in reconciles device ↔ account so the prompt never comes back after re-login.
  useEffect(() => {
    if (user) syncTourDecisionToAccount(user)
  }, [user])

  // Auto-offer once per session, after auth has resolved (so accounts that already
  // decided on another device are recognised).
  useEffect(() => {
    if (!authReady || offeredRef.current || tourOpen) return
    const t = setTimeout(() => {
      if (offeredRef.current) return
      offeredRef.current = true
      const state = useAtlasStore.getState()
      if (state.tourOpen) return
      if (shouldOfferTour(state.user, LAST_ACTIVE_AT_SESSION_START)) {
        openTour('prompt')
      }
    }, OFFER_DELAY_MS)
    return () => clearTimeout(t)
  }, [authReady, tourOpen, openTour])

  const buildSteps = useCallback(() => {
    const signedIn = Boolean(useAtlasStore.getState().user)
    return STEPS.filter((s) => {
      if (typeof s.signedIn === 'boolean' && s.signedIn !== signedIn) return false
      return !s.target || Boolean(findTarget(s.target))
    })
  }, [])

  const startTour = useCallback(() => {
    if (hudHidden) onShowHud?.()
    // Close open panels so they don't cover the controls being pointed at.
    const s = useAtlasStore.getState()
    if (s.ui.workbench) s.closeWorkbench()
    if (s.askAtlasOpen) useAtlasStore.setState({ askAtlasOpen: false })
    // Wait a frame for the HUD / launchers to (re)mount before measuring.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setSteps(buildSteps())
        setIndex(0)
        setPhase('tour')
      }),
    )
  }, [buildSteps, hudHidden, onShowHud])

  // Sync phase when opened: auto-offer starts at 'prompt'; menu replay jumps straight to 'tour'.
  useEffect(() => {
    if (!tourOpen) return
    if (tourMode === 'tour') {
      offeredRef.current = true
      startTour()
    } else {
      setPhase('prompt')
    }
  }, [tourOpen, tourMode, startTour])

  const finish = useCallback(
    (status) => {
      closeTour()
      saveTourDecision(status, useAtlasStore.getState().user)
      // Reset for a later replay.
      setTimeout(() => {
        setPhase('prompt')
        setIndex(0)
        setRect(null)
      }, 300)
    },
    [closeTour],
  )

  const step = phase === 'tour' ? steps[index] : null
  const isLast = phase === 'tour' && index === steps.length - 1

  const next = useCallback(() => {
    if (isLast) finish('completed')
    else setIndex((i) => Math.min(i + 1, steps.length - 1))
  }, [finish, isLast, steps.length])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Follow the spotlighted control every frame (HUD animates in; window resizes; etc.).
  useEffect(() => {
    if (!tourOpen || phase !== 'tour') {
      setRect(null)
      return
    }
    let raf
    let last = null
    const tick = () => {
      const el = findTarget(step?.target)
      const r = el ? el.getBoundingClientRect() : null
      const nextRect = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
      if (!sameRect(nextRect, last)) {
        last = nextRect
        setRect(nextRect)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [tourOpen, phase, step?.target])

  // Measure the card so it can be placed without overflowing.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (Math.abs(r.width - cardSize.w) > 1 || Math.abs(r.height - cardSize.h) > 1) {
      setCardSize({ w: r.width, h: r.height })
    }
  })

  // Move focus to the primary action for keyboard / screen-reader users.
  useEffect(() => {
    if (!tourOpen) return
    const id = requestAnimationFrame(() => primaryRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(id)
  }, [tourOpen, phase, index])

  // Keyboard: own all keys while open so app shortcuts (F, Tab, Q–T, Esc) don't fire underneath.
  useEffect(() => {
    if (!tourOpen) return
    const onKey = (e) => {
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        finish('skipped')
      } else if (phase === 'tour' && e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (phase === 'tour' && e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Tab') {
        // Keep focus inside the card.
        const focusables = cardRef.current?.querySelectorAll('button')
        if (!focusables?.length) return
        const first = focusables[0]
        const lastEl = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [tourOpen, phase, next, back, finish])

  const pos = useMemo(
    () => placeCard(phase === 'tour' ? rect : null, cardSize.w, cardSize.h),
    [phase, rect, cardSize],
  )

  const body = step ? (mobileMode && step.mobileBody) || step.body : ''
  const fade = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }

  return (
    <AnimatePresence>
      {tourOpen && (
        <motion.div
          key="atlas-tour"
          className="atlas-tour"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          {/* Click shield: the tour is modal, but clicking outside never dismisses it by accident. */}
          <div className={`atlas-tour__shield${rect ? '' : ' atlas-tour__shield--dim'}`} aria-hidden />

          {rect && (
            <div
              className="atlas-tour__spotlight"
              aria-hidden
              style={{
                top: rect.top - SPOT_PAD,
                left: rect.left - SPOT_PAD,
                width: rect.width + SPOT_PAD * 2,
                height: rect.height + SPOT_PAD * 2,
                transition: reduceMotion ? 'none' : undefined,
              }}
            />
          )}

          <div
            ref={cardRef}
            className={`atlas-tour__card${phase === 'prompt' ? ' atlas-tour__card--prompt' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            style={{ top: pos.top, left: pos.left, transition: reduceMotion ? 'none' : undefined }}
          >
            {phase === 'prompt' ? (
              <>
                <p className="atlas-tour__kicker">Welcome to ATLAS</p>
                <h2 id={titleId} className="atlas-tour__title">Take a quick tour?</h2>
                <p id={bodyId} className="atlas-tour__body">
                  A one-minute walkthrough of the globe, the tools around it and where to find things.
                  You can replay it any time from the ••• menu.
                </p>
                <div className="atlas-tour__actions">
                  <button type="button" className="atlas-tour__btn atlas-tour__btn--ghost" onClick={() => finish('skipped')}>
                    Skip
                  </button>
                  <button ref={primaryRef} type="button" className="atlas-tour__btn atlas-tour__btn--primary" onClick={startTour}>
                    Show me around
                  </button>
                </div>
              </>
            ) : step ? (
              <>
                <div className="atlas-tour__head">
                  <p className="atlas-tour__kicker" aria-live="polite">
                    {index + 1} of {steps.length}
                  </p>
                  <button type="button" className="atlas-tour__skip" onClick={() => finish('skipped')}>
                    Skip tour
                  </button>
                </div>
                <h2 id={titleId} className="atlas-tour__title">{step.title}</h2>
                <p id={bodyId} className="atlas-tour__body">{body}</p>
                <div className="atlas-tour__progress" aria-hidden>
                  {steps.map((s, i) => (
                    <span key={s.id} className={`atlas-tour__dot${i === index ? ' is-active' : ''}${i < index ? ' is-done' : ''}`} />
                  ))}
                </div>
                <div className="atlas-tour__actions">
                  {index > 0 && (
                    <button type="button" className="atlas-tour__btn atlas-tour__btn--ghost" onClick={back}>
                      Back
                    </button>
                  )}
                  <button ref={primaryRef} type="button" className="atlas-tour__btn atlas-tour__btn--primary" onClick={next}>
                    {isLast ? 'Start exploring' : 'Next'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
