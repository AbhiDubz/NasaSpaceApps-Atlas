import { useEffect, useRef, useState } from 'react'
import Globe from 'globe.gl'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { ybpToMa } from '../core/timeScale'
import { buildKeyframeIndex, nearestFrameIndex } from '../core/keyframeIndex'
import {
  applyColorMap,
  createGlobeTextureStreamer,
} from '../../services/earthHistory/globeTextureStreamer'
import {
  fetchPaleocoastlines,
  quantizeCoastlineAgeMa,
} from '../../services/earthHistory/fetchPaleocoastlines'
import {
  fetchPbdbLife,
  quantizePbdbAgeMa,
} from '../../services/earthHistory/fetchPbdbLife'
import { buildDensityGrid } from '../core/densityGrid'
import {
  fetchMacrostratGeology,
  quantizeMacrostratAgeMa,
} from '../../services/earthHistory/fetchMacrostratGeology'
import { fetchCivilizationPlaces } from '../core/civilizationPlaces'
import {
  fetchNeotomaSites,
  quantizeNeotomaAgeMa,
} from '../../services/earthHistory/fetchNeotomaSites'
import { fetchPolityMosaic } from '../../services/earthHistory/fetchPolityMosaic'
import { fetchHistoricalMarkers } from '../../services/earthHistory/fetchHistoricalMarkers'
import { eventsWithLocation } from '../core/eventsCatalog'

/**
 * NASA SVS "An Elsewhere Starfield" (SVS 4856) — randomized Tycho-2 / Gaia.
 * 8K equirectangular for desktop; 4K on small/touch screens for load cost.
 */
const BG_IMG_HD = '/starfield/starmap_random_2020_8k.jpg'
const BG_IMG_MOBILE = '/starfield/starmap_random_2020_4k.jpg'
const EARTH_DAY = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_BUMP = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png'
const CROSSFADE_MS = 150
/** Quiet time after the playhead stops before upgrading to full-res + relief. */
const SETTLE_MS = 140
/** Frames fetched ahead of / behind the playhead in its direction of travel. */
const PREFETCH_AHEAD = 10
const PREFETCH_BEHIND = 3
/** Every Nth frame is fetched in the background so a first drag is never empty. */
const LADDER_STRIDE = 4
/** How far to look for an already-decoded frame to show mid-drag. */
const SUBSTITUTE_RADIUS = 10
const COASTLINE_DEBOUNCE_MS = 450
const COASTLINE_AUTOPLAY_DEBOUNCE_MS = 1600
const LIFE_DEBOUNCE_MS = 550
const LIFE_AUTOPLAY_DEBOUNCE_MS = 2000
const GEOLOGY_DEBOUNCE_MS = 600
const GEOLOGY_AUTOPLAY_DEBOUNCE_MS = 1800
const NEOTOMA_DEBOUNCE_MS = 650
const NEOTOMA_AUTOPLAY_DEBOUNCE_MS = 2000
const CIV_DEBOUNCE_MS = 200
const POLITY_DEBOUNCE_MS = 280
const POLITY_AUTOPLAY_DEBOUNCE_MS = 1200
const MARKER_DEBOUNCE_MS = 320
const MARKER_AUTOPLAY_DEBOUNCE_MS = 1400
/** Use modern Blue Marble + bump when playhead is younger than this (Ma). */
const PRESENT_BASEMAP_MAX_MA = 0.05

const RING_KIND_COLOR = {
  extinction: 'rgba(232, 100, 90, 0.75)',
  geology: 'rgba(240, 200, 120, 0.7)',
  life: 'rgba(140, 220, 180, 0.65)',
  civilization: 'rgba(180, 200, 255, 0.7)',
}

function eventRingWindowMa(ageMa) {
  if (ageMa > 100) return 25
  if (ageMa > 10) return 8
  if (ageMa > 1) return 0.5
  return 0.05
}

function prefersMobileTexture() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768 || 'ontouchstart' in window
}

/** Prefer 8K starfield when the GPU can sample it; else 4K. */
function starfieldBackgroundUrl() {
  if (prefersMobileTexture()) return BG_IMG_MOBILE
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const max = gl?.getParameter(gl.MAX_TEXTURE_SIZE) ?? 0
    if (max > 0 && max < 8192) return BG_IMG_MOBILE
  } catch {
    /* ignore */
  }
  return BG_IMG_HD
}

export default function EarthHistoryGlobe({ onReady }) {
  const containerRef = useRef(null)
  const fadeRef = useRef(null)
  const globeRef = useRef(null)
  const streamerRef = useRef(null)
  const lastUrlRef = useRef('')
  const fadeTimerRef = useRef(0)
  const texturePendingRef = useRef(false)
  const activeTextureIdRef = useRef('')
  const coastAbortRef = useRef(null)
  const lifeAbortRef = useRef(null)
  const geologyAbortRef = useRef(null)
  const neotomaAbortRef = useRef(null)
  const polityAbortRef = useRef(null)
  const markerAbortRef = useRef(null)
  const remountKey = useRef(0)
  const [webglEpoch, setWebglEpoch] = useState(0)

  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const rangeStartYbp = useEarthHistoryStore((s) => s.rangeStartYbp)
  const rangeEndYbp = useEarthHistoryStore((s) => s.rangeEndYbp)
  const scrubbing = useEarthHistoryStore((s) => s.scrubbing)
  const autoplay = useEarthHistoryStore((s) => s.autoplay)
  const tourPlaying = useEarthHistoryStore((s) => s.tourPlaying)
  const manifest = useEarthHistoryStore((s) => s.manifest)
  const camera = useEarthHistoryStore((s) => s.camera)
  const reducedMotion = useEarthHistoryStore((s) => s.reducedMotion)
  const layers = useEarthHistoryStore((s) => s.layers)
  const coastlineFeatures = useEarthHistoryStore((s) => s.coastlineFeatures)
  const lifePoints = useEarthHistoryStore((s) => s.lifePoints)
  const lifeTaxonBaseName = useEarthHistoryStore((s) => s.lifeTaxonBaseName)
  const lifeLimit = useEarthHistoryStore((s) => s.lifeLimit)
  const densityMode = useEarthHistoryStore((s) => s.densityMode)
  const geologyFeatures = useEarthHistoryStore((s) => s.geologyFeatures)
  const civilizationPoints = useEarthHistoryStore((s) => s.civilizationPoints)
  const polityFeatures = useEarthHistoryStore((s) => s.polityFeatures)
  const polityLabels = useEarthHistoryStore((s) => s.polityLabels)
  const polityDimension = useEarthHistoryStore((s) => s.polityDimension)
  const neotomaPoints = useEarthHistoryStore((s) => s.neotomaPoints)
  const markerPoints = useEarthHistoryStore((s) => s.markerPoints)
  const setActiveTextureId = useEarthHistoryStore((s) => s.setActiveTextureId)
  const setTexturePending = useEarthHistoryStore((s) => s.setTexturePending)
  const setCamera = useEarthHistoryStore((s) => s.setCamera)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)
  const setCoastlineLoading = useEarthHistoryStore((s) => s.setCoastlineLoading)
  const setCoastlineResult = useEarthHistoryStore((s) => s.setCoastlineResult)
  const setLifeLoading = useEarthHistoryStore((s) => s.setLifeLoading)
  const setLifeResult = useEarthHistoryStore((s) => s.setLifeResult)
  const setGeologyLoading = useEarthHistoryStore((s) => s.setGeologyLoading)
  const setGeologyResult = useEarthHistoryStore((s) => s.setGeologyResult)
  const setCivilizationResult = useEarthHistoryStore((s) => s.setCivilizationResult)
  const setPolityLoading = useEarthHistoryStore((s) => s.setPolityLoading)
  const setPolityResult = useEarthHistoryStore((s) => s.setPolityResult)
  const setNeotomaLoading = useEarthHistoryStore((s) => s.setNeotomaLoading)
  const setNeotomaResult = useEarthHistoryStore((s) => s.setNeotomaResult)
  const setMarkerLoading = useEarthHistoryStore((s) => s.setMarkerLoading)
  const setMarkerResult = useEarthHistoryStore((s) => s.setMarkerResult)
  const setSelectedOverlay = useEarthHistoryStore((s) => s.setSelectedOverlay)

  // Init / remount globe
  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const globe = Globe()(el)
      .backgroundImageUrl(starfieldBackgroundUrl())
      .showGlobe(true)
      .showAtmosphere(true)
      .atmosphereColor('#9ec8e8')
      .atmosphereAltitude(0.18)
      .globeImageUrl(null)
      .bumpImageUrl(null)
      .polygonsData([])
      .polygonGeoJsonGeometry('geometry')
      .polygonAltitude((d) => {
        const kind = d?.__ehKind || d?.properties?.__ehKind
        if (kind === 'polity') return 0.009
        if (kind === 'geology') return 0.007
        return 0.004
      })
      .polygonCapColor((d) =>
        d?.properties?.__ehCap ||
        (d?.__ehKind === 'geology' ? 'rgba(160, 140, 100, 0.38)' : 'rgba(120, 190, 220, 0.1)'),
      )
      .polygonSideColor(() => 'rgba(0, 0, 0, 0)')
      .polygonStrokeColor((d) =>
        d?.properties?.__ehStroke ||
        (d?.__ehKind === 'geology' ? 'rgba(210, 190, 140, 0.55)' : 'rgba(200, 240, 255, 0.88)'),
      )
      .polygonsTransitionDuration(reducedMotion ? 0 : 280)
      .polygonLabel((d) => {
        const name = d?.properties?.name
        return name ? `<div class="eh-globe-tip">${name}</div>` : null
      })
      .onPolygonClick((d) => {
        if (!d?.properties?.name) return
        const wiki = d.properties.wikipedia || d.properties.wiki || ''
        setSelectedOverlay({
          kind: 'polity',
          name: d.properties.name,
          wiki,
          summary:
            d.properties.fromYear != null
              ? `${d.properties.fromYear}–${d.properties.toYear}`
              : d.properties.ruler || '',
          meta: d.properties,
        })
      })
      .pointsData([])
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude((d) => d.altitude ?? 0.014)
      .pointRadius((d) => d.radius ?? 0.32)
      .pointColor((d) => d.color || 'rgba(226, 232, 240, 0.8)')
      .pointsMerge(true)
      .pointsTransitionDuration(reducedMotion ? 0 : 240)
      .pointLabel((d) =>
        d?.name ? `<div class="eh-globe-tip">${d.name}</div>` : null,
      )
      .onPointClick((d) => {
        if (!d?.name) return
        if (d.__ehKind === 'density') {
          setSelectedOverlay({
            kind: 'density',
            name: d.name,
            summary: `${d.count || 0} localities in this cell`,
            meta: d,
          })
          return
        }
        setSelectedOverlay({
          kind: d.__ehKind || 'place',
          name: d.name,
          wiki: d.wiki || d.wikipedia || '',
          summary: d.summary || '',
          collectionNo: d.collectionNo || null,
          meta: d,
        })
      })
      .ringsData([])
      .ringLat('lat')
      .ringLng('lng')
      .ringColor((d) => d.color || 'rgba(240, 200, 120, 0.65)')
      .ringMaxRadius((d) => d.maxR ?? 4)
      .ringPropagationSpeed((d) => (reducedMotion ? 0 : d.speed ?? 1.2))
      .ringRepeatPeriod((d) => (reducedMotion ? 0 : d.period ?? 1400))
      .labelsData([])
      .labelLat('lat')
      .labelLng('lng')
      .labelText('name')
      .labelColor((d) => d.color || 'rgba(255, 236, 200, 0.92)')
      .labelAltitude(0.012)
      .labelSize((d) => d.size ?? 0.55)
      .labelDotRadius(0)
      .labelResolution(2)

    globe.controls().autoRotate = false
    globe.controls().enableDamping = true
    globe.pointOfView(
      { lat: camera.lat, lng: camera.lng, altitude: camera.altitude },
      0,
    )

    const onResize = () => {
      globe.width(el.clientWidth)
      globe.height(el.clientHeight)
    }
    onResize()
    window.addEventListener('resize', onResize)

    const canvas = el.querySelector('canvas')
    const onContextLost = (e) => {
      e.preventDefault()
      remountKey.current += 1
      setWebglEpoch((n) => n + 1)
    }
    canvas?.addEventListener('webglcontextlost', onContextLost, false)

    globeRef.current = globe
    streamerRef.current = createGlobeTextureStreamer()
    streamerRef.current.setRenderer(globe.renderer?.() || null)
    onReady?.()

    let povTimer = 0
    const onControlsChange = () => {
      window.clearTimeout(povTimer)
      povTimer = window.setTimeout(() => {
        const pov = globe.pointOfView()
        setCamera({ lat: pov.lat, lng: pov.lng, altitude: pov.altitude })
        syncUrl()
      }, 400)
    }
    globe.controls().addEventListener('change', onControlsChange)

    return () => {
      window.clearTimeout(povTimer)
      window.clearTimeout(fadeTimerRef.current)
      coastAbortRef.current?.abort()
      lifeAbortRef.current?.abort()
      geologyAbortRef.current?.abort()
      neotomaAbortRef.current?.abort()
      polityAbortRef.current?.abort()
      markerAbortRef.current?.abort()
      window.removeEventListener('resize', onResize)
      canvas?.removeEventListener('webglcontextlost', onContextLost)
      globe.controls().removeEventListener('change', onControlsChange)
      try {
        globe._destructor?.()
      } catch {
        /* ignore */
      }
      globeRef.current = null
      el.replaceChildren()
      streamerRef.current?.dispose()
      streamerRef.current = null
      lastUrlRef.current = ''
    }
    // remount on webglEpoch only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webglEpoch])

  // Basemap streaming. Runs on its own animation frame rather than a React effect
  // per playhead value, so the picture tracks the scrubber continuously instead of
  // waiting on a render, a debounce, or a network round trip.
  useEffect(() => {
    const globe = globeRef.current
    const streamer = streamerRef.current
    const frames = manifest?.frames
    if (!globe || !streamer || !frames?.length) return undefined

    const index = buildKeyframeIndex(frames)
    const lastIdx = index.frames.length - 1
    const smallScreen = prefersMobileTexture()

    const colorUrl = (frame, lowRes) =>
      ((lowRes || smallScreen) && frame.textureMobile) || frame.texture
    const reliefUrl = (frame) =>
      (smallScreen && frame.reliefMobile) || frame.relief || frame.textureRelief || null
    const modernRelief = smallScreen ? null : EARTH_BUMP

    let raf = 0
    let alive = true
    let frameIdx = -1
    /** +1 toward the present, -1 toward deep time. */
    let direction = 1
    let lastPlayhead = Number.NaN
    let lastMoveAt = 0
    let appliedRelief
    let awaitingUrl = ''
    let lastPrefetchKey = ''
    /** Frames whose bytes never arrived; retrying them would spin the loop. */
    const unavailable = new Set()

    function publishPending(v) {
      if (texturePendingRef.current === v) return
      texturePendingRef.current = v
      setTexturePending(v)
    }

    function publishTextureId(id) {
      if (activeTextureIdRef.current === id) return
      activeTextureIdRef.current = id
      setActiveTextureId(id)
    }

    /** Veil the swap for discrete jumps; a drag reads better as hard cuts. */
    function veil(prevUrl) {
      const fadeEl = fadeRef.current
      if (!fadeEl || !prevUrl || useEarthHistoryStore.getState().reducedMotion) return
      fadeEl.style.backgroundImage = `url("${prevUrl}")`
      fadeEl.style.opacity = '0.55'
      window.clearTimeout(fadeTimerRef.current)
      requestAnimationFrame(() => {
        fadeEl.style.transition = `opacity ${CROSSFADE_MS}ms ease`
        fadeEl.style.opacity = '0'
        fadeTimerRef.current = window.setTimeout(() => {
          fadeEl.style.backgroundImage = ''
          fadeEl.style.transition = ''
        }, CROSSFADE_MS + 20)
      })
    }

    function show(url, texture, { fade }) {
      const prev = lastUrlRef.current
      if (!applyColorMap(globe.globeMaterial(), texture)) return
      lastUrlRef.current = url
      streamer.pin([url])
      if (fade && prev && prev !== url) veil(prev)
    }

    /** Closest already-decoded frame, preferring the side already travelled. */
    function substituteUrl(idx, lowRes) {
      for (let d = 1; d <= SUBSTITUTE_RADIUS; d += 1) {
        const behind = idx - direction * d
        const ahead = idx + direction * d
        for (const j of [behind, ahead]) {
          if (j < 0 || j > lastIdx) continue
          const url = colorUrl(index.frames[j], lowRes)
          if (streamer.has(url)) return url
        }
      }
      return ''
    }

    function prefetch(idx, moving) {
      const key = `${idx}:${direction}:${moving ? 1 : 0}`
      if (key === lastPrefetchKey) return
      lastPrefetchKey = key

      // Once stopped, the sharpened basemap and its relief are the only things
      // worth bandwidth; competing fetches just delay them. Neighbours were
      // already warmed on the way here.
      if (!moving) {
        const relief = reliefUrl(index.frames[idx])
        streamer.warm(relief ? [relief] : [])
        return
      }

      // Scrub resolution only: full-res neighbours would cost roughly three times
      // the bandwidth for pixels that are never on screen long enough to read.
      const urls = []
      for (let d = 0; d <= PREFETCH_AHEAD; d += 1) {
        const j = idx + direction * d
        if (j >= 0 && j <= lastIdx) urls.push(colorUrl(index.frames[j], true))
      }
      for (let d = 1; d <= PREFETCH_BEHIND; d += 1) {
        const j = idx - direction * d
        if (j >= 0 && j <= lastIdx) urls.push(colorUrl(index.frames[j], true))
      }
      streamer.warm(urls)

      // Decoding costs a GPU upload, so only pay it for the very next hop.
      const next = idx + direction
      if (next >= 0 && next <= lastIdx) streamer.ensure(colorUrl(index.frames[next], true))
    }

    function kick() {
      if (!alive || raf) return
      raf = requestAnimationFrame(step)
    }

    function step() {
      raf = 0
      if (!alive) return

      const st = useEarthHistoryStore.getState()
      const now = performance.now()
      if (st.playheadYbp !== lastPlayhead) {
        lastPlayhead = st.playheadYbp
        lastMoveAt = now
      }
      const moving =
        st.scrubbing || st.autoplay || st.tourPlaying || now - lastMoveAt < SETTLE_MS

      const ageMa = ybpToMa(st.playheadYbp)
      const useModern = ageMa <= PRESENT_BASEMAP_MAX_MA
      const idx = nearestFrameIndex(index, ageMa)
      if (frameIdx >= 0 && idx !== frameIdx) direction = idx > frameIdx ? 1 : -1
      frameIdx = idx
      const frame = index.frames[idx]

      // Half-resolution while the playhead moves; sharpen once it stops.
      const lowRes = moving && !useModern
      const targetUrl = useModern ? EARTH_DAY : colorUrl(frame, lowRes)
      publishTextureId(useModern ? 'modern-basemap' : frame.id)

      const targetTex = streamer.peek(targetUrl)
      if (targetTex) {
        awaitingUrl = ''
        show(targetUrl, targetTex, { fade: !moving })
        publishPending(false)
      } else {
        if (awaitingUrl !== targetUrl && !unavailable.has(targetUrl)) {
          awaitingUrl = targetUrl
          streamer.ensure(targetUrl).then(
            (tex) => {
              if (!tex) unavailable.add(targetUrl)
              kick()
            },
            () => {
              unavailable.add(targetUrl)
              kick()
            },
          )
        }
        publishPending(!unavailable.has(targetUrl))
        // Rather than freeze on the last frame, step to the closest one we can draw.
        if (moving && !useModern) {
          const alt = substituteUrl(idx, lowRes)
          const altTex = alt ? streamer.peek(alt) : null
          if (altTex) show(alt, altTex, { fade: false })
        }
      }

      if (!useModern) prefetch(idx, moving)

      const showingTarget = lastUrlRef.current === targetUrl || unavailable.has(targetUrl)
      const desiredRelief = useModern ? modernRelief : reliefUrl(frame)
      // Relief costs a second texture load and is invisible mid-drag.
      if (!moving && showingTarget && desiredRelief !== appliedRelief) {
        appliedRelief = desiredRelief
        try {
          globe.bumpImageUrl(desiredRelief)
        } catch {
          /* bump is decorative */
        }
      }

      if (moving || !showingTarget || appliedRelief !== desiredRelief) kick()
    }

    const unsubscribe = useEarthHistoryStore.subscribe((s, prev) => {
      if (
        s.playheadYbp !== prev.playheadYbp ||
        s.scrubbing !== prev.scrubbing ||
        s.autoplay !== prev.autoplay ||
        s.tourPlaying !== prev.tourPlaying
      ) {
        kick()
      }
    })
    const unwatch = streamer.onFrameReady(kick)

    // Coarse pass over the whole timeline so the first drag always has something
    // to draw at any age, then the directional window fills in the detail.
    if (!navigator.connection?.saveData) {
      const ladder = []
      for (let i = 0; i <= lastIdx; i += LADDER_STRIDE) {
        ladder.push(colorUrl(index.frames[i], true))
      }
      streamer.warmIdle(ladder)
    }

    kick()

    return () => {
      alive = false
      if (raf) cancelAnimationFrame(raf)
      unsubscribe()
      unwatch()
    }
  }, [manifest, webglEpoch, setActiveTextureId, setTexturePending])

  // GWS paleocoastlines — debounced, never per-frame while dragging
  useEffect(() => {
    if (!layers.coastlines) {
      setCoastlineResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const ageMa = ybpToMa(playheadYbp)
    const q = quantizeCoastlineAgeMa(ageMa)
    const delay =
      autoplay || tourPlaying ? COASTLINE_AUTOPLAY_DEBOUNCE_MS : COASTLINE_DEBOUNCE_MS

    const timer = window.setTimeout(() => {
      coastAbortRef.current?.abort()
      const ac = new AbortController()
      coastAbortRef.current = ac
      setCoastlineLoading(q)
      fetchPaleocoastlines(q, { signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return
          setCoastlineResult(result)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setCoastlineResult({ ok: false, reason: err.message || 'Coastline fetch failed.', ageMa: q })
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    playheadYbp,
    scrubbing,
    autoplay,
    tourPlaying,
    layers.coastlines,
    setCoastlineLoading,
    setCoastlineResult,
  ])

  // Push coastline + geology + polity polygons to globe
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const polys = []
    if (layers.coastlines) {
      for (const f of coastlineFeatures) {
        polys.push({
          ...f,
          __ehKind: 'coast',
          properties: {
            ...(f.properties || {}),
            __ehKind: 'coast',
            __ehCap: 'rgba(120, 190, 220, 0.1)',
            __ehStroke: 'rgba(200, 240, 255, 0.88)',
          },
        })
      }
    }
    if (layers.geology) {
      for (const f of geologyFeatures) polys.push(f)
    }
    if (layers.civilization) {
      for (const f of polityFeatures) polys.push(f)
    }
    globe.polygonsData(polys)
  }, [
    coastlineFeatures,
    geologyFeatures,
    polityFeatures,
    layers.coastlines,
    layers.geology,
    layers.civilization,
    webglEpoch,
  ])

  // Polity labels (zoom-aware density)
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    if (!layers.civilization || !polityLabels?.length) {
      globe.labelsData([])
      return
    }
    const alt = camera?.altitude ?? 2.35
    const boost = densityMode ? 1.6 : 1
    const maxLabels = Math.round((alt > 2.8 ? 6 : alt > 1.8 ? 12 : 18) * boost)
    const items = polityLabels.slice(0, maxLabels).map((l, i) => ({
      ...l,
      size: i < 4 ? 0.72 : 0.48,
    }))
    globe.labelsData(items)
  }, [polityLabels, layers.civilization, camera?.altitude, densityMode, webglEpoch])

  // Impact / LIP rings near playhead
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    if (!layers.events) {
      globe.ringsData([])
      return
    }
    // Rebuilding ring meshes every drag frame competes with the basemap swap.
    if (scrubbing) return
    const ageMa = ybpToMa(playheadYbp)
    const half = eventRingWindowMa(ageMa)
    const located = eventsWithLocation(
      { startYbp: rangeStartYbp, endYbp: rangeEndYbp },
      { playheadYbp, halfWindowMa: half },
    )
    const rings = located.map((e) => ({
      lat: e.lat,
      lng: e.lng,
      color: RING_KIND_COLOR[e.kind] || RING_KIND_COLOR.geology,
      maxR: e.kind === 'extinction' ? 6 : e.kind === 'geology' ? 5 : 3.5,
      speed: reducedMotion ? 0 : 1.1,
      period: reducedMotion ? 0 : 1600,
      name: e.name,
      id: e.id,
    }))
    globe.ringsData(rings)
  }, [
    playheadYbp,
    rangeStartYbp,
    rangeEndYbp,
    layers.events,
    reducedMotion,
    scrubbing,
    webglEpoch,
  ])

  // PBDB life occurrences — debounced after scrub
  useEffect(() => {
    if (!layers.life) {
      setLifeResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const ageMa = ybpToMa(playheadYbp)
    const q = quantizePbdbAgeMa(ageMa)
    const baseName = lifeTaxonBaseName || null
    const delay = autoplay || tourPlaying ? LIFE_AUTOPLAY_DEBOUNCE_MS : LIFE_DEBOUNCE_MS

    const timer = window.setTimeout(() => {
      lifeAbortRef.current?.abort()
      const ac = new AbortController()
      lifeAbortRef.current = ac
      setLifeLoading(q)
      fetchPbdbLife(q, { signal: ac.signal, baseName, limit: lifeLimit })
        .then((result) => {
          if (ac.signal.aborted) return
          setLifeResult(result)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setLifeResult({ ok: false, reason: err.message || 'Life overlay fetch failed.', ageMa: q })
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    playheadYbp,
    scrubbing,
    autoplay,
    tourPlaying,
    layers.life,
    lifeTaxonBaseName,
    lifeLimit,
    setLifeLoading,
    setLifeResult,
  ])

  // Macrostrat geology columns
  useEffect(() => {
    if (!layers.geology) {
      setGeologyResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const ageMa = ybpToMa(playheadYbp)
    const q = quantizeMacrostratAgeMa(ageMa)
    const delay = autoplay || tourPlaying ? GEOLOGY_AUTOPLAY_DEBOUNCE_MS : GEOLOGY_DEBOUNCE_MS

    const timer = window.setTimeout(() => {
      geologyAbortRef.current?.abort()
      const ac = new AbortController()
      geologyAbortRef.current = ac
      setGeologyLoading(q)
      fetchMacrostratGeology(q, { signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return
          setGeologyResult(result)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setGeologyResult({
            ok: false,
            reason: err.message || 'Geology overlay fetch failed.',
            ageMa: q,
          })
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    playheadYbp,
    scrubbing,
    autoplay,
    tourPlaying,
    layers.geology,
    setGeologyLoading,
    setGeologyResult,
  ])

  // Civilization places (curated, sync)
  useEffect(() => {
    if (!layers.civilization) {
      setCivilizationResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const timer = window.setTimeout(() => {
      setCivilizationResult(fetchCivilizationPlaces(playheadYbp))
    }, CIV_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [playheadYbp, scrubbing, layers.civilization, setCivilizationResult])

  // Cliopatria polity polygons (mosaic join when available)
  useEffect(() => {
    if (!layers.civilization) {
      setPolityResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const delay = autoplay || tourPlaying ? POLITY_AUTOPLAY_DEBOUNCE_MS : POLITY_DEBOUNCE_MS
    const timer = window.setTimeout(() => {
      polityAbortRef.current?.abort()
      const ac = new AbortController()
      polityAbortRef.current = ac
      setPolityLoading(playheadYbp)
      fetchPolityMosaic(playheadYbp, { signal: ac.signal, dimension: polityDimension })
        .then((result) => {
          if (ac.signal.aborted) return
          setPolityResult(result)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setPolityResult({
            ok: false,
            reason: err.message || 'Polity fetch failed.',
            ageYbp: playheadYbp,
          })
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    playheadYbp,
    scrubbing,
    autoplay,
    tourPlaying,
    layers.civilization,
    polityDimension,
    setPolityLoading,
    setPolityResult,
  ])

  // Historical / Wikidata markers
  useEffect(() => {
    const markersOn = layers.markers || layers.civilization
    if (!markersOn) {
      setMarkerResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const delay = autoplay || tourPlaying ? MARKER_AUTOPLAY_DEBOUNCE_MS : MARKER_DEBOUNCE_MS
    const timer = window.setTimeout(() => {
      markerAbortRef.current?.abort()
      const ac = new AbortController()
      markerAbortRef.current = ac
      setMarkerLoading()
      fetchHistoricalMarkers(playheadYbp, { signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return
          setMarkerResult(result)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setMarkerResult({
            ok: false,
            reason: err.message || 'Markers fetch failed.',
            ageYbp: playheadYbp,
          })
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    playheadYbp,
    scrubbing,
    autoplay,
    tourPlaying,
    layers.markers,
    layers.civilization,
    setMarkerLoading,
    setMarkerResult,
  ])

  // Neotoma Quaternary sites
  useEffect(() => {
    if (!layers.neotoma) {
      setNeotomaResult(null)
      return undefined
    }
    if (scrubbing) return undefined

    const ageMa = ybpToMa(playheadYbp)
    const q = quantizeNeotomaAgeMa(ageMa)
    const delay = autoplay || tourPlaying ? NEOTOMA_AUTOPLAY_DEBOUNCE_MS : NEOTOMA_DEBOUNCE_MS

    const timer = window.setTimeout(() => {
      neotomaAbortRef.current?.abort()
      const ac = new AbortController()
      neotomaAbortRef.current = ac
      setNeotomaLoading(q)
      fetchNeotomaSites(q, { signal: ac.signal })
        .then((result) => {
          if (ac.signal.aborted) return
          setNeotomaResult(result)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setNeotomaResult({
            ok: false,
            reason: err.message || 'Neotoma overlay fetch failed.',
            ageMa: q,
          })
        })
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    playheadYbp,
    scrubbing,
    autoplay,
    tourPlaying,
    layers.neotoma,
    setNeotomaLoading,
    setNeotomaResult,
  ])

  // Push merged point overlays to globe
  useEffect(() => {
    const globe = globeRef.current
    if (!globe) return
    const pts = []
    if (layers.life) {
      const alt = camera?.altitude ?? 2.35
      if (densityMode && alt > 0.6) {
        pts.push(...buildDensityGrid(lifePoints, { altitude: alt, maxClusters: 250 }))
      } else {
        pts.push(...lifePoints)
      }
    }
    if (layers.neotoma) pts.push(...neotomaPoints)
    if (layers.civilization) pts.push(...civilizationPoints)
    if (layers.markers || layers.civilization) pts.push(...markerPoints)
    globe.pointsData(pts)
  }, [
    lifePoints,
    neotomaPoints,
    civilizationPoints,
    markerPoints,
    layers.life,
    layers.neotoma,
    layers.civilization,
    layers.markers,
    densityMode,
    camera?.altitude,
    webglEpoch,
  ])

  return (
    <div className="eh-globe-wrap">
      <div className="eh-globe" ref={containerRef} role="img" aria-label="Paleogeography globe" />
      <div className="eh-globe__fade" ref={fadeRef} aria-hidden />
    </div>
  )
}
