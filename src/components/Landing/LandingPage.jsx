import { useCallback, useEffect, useId, useRef, useState, lazy, Suspense } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AtlasWordmark } from '../UI/AtlasWordmark'
import { useAtlasStore } from '../../store/atlasStore'
import AuthDialog from './AuthDialog'
import { LandingGlobeDemoFallback } from './LandingGlobeDemoFallback'
import ContactDialog from './ContactDialog'
import FooterClock from './FooterClock'

const LandingGoogleGlobe = lazy(() => import('./LandingGoogleGlobe'))

const LANDING_NAV = [
  { id: 'the-problem', label: 'The Problem' },
  { id: 'what-you-get', label: 'What You Get' },
  { id: 'contact', label: 'Contact' },
]

const CAPABILITIES = [
  {
    title: 'Living Globe',
    body: 'Every news event pinned to its exact location on a real-time 3D globe. Spin, zoom, and explore the world as it unfolds.',
  },
  {
    title: 'Your Sources',
    body: 'Choose from hundreds of global publishers across every region. No algorithm decides what you see — you do.',
  },
  {
    title: 'Pattern Recognition',
    body: 'Regional clusters reveal how stories connect across borders — what a single headline never shows.',
  },
  {
    title: 'Open Source',
    body: 'No data harvesting, no monetized attention, no black-box curation. Transparent by design — the code is yours to inspect.',
  },
]

export default function LandingPage() {
  const acknowledgeLanding = useAtlasStore((s) => s.acknowledgeLanding)
  const launchWithAllSources = useAtlasStore((s) => s.launchWithAllSources)
  const reduceMotion = useReducedMotion()
  const landingScrollRef = useRef(null)
  const navTopSentinelRef = useRef(null)
  const menuToggleRef = useRef(null)
  const [navAtTop, setNavAtTop] = useState(true)
  const [immersive, setImmersive] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState(null)
  const [contactTopic, setContactTopic] = useState(null)

  const menuId = `${useId()}-nav-menu`
  const scrollBehavior = reduceMotion ? 'auto' : 'smooth'

  const scrollTo = useCallback(
    (id) => {
      document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
    },
    [scrollBehavior],
  )

  const scrollLandingTop = useCallback(() => {
    landingScrollRef.current?.scrollTo({ top: 0, behavior: scrollBehavior })
  }, [scrollBehavior])

  const enterApp = useCallback(() => {
    acknowledgeLanding()
    launchWithAllSources()
  }, [acknowledgeLanding, launchWithAllSources])

  const openAuth = useCallback((mode) => {
    setMenuOpen(false)
    setAuthMode(mode)
  }, [])

  const closeAuth = useCallback(() => setAuthMode(null), [])

  const handleAuthSuccess = useCallback(() => {
    setAuthMode(null)
    enterApp()
  }, [enterApp])

  const toggleImmersive = useCallback(() => {
    setMenuOpen(false)
    setImmersive((prev) => !prev)
  }, [])

  const closeContact = useCallback(() => setContactTopic(null), [])

  // Escape unwinds one layer at a time, innermost first. The auth dialog owns
  // its own Escape handling, so it is not represented here.
  useEffect(() => {
    if (!immersive && !menuOpen) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (menuOpen) {
        setMenuOpen(false)
        menuToggleRef.current?.focus()
      } else {
        setImmersive(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [immersive, menuOpen])

  const navScrollTo = useCallback(
    (id) => {
      setImmersive(false)
      setMenuOpen(false)
      // Let the immersive fade release the content before measuring offsets.
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior, block: 'start' })
      }, 60)
    },
    [scrollBehavior],
  )

  useEffect(() => {
    // Block native HTML drag-and-drop on the landing (link/text ghosts that follow the
    // pointer on press-and-hold). Native listener: framer-motion swallows `onDragStart`.
    const root = landingScrollRef.current
    if (!root) return
    const onDragStart = (e) => {
      if (!e.target.closest?.('input, textarea')) e.preventDefault()
    }
    root.addEventListener('dragstart', onDragStart)
    return () => root.removeEventListener('dragstart', onDragStart)
  }, [])

  useEffect(() => {
    const root = landingScrollRef.current
    const sentinel = navTopSentinelRef.current
    if (!root || !sentinel) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        setNavAtTop(entry.isIntersecting)
      },
      { root, rootMargin: '0px', threshold: 0 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [])

  const heroCopyMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } }
    : {
        initial: { opacity: 0, y: 28 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: 0.55, duration: 1, ease: [0.16, 1, 0.3, 1] },
      }

  const sectionLinks = LANDING_NAV.map(({ id, label }) => (
    <button key={id} type="button" onClick={() => navScrollTo(id)} className="stitch-nav-link">
      {label}
    </button>
  ))

  const exploreLink = (
    <button
      type="button"
      onClick={toggleImmersive}
      className={`stitch-nav-link${immersive ? ' stitch-nav-link--active' : ''}`}
      aria-pressed={immersive}
    >
      Explore
    </button>
  )

  return (
    <motion.div
      ref={landingScrollRef}
      className={`landing-page stitch-landing fixed inset-0 z-[55] flex flex-col overflow-y-auto overflow-x-hidden${immersive ? ' landing--immersive' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      role="document"
      aria-label="ATLAS introduction"
    >
      <div ref={navTopSentinelRef} className="stitch-nav-scroll-sentinel" aria-hidden />
      <div className="landing-globe-immersive">
        <Suspense fallback={<LandingGlobeDemoFallback immersive />}>
          <LandingGoogleGlobe />
        </Suspense>
      </div>
      <div className="landing-page__glow pointer-events-none" aria-hidden />

      <header
        className={`stitch-nav-wrap stitch-nav-wrap--floating sticky top-0 z-30${navAtTop ? '' : ' stitch-nav-wrap--scrolled'}`}
      >
        <nav className="stitch-nav-bar" aria-label="Primary">
          <button
            type="button"
            className="stitch-nav-logo flex items-center shrink-0 border-0 bg-transparent p-0 cursor-pointer text-inherit justify-self-start"
            onClick={scrollLandingTop}
            aria-label="ATLAS — top of page"
          >
            <AtlasWordmark className="atlas-wordmark--landing w-auto opacity-[0.98]" aria-hidden />
          </button>

          <div className="stitch-nav-bar__links stitch-nav-bar__links--desktop">
            {sectionLinks}
            {exploreLink}
          </div>

          <div className="stitch-nav-bar__actions justify-self-end">
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="stitch-nav-login-link stitch-nav-login-link--desktop"
              id="nav-login"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="atlas-cta atlas-cta--nav"
              id="nav-signup"
            >
              Sign up
            </button>
            <button
              ref={menuToggleRef}
              type="button"
              className={`stitch-nav-menu-toggle${menuOpen ? ' is-open' : ''}`}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="stitch-nav-menu-toggle__bar" aria-hidden />
              <span className="stitch-nav-menu-toggle__bar" aria-hidden />
            </button>
          </div>

          <div id={menuId} className="stitch-nav-sheet" hidden={!menuOpen}>
            {sectionLinks}
            {exploreLink}
            <button
              type="button"
              onClick={() => openAuth('signin')}
              className="stitch-nav-link"
            >
              Login
            </button>
          </div>
        </nav>
      </header>

      <main
        className="relative z-10 stitch-landing__content landing-main-over-globe"
        inert={immersive}
      >
        <section className="stitch-hero stitch-hero--fold">
          <div className="flex-1 min-h-0" aria-hidden />
          <motion.div
            className="stitch-hero__copy landing-hit-target"
            {...heroCopyMotion}
          >
            <div className="stitch-hero__lede">
              <h1 className="stitch-hero-title">
                Every signal. One living globe.
              </h1>
              <p className="stitch-hero-body">
                Open-source intelligence for analysts — focused signal, less noise.
              </p>
            </div>
            <div className="stitch-hero__actions">
              <div className="stitch-hero__cta-row">
                <button type="button" onClick={enterApp} className="atlas-cta atlas-cta--hero" id="hero-cta">
                  <span className="atlas-cta__text">Open the globe</span>
                  <span className="atlas-cta__arrow" aria-hidden>→</span>
                </button>
                <button
                  type="button"
                  className="stitch-hero-see-link"
                  onClick={() => scrollTo('what-you-get')}
                  id="hero-see-what-you-get"
                >
                  See what you get
                </button>
              </div>
              <p className="stitch-hero-note">No account needed to look around.</p>
            </div>
          </motion.div>
          <div className="stitch-hero__scroll-wrap landing-hit-target">
            <button
              type="button"
              className="stitch-hero-scroll-cue"
              onClick={() => scrollTo('the-problem')}
              aria-label="Scroll to next section"
            >
              <span className="stitch-hero-scroll-cue__line" aria-hidden />
              <span className="stitch-hero-scroll-cue__chev" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
          </div>
        </section>

        <section id="the-problem" className="atlas-why landing-hit-target scroll-mt-20">
          <div className="atlas-why__header">
            <h2 className="atlas-section-title">
              The world doesn&apos;t send<br />email digests.
            </h2>
            <p className="atlas-section-body mt-5 mx-auto text-center text-balance">
              You&apos;re reading disconnected headlines from a dozen tabs. None of them tell you <em>where</em> things are happening, how events relate, or what the broader picture looks like. You&apos;re consuming noise — not intelligence.
            </p>
          </div>

          <div className="atlas-why__grid">
            {[
              {
                label: 'Before ATLAS',
                points: [
                  'Scattered feeds with no geographic context',
                  'No way to see how stories relate globally',
                  'Algorithmic bias shapes what you see',
                  'Signal buried under opinion and noise',
                ],
              },
              {
                label: 'With ATLAS',
                points: [
                  'Every story pinned to where it happened',
                  'Patterns emerge across regions and time',
                  'You choose your sources — unfiltered',
                  'One glance tells you the state of the world',
                ],
              },
            ].map((col) => (
              <div key={col.label} className="atlas-why__card">
                <div className="atlas-why__card-header">
                  <span className="atlas-why__card-label">{col.label}</span>
                </div>
                <ul className="atlas-why__list">
                  {col.points.map((p) => (
                    <li key={p} className="atlas-why__list-item">{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="what-you-get" className="atlas-features landing-hit-target scroll-mt-20">
          <div className="atlas-why__header">
            <h2 className="atlas-section-title">Intelligence at the speed<br />of the world.</h2>
          </div>

          <ul className="atlas-capability-list">
            {CAPABILITIES.map((f) => (
              <li key={f.title} className="atlas-capability__item">
                <h3 className="atlas-capability__title">{f.title}</h3>
                <p className="atlas-capability__body">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="atlas-final-cta landing-hit-target">
          <div className="atlas-final-cta__inner">
            <h2 className="atlas-final-cta__title">
              The world is signaling.<br />Are you listening?
            </h2>
            <button type="button" onClick={enterApp} className="atlas-cta atlas-cta--hero" id="cta-enter">
              <span className="atlas-cta__text">Open the globe</span>
              <span className="atlas-cta__arrow" aria-hidden>→</span>
            </button>
          </div>
        </section>

        <footer id="contact" className="atlas-footer landing-hit-target scroll-mt-24">
          <div className="atlas-footer__inner">
            <div className="atlas-footer__brand">
              <button
                type="button"
                className="atlas-footer__mark"
                onClick={scrollLandingTop}
                aria-label="ATLAS — back to top"
              >
                <AtlasWordmark
                  className="atlas-wordmark--landing atlas-wordmark--landing-footer w-auto"
                  withGlow={false}
                  aria-hidden
                />
              </button>
              <p className="atlas-footer__tagline">
                Open-source global intelligence. Not operational intelligence.
              </p>
              <FooterClock />
            </div>

            {/* Hairline action rows — same grammar as the capability list above */}
            <ul className="atlas-footer__actions">
              <li className="atlas-footer__action">
                <div className="atlas-footer__action-copy">
                  <h2 className="atlas-footer__heading">Contact</h2>
                  <p className="atlas-footer__body">
                    Questions, partnerships, or press — reach out directly.
                  </p>
                  <p className="atlas-footer__aside">
                    <button
                      type="button"
                      className="atlas-footer__link"
                      onClick={() => setContactTopic('bug')}
                      id="footer-bug-btn"
                    >
                      Report a bug
                    </button>
                    <span className="atlas-footer__dot" aria-hidden>·</span>
                    <button
                      type="button"
                      className="atlas-footer__link"
                      onClick={() => setContactTopic('feature')}
                      id="footer-feature-btn"
                    >
                      Request a feature
                    </button>
                  </p>
                </div>
                <button
                  type="button"
                  className="atlas-cta atlas-cta--nav"
                  onClick={() => setContactTopic('message')}
                  id="footer-contact-btn"
                >
                  <span className="atlas-cta__text">Send a message</span>
                </button>
              </li>
              <li className="atlas-footer__action">
                <div className="atlas-footer__action-copy">
                  <h2 className="atlas-footer__heading">Earth History</h2>
                  <p className="atlas-footer__body">
                    Continents, eras, and paleogeography — deep time, separate from live OSINT.
                  </p>
                </div>
                <a href="/earth-history" className="atlas-cta atlas-cta--nav" id="footer-earth-history-btn">
                  <span className="atlas-cta__text">Open Earth History</span>
                  <span className="atlas-cta__arrow" aria-hidden>→</span>
                </a>
              </li>
            </ul>

            <div className="atlas-footer__bottom">
              <nav className="atlas-footer__nav" aria-label="Footer">
                <button type="button" onClick={() => scrollTo('the-problem')} className="atlas-footer__nav-link">The Problem</button>
                <button type="button" onClick={() => scrollTo('what-you-get')} className="atlas-footer__nav-link">What You Get</button>
                <button type="button" onClick={() => scrollTo('contact')} className="atlas-footer__nav-link">Contact</button>
                <a href="/earth-history" className="atlas-footer__nav-link">Earth History</a>
              </nav>
              <p className="atlas-footer__copy">
                © {new Date().getFullYear()} ATLAS · Open-source signals · Not operational intelligence
              </p>
            </div>
          </div>
        </footer>
      </main>

      <AnimatePresence>
        {authMode && (
          <AuthDialog
            key={authMode}
            mode={authMode}
            onClose={closeAuth}
            onSuccess={handleAuthSuccess}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contactTopic && (
          <ContactDialog
            key={contactTopic}
            initialTopic={contactTopic}
            onClose={closeContact}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
