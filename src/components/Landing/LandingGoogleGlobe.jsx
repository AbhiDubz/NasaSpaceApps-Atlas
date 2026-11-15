/**
 * Landing hero — decorative Google Map3D (photorealistic) backdrop: intro fly-in, idle spin,
 * drag to orbit. Intentionally no markers or info cards — feature discovery lives in the
 * in-app guided tour (`components/Tour/AppTour`).
 */
import { Component, useCallback, useEffect, useMemo, useRef } from 'react'
import { APIProvider, Map3D, MapMode } from '@vis.gl/react-google-maps'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

/** Hero point of view — Africa / Europe centred, sphere filling the upper fold. */
const LANDING_VIEW_CENTER = { lat: 24, lng: 12, altitude: 0 }

/** Tuned with `.landing-google-globe--elevated` so Map3D fills the fold */
const RANGE_INTRO_FROM_M = 34_000_000
const RANGE_INTRO_TO_M = 18_200_000
const LANDING_TILT = 46
const INTRO_MS = 2600
/** Brief settle after pointer-up so Map3D inertia can finish before spin resumes */
const RESUME_AFTER_RELEASE_MS = 450
/** Degrees per animation frame while idle-spinning */
const SPIN_DEG_PER_FRAME = 0.09

class LandingGlobeErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="landing-globe-demo landing-globe-demo--immersive landing-google-globe--elevated flex items-center justify-center"
          role="alert"
        >
          <div className="landing-globe-demo--immersive__host flex flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/75">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Preview unavailable</p>
            <p>The 3D map could not load. Check the console and your Google Maps key (Maps JavaScript API + Map Tiles API / 3D).</p>
            <pre className="max-w-md overflow-auto rounded border border-white/10 bg-black/40 p-2 text-left text-[10px] text-red-200/90">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function InnerLandingMap() {
  const viewCenter = useMemo(() => LANDING_VIEW_CENTER, [])

  const map3dRef = useRef(null)
  const cameraRef = useRef({
    center: viewCenter,
    range: RANGE_INTRO_TO_M,
    heading: 0,
    tilt: LANDING_TILT,
    roll: 0,
  })
  const readyRef = useRef(false)
  const introStartedRef = useRef(false)
  const introDoneRef = useRef(false)
  const idleTimerRef = useRef(null)
  /** False until intro finishes; then true while idle, false while user is dragging */
  const idleSpinGateRef = useRef(false)
  const userGesturingRef = useRef(false)
  const activePointersRef = useRef(0)
  const spinRafRef = useRef(null)
  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const pauseSpin = useCallback(() => {
    idleSpinGateRef.current = false
    clearTimeout(idleTimerRef.current)
  }, [])

  const resumeSpinSoon = useCallback(() => {
    if (reduceMotion || !introDoneRef.current) return
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (!userGesturingRef.current) idleSpinGateRef.current = true
    }, RESUME_AFTER_RELEASE_MS)
  }, [reduceMotion])

  const handleCameraChanged = useCallback((ev) => {
    const d = ev.detail
    if (d.center) cameraRef.current.center = d.center
    if (typeof d.range === 'number') cameraRef.current.range = d.range
    if (typeof d.heading === 'number') cameraRef.current.heading = d.heading
    if (typeof d.tilt === 'number') cameraRef.current.tilt = d.tilt
    // Do not pause spin here — our own heading writes fire camera events and would
    // immediately cancel auto-rotate. Gestures pause via pointer/wheel handlers.
  }, [])

  const enableIdleSpin = useCallback(() => {
    introDoneRef.current = true
    if (reduceMotion || userGesturingRef.current) return
    idleSpinGateRef.current = true
  }, [reduceMotion])

  const runIntro = useCallback(() => {
    if (introStartedRef.current) return
    const map = map3dRef.current
    if (!map?.flyCameraTo) return
    introStartedRef.current = true
    const center = viewCenter

    if (reduceMotion) {
      map.flyCameraTo({
        endCamera: {
          center,
          range: RANGE_INTRO_TO_M,
          heading: 0,
          tilt: LANDING_TILT,
          roll: 0,
        },
        durationMillis: 0,
      })
      enableIdleSpin()
      return
    }

    pauseSpin()
    map.flyCameraTo({
      endCamera: {
        center,
        range: RANGE_INTRO_FROM_M,
        heading: 0,
        tilt: LANDING_TILT,
        roll: 0,
      },
      durationMillis: 0,
    })
    requestAnimationFrame(() => {
      map3dRef.current?.flyCameraTo?.({
        endCamera: {
          center,
          range: RANGE_INTRO_TO_M,
          heading: 0,
          tilt: LANDING_TILT,
          roll: 0,
        },
        durationMillis: INTRO_MS,
      })
    })
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(enableIdleSpin, INTRO_MS + 120)
  }, [enableIdleSpin, pauseSpin, reduceMotion, viewCenter])

  const finalizeReady = useCallback(() => {
    if (readyRef.current) return
    readyRef.current = true
    if (map3dRef.current?.flyCameraTo) runIntro()
    else enableIdleSpin()
  }, [enableIdleSpin, runIntro])

  const onFirstSteady = useCallback(
    (ev) => {
      if (!ev.detail?.isSteady) return
      finalizeReady()
    },
    [finalizeReady],
  )

  useEffect(() => {
    const t = setTimeout(() => finalizeReady(), 5000)
    return () => clearTimeout(t)
  }, [finalizeReady])

  // <gmp-map-3d> is focusable by default, which lands keyboard users on a
  // decorative background map before the nav — with no focus ring, and with
  // arrow keys panning instead of scrolling. The element mounts asynchronously,
  // so poll briefly for it. Pointer orbit is unaffected.
  useEffect(() => {
    const id = setInterval(() => {
      const el = map3dRef.current?.map3d
      if (!el) return
      el.tabIndex = -1
      clearInterval(id)
    }, 200)
    const stop = setTimeout(() => clearInterval(id), 15000)
    return () => {
      clearInterval(id)
      clearTimeout(stop)
    }
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const spin = () => {
      if (
        idleSpinGateRef.current &&
        !userGesturingRef.current &&
        map3dRef.current?.map3d
      ) {
        const el = map3dRef.current.map3d
        const h = Number(el.heading) || 0
        el.heading = (h + SPIN_DEG_PER_FRAME) % 360
      }
      spinRafRef.current = requestAnimationFrame(spin)
    }
    spinRafRef.current = requestAnimationFrame(spin)
    return () => {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current)
      clearTimeout(idleTimerRef.current)
    }
  }, [reduceMotion])

  return (
    <div
      className="absolute inset-0 z-0"
      style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={(e) => {
        activePointersRef.current += 1
        userGesturingRef.current = true
        pauseSpin()
        e.currentTarget.style.cursor = 'grabbing'
      }}
      onPointerUp={(e) => {
        activePointersRef.current = Math.max(0, activePointersRef.current - 1)
        if (activePointersRef.current === 0) {
          userGesturingRef.current = false
          e.currentTarget.style.cursor = 'grab'
          resumeSpinSoon()
        }
      }}
      onPointerCancel={(e) => {
        activePointersRef.current = Math.max(0, activePointersRef.current - 1)
        if (activePointersRef.current === 0) {
          userGesturingRef.current = false
          e.currentTarget.style.cursor = 'grab'
          resumeSpinSoon()
        }
      }}
      onPointerLeave={() => {
        // If drag ends outside the element, still resume
        if (activePointersRef.current > 0) {
          activePointersRef.current = 0
          userGesturingRef.current = false
          resumeSpinSoon()
        }
      }}
      onWheel={() => {
        userGesturingRef.current = true
        pauseSpin()
        clearTimeout(idleTimerRef.current)
        idleTimerRef.current = setTimeout(() => {
          userGesturingRef.current = false
          resumeSpinSoon()
        }, 400)
      }}
    >
      <Map3D
        ref={map3dRef}
        mode={MapMode.HYBRID}
        defaultUIHidden
        // Suppress Google's baked-in POI dots / labels on the 3D tile layer
        // for a clean, label-free hero backdrop.
        defaultLabelsDisabled
        defaultCenter={viewCenter}
        defaultRange={reduceMotion ? RANGE_INTRO_TO_M : RANGE_INTRO_FROM_M}
        defaultTilt={LANDING_TILT}
        defaultHeading={0}
        minAltitude={80}
        maxAltitude={42_000_000}
        gestureHandling="GREEDY"
        onCameraChanged={handleCameraChanged}
        onSteadyChange={onFirstSteady}
      />
    </div>
  )
}

export default function LandingGoogleGlobe() {
  if (!GOOGLE_API_KEY) {
    return (
      <div
        className="landing-globe-demo landing-globe-demo--immersive landing-google-globe--elevated"
        aria-label="ATLAS marketing globe preview"
      >
        <div className="landing-globe-demo--immersive__host flex items-center justify-center px-6 text-center text-sm text-white/65">
          Add <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_GOOGLE_MAPS_API_KEY</code> to enable
          the photorealistic 3D globe on this page (Maps JavaScript API + 3D / Map Tiles).
        </div>
      </div>
    )
  }

  return (
    <div
      className="landing-globe-demo landing-globe-demo--immersive landing-google-globe--elevated"
      aria-label="Interactive photorealistic 3D globe: drag to orbit"
    >
      <div className="landing-globe-demo--immersive__host relative min-h-0">
        <div className="absolute inset-0 min-h-[100dvh] min-w-0">
          <APIProvider
            apiKey={GOOGLE_API_KEY}
            version="weekly"
            libraries={['maps3d']}
            language="en-US"
            region="US"
          >
            <LandingGlobeErrorBoundary>
              <InnerLandingMap />
            </LandingGlobeErrorBoundary>
          </APIProvider>
        </div>
      </div>
    </div>
  )
}
