import { create } from 'zustand'
import {
  EARTH_BIRTH_YBP,
  clampYbpToRange,
  normalizeYbp,
  validateRange,
} from '../core/timeScale.js'
import { readEarthHistoryUrlState, writeEarthHistoryUrlState } from '../core/urlState.js'
import { getTourById, resolveChapter, tourRangeYbp } from '../core/narrativeTours.js'
import { lifeFilterById } from '../../services/earthHistory/fetchPbdbLife.js'

const DEFAULT_CAMERA = { lat: 10, lng: 20, altitude: 2.35 }

function applyUrlHydration() {
  const url = readEarthHistoryUrlState()
  const rangeStartYbp = url.rangeStartYbp ?? EARTH_BIRTH_YBP
  const rangeEndYbp = url.rangeEndYbp ?? 0
  let playheadYbp = url.playheadYbp ?? maCambrianDefault()
  playheadYbp = clampYbpToRange(playheadYbp, { startYbp: rangeStartYbp, endYbp: rangeEndYbp })
  const patch = {
    playheadYbp,
    rangeStartYbp,
    rangeEndYbp,
    camera: url.camera ?? { ...DEFAULT_CAMERA },
    rangeAdjustedBanner: url.rangeAdjusted,
  }
  if (url.layers) patch.layers = { ...url.layers }
  if (url.lifeTaxonId) {
    const raw = String(url.lifeTaxonId)
    const lower = raw.toLowerCase()
    const byId = lifeFilterById(lower)
    const presetIds = ['chordata', 'mollusca', 'arthropoda', 'brachiopoda', 'plantae', 'dinosauria']
    const baseId = presetIds.find(
      (id) => lifeFilterById(id).baseName?.toLowerCase() === lower,
    )
    const matched = byId.id !== 'all' ? byId : baseId ? lifeFilterById(baseId) : null
    if (matched) {
      patch.lifeTaxonId = matched.id
      patch.lifeTaxonBaseName = matched.baseName
      patch.lifeTaxonLabel = matched.label
    } else if (lower !== 'all') {
      patch.lifeTaxonId = raw
      patch.lifeTaxonBaseName = raw
      patch.lifeTaxonLabel = raw
    }
  }
  if (url.densityBoost != null) patch.densityMode = url.densityBoost
  if (url.polityDimension) patch.polityDimension = url.polityDimension
  if (url.colorblindSafe != null) {
    patch.colorblindSafe = url.colorblindSafe
    applyColorblindDom(url.colorblindSafe)
  }
  return patch
}

function maCambrianDefault() {
  return normalizeYbp(541_000_000)
}

/** Full-range autoplay duration in ms (constant slider-space speed). */
export const AUTOPLAY_DURATION_MS = 48_000

function readColorblindSafe() {
  try {
    return localStorage.getItem('atlas_colorblind') === 'true'
  } catch {
    return false
  }
}

function applyColorblindDom(on) {
  if (typeof document === 'undefined') return
  document.body.setAttribute('data-colorblind', on ? 'true' : 'false')
}

const DEFAULT_LAYERS = {
  events: true,
  coastlines: true,
  life: true,
  geology: false,
  civilization: true,
  neotoma: true,
  markers: true,
}

export const useEarthHistoryStore = create((set, get) => ({
  // Defaults first; URL hydration applied at end of this object.
  scrubbing: false,
  reducedMotion: false,
  autoplay: false,
  timelineDrillRank: 'period',
  colorblindSafe: readColorblindSafe(),
  selectedEventId: null,
  pinnedEventId: null,
  layers: { ...DEFAULT_LAYERS },
  densityMode: false,
  polityDimension: 'ruler',
  markerStatus: 'idle',
  markerYear: null,
  markerMessage: null,
  markerPoints: [],
  markerCount: 0,
  coastlineStatus: 'idle', // idle | loading | ready | unsupported | error
  coastlineSource: null, // local | gws | gws-memory | gws-idb | null
  coastlineAgeMa: null,
  coastlineMessage: null,
  coastlineFeatures: [],
  lifeStatus: 'idle', // idle | loading | ready | unsupported | error
  lifeAgeMa: null,
  lifeMessage: null,
  lifePoints: [],
  lifeCount: 0,
  lifeTaxonId: 'all',
  lifeTaxonBaseName: null,
  lifeTaxonLabel: null,
  lifeLimit: 500,
  diversityBins: [],
  diversityStatus: 'idle', // idle | loading | ready | error
  geologyStatus: 'idle',
  geologyAgeMa: null,
  geologyMessage: null,
  geologyFeatures: [],
  geologyCount: 0,
  civilizationStatus: 'idle',
  civilizationAgeYbp: null,
  civilizationMessage: null,
  civilizationPoints: [],
  civilizationCount: 0,
  polityStatus: 'idle',
  polityYear: null,
  polityMessage: null,
  polityFeatures: [],
  polityLabels: [],
  polityCount: 0,
  selectedOverlay: null,
  neotomaStatus: 'idle',
  neotomaAgeMa: null,
  neotomaMessage: null,
  neotomaPoints: [],
  neotomaCount: 0,
  neotomaSource: null,
  activeTourId: null,
  tourChapterIndex: 0,
  tourPlaying: false,
  tourNote: null,
  manifest: null,
  manifestError: null,
  loadState: 'idle', // idle | loading | ready | error
  erasBlurbs: null,
  activeTextureId: null,
  texturePending: false,
  banner: null,

  hydrateFromUrl: () => {
    set({
      ...applyUrlHydration(),
      autoplay: false,
      tourPlaying: false,
      activeTourId: null,
      tourNote: null,
    })
  },

  setReducedMotion: (v) =>
    set({
      reducedMotion: Boolean(v),
      ...(v ? { autoplay: false, tourPlaying: false } : {}),
    }),

  setTimelineDrillRank: (rank) => {
    const allowed = ['eon', 'era', 'period', 'epoch', 'age']
    set({ timelineDrillRank: allowed.includes(rank) ? rank : 'period' })
  },

  // ---- Chrome panels: at most one open surface at a time ----
  drawerOpen: false,
  drawerTab: 'layers', // 'layers' | 'world'
  timePopoverOpen: false,

  setDrawer: (open, tab) =>
    set({
      drawerOpen: Boolean(open),
      ...(tab ? { drawerTab: tab } : {}),
      ...(open ? { timePopoverOpen: false } : {}),
    }),

  toggleDrawer: (tab) => {
    const s = get()
    const sameTab = !tab || s.drawerTab === tab
    const open = !(s.drawerOpen && sameTab)
    set({
      drawerOpen: open,
      ...(tab ? { drawerTab: tab } : {}),
      ...(open ? { timePopoverOpen: false } : {}),
    })
  },

  setDrawerTab: (drawerTab) => set({ drawerTab }),

  setTimePopoverOpen: (open) =>
    set({
      timePopoverOpen: Boolean(open),
      ...(open ? { drawerOpen: false } : {}),
    }),

  setColorblindSafe: (v) => {
    const on = Boolean(v)
    try {
      localStorage.setItem('atlas_colorblind', on ? 'true' : 'false')
    } catch {
      /* ignore */
    }
    applyColorblindDom(on)
    set({ colorblindSafe: on })
  },

  toggleColorblindSafe: () => {
    get().setColorblindSafe(!get().colorblindSafe)
  },

  setDensityBoost: (v) => set({ densityMode: Boolean(v) }),

  setPolityDimension: (dim) => {
    const allowed = ['ruler', 'religion', 'culture', 'population']
    set({ polityDimension: allowed.includes(dim) ? dim : 'ruler' })
  },

  setPlayheadYbp: (ybp, { scrubbing } = {}) => {
    const { rangeStartYbp, rangeEndYbp } = get()
    const playheadYbp = clampYbpToRange(ybp, { startYbp: rangeStartYbp, endYbp: rangeEndYbp })
    set({
      playheadYbp,
      ...(scrubbing != null ? { scrubbing: Boolean(scrubbing) } : {}),
    })
  },

  setScrubbing: (v) => {
    const scrubbing = Boolean(v)
    set({
      scrubbing,
      ...(scrubbing ? { autoplay: false, tourPlaying: false } : {}),
    })
  },

  autoplaySpeed: 1,

  setAutoplaySpeed: (speed) => {
    const allowed = [0.5, 1, 2]
    set({ autoplaySpeed: allowed.includes(Number(speed)) ? Number(speed) : 1 })
  },

  setAutoplay: (v) => {
    if (get().reducedMotion) {
      set({ autoplay: false })
      return
    }
    const on = Boolean(v)
    set({
      autoplay: on,
      ...(on ? { tourPlaying: false, activeTourId: null, tourNote: null } : {}),
    })
  },

  toggleAutoplay: () => {
    const s = get()
    if (s.reducedMotion) {
      set({ autoplay: false })
      return
    }
    const on = !s.autoplay
    set({
      autoplay: on,
      ...(on ? { tourPlaying: false, activeTourId: null, tourNote: null } : {}),
    })
  },

  setLayer: (key, enabled) => {
    const layers = { ...get().layers, [key]: Boolean(enabled) }
    const patch = { layers }
    if (key === 'coastlines' && !enabled) {
      patch.coastlineFeatures = []
      patch.coastlineStatus = 'idle'
      patch.coastlineMessage = null
    }
    if (key === 'life' && !enabled) {
      patch.lifePoints = []
      patch.lifeCount = 0
      patch.lifeStatus = 'idle'
      patch.lifeMessage = null
    }
    if (key === 'geology' && !enabled) {
      patch.geologyFeatures = []
      patch.geologyCount = 0
      patch.geologyStatus = 'idle'
      patch.geologyMessage = null
    }
    if (key === 'civilization' && !enabled) {
      patch.civilizationPoints = []
      patch.civilizationCount = 0
      patch.civilizationStatus = 'idle'
      patch.civilizationMessage = null
      patch.polityFeatures = []
      patch.polityLabels = []
      patch.polityCount = 0
      patch.polityStatus = 'idle'
      patch.polityMessage = null
      patch.polityYear = null
      patch.selectedOverlay = null
    }
    if (key === 'neotoma' && !enabled) {
      patch.neotomaPoints = []
      patch.neotomaCount = 0
      patch.neotomaStatus = 'idle'
      patch.neotomaMessage = null
      patch.neotomaSource = null
    }
    if (key === 'markers' && !enabled) {
      patch.markerPoints = []
      patch.markerCount = 0
      patch.markerStatus = 'idle'
      patch.markerMessage = null
      patch.markerYear = null
    }
    set(patch)
  },

  toggleLayer: (key) => {
    const cur = Boolean(get().layers[key])
    get().setLayer(key, !cur)
  },

  setCoastlineResult: (result) => {
    if (!result) {
      set({
        coastlineStatus: 'idle',
        coastlineFeatures: [],
        coastlineAgeMa: null,
        coastlineMessage: null,
        coastlineSource: null,
      })
      return
    }
    if (result.ok) {
      set({
        coastlineStatus: 'ready',
        coastlineAgeMa: result.ageMa,
        coastlineFeatures: result.collection.features || [],
        coastlineMessage: null,
        coastlineSource: result.source || 'gws',
      })
      return
    }
    set({
      coastlineStatus: result.reason?.includes('unavailable') ? 'unsupported' : 'error',
      coastlineAgeMa: result.ageMa ?? null,
      coastlineFeatures: [],
      coastlineMessage: result.reason || 'Coastline fetch failed.',
      coastlineSource: null,
    })
  },

  setCoastlineLoading: (ageMa) =>
    set({
      coastlineStatus: 'loading',
      coastlineAgeMa: ageMa,
      coastlineMessage: null,
      coastlineSource: null,
    }),

  setLifeResult: (result) => {
    if (!result) {
      set({
        lifeStatus: 'idle',
        lifePoints: [],
        lifeCount: 0,
        lifeAgeMa: null,
        lifeMessage: null,
      })
      return
    }
    if (result.ok) {
      set({
        lifeStatus: 'ready',
        lifeAgeMa: result.ageMa,
        lifePoints: result.points || [],
        lifeCount: (result.points || []).length,
        lifeMessage: null,
      })
      return
    }
    set({
      lifeStatus: result.reason?.includes('≤') || result.reason?.includes('focuses')
        ? 'unsupported'
        : 'error',
      lifeAgeMa: result.ageMa ?? null,
      lifePoints: [],
      lifeCount: 0,
      lifeMessage: result.reason || 'Life overlay fetch failed.',
    })
  },

  setLifeLoading: (ageMa) =>
    set({
      lifeStatus: 'loading',
      lifeAgeMa: ageMa,
      lifeMessage: null,
    }),

  setGeologyResult: (result) => {
    if (!result) {
      set({
        geologyStatus: 'idle',
        geologyFeatures: [],
        geologyCount: 0,
        geologyAgeMa: null,
        geologyMessage: null,
      })
      return
    }
    if (result.ok) {
      set({
        geologyStatus: 'ready',
        geologyAgeMa: result.ageMa,
        geologyFeatures: result.features || [],
        geologyCount: (result.features || []).length,
        geologyMessage: null,
      })
      return
    }
    set({
      geologyStatus: result.reason?.includes('≤') || result.reason?.includes('focuses')
        ? 'unsupported'
        : 'error',
      geologyAgeMa: result.ageMa ?? null,
      geologyFeatures: [],
      geologyCount: 0,
      geologyMessage: result.reason || 'Geology overlay fetch failed.',
    })
  },

  setGeologyLoading: (ageMa) =>
    set({
      geologyStatus: 'loading',
      geologyAgeMa: ageMa,
      geologyMessage: null,
    }),

  setCivilizationResult: (result) => {
    if (!result) {
      set({
        civilizationStatus: 'idle',
        civilizationPoints: [],
        civilizationCount: 0,
        civilizationAgeYbp: null,
        civilizationMessage: null,
      })
      return
    }
    if (result.ok) {
      set({
        civilizationStatus: 'ready',
        civilizationAgeYbp: result.ageYbp,
        civilizationPoints: result.points || [],
        civilizationCount: result.count ?? (result.points || []).length,
        civilizationMessage: null,
      })
      return
    }
    set({
      civilizationStatus: result.reason?.includes('Holocene') || result.reason?.includes('focuses')
        ? 'unsupported'
        : 'error',
      civilizationAgeYbp: result.ageYbp ?? null,
      civilizationPoints: [],
      civilizationCount: 0,
      civilizationMessage: result.reason || 'Civilization overlay failed.',
    })
  },

  setPolityResult: (result) => {
    if (!result) {
      set({
        polityStatus: 'idle',
        polityFeatures: [],
        polityLabels: [],
        polityCount: 0,
        polityYear: null,
        polityMessage: null,
      })
      return
    }
    if (result.ok) {
      set({
        polityStatus: 'ready',
        polityYear: result.year ?? null,
        polityFeatures: result.features || [],
        polityLabels: result.labels || [],
        polityCount: result.count ?? (result.features || []).length,
        polityMessage: null,
      })
      return
    }
    set({
      polityStatus:
        result.reason?.includes('Holocene') || result.reason?.includes('focuses')
          ? 'unsupported'
          : 'error',
      polityYear: result.year ?? null,
      polityFeatures: [],
      polityLabels: [],
      polityCount: 0,
      polityMessage: result.reason || 'Polity overlay failed.',
    })
  },

  setPolityLoading: (ageYbp) =>
    set({
      polityStatus: 'loading',
      polityMessage: null,
      civilizationAgeYbp: ageYbp ?? get().civilizationAgeYbp,
    }),

  setSelectedOverlay: (selectedOverlay) =>
    set({
      selectedOverlay: selectedOverlay || null,
      // Globe clicks resolve to one predictable place: the right drawer.
      ...(selectedOverlay ? { drawerOpen: true, timePopoverOpen: false } : {}),
    }),

  clearSelectedOverlay: () => set({ selectedOverlay: null }),

  setNeotomaResult: (result) => {
    if (!result) {
      set({
        neotomaStatus: 'idle',
        neotomaPoints: [],
        neotomaCount: 0,
        neotomaAgeMa: null,
        neotomaMessage: null,
        neotomaSource: null,
      })
      return
    }
    if (result.ok) {
      set({
        neotomaStatus: 'ready',
        neotomaAgeMa: result.ageMa,
        neotomaPoints: result.points || [],
        neotomaCount: (result.points || []).length,
        neotomaMessage: null,
        neotomaSource: result.source || 'live',
      })
      return
    }
    set({
      neotomaStatus: result.reason?.includes('≤') || result.reason?.includes('Quaternary')
        ? 'unsupported'
        : 'error',
      neotomaAgeMa: result.ageMa ?? null,
      neotomaPoints: [],
      neotomaCount: 0,
      neotomaMessage: result.reason || 'Neotoma overlay fetch failed.',
      neotomaSource: null,
    })
  },

  setNeotomaLoading: (ageMa) =>
    set({
      neotomaStatus: 'loading',
      neotomaAgeMa: ageMa,
      neotomaMessage: null,
    }),

  setMarkerResult: (result) => {
    if (!result) {
      set({
        markerStatus: 'idle',
        markerPoints: [],
        markerCount: 0,
        markerYear: null,
        markerMessage: null,
      })
      return
    }
    if (result.ok) {
      set({
        markerStatus: 'ready',
        markerYear: result.year ?? null,
        markerPoints: result.points || [],
        markerCount: result.count ?? (result.points || []).length,
        markerMessage: null,
      })
      return
    }
    set({
      markerStatus:
        result.reason?.includes('Holocene') || result.reason?.includes('focuses')
          ? 'unsupported'
          : 'error',
      markerYear: result.year ?? null,
      markerPoints: [],
      markerCount: 0,
      markerMessage: result.reason || 'Markers unavailable.',
    })
  },

  setMarkerLoading: (year) =>
    set({
      markerStatus: 'loading',
      markerYear: year ?? null,
      markerMessage: null,
    }),

  setLifeTaxonId: (lifeTaxonId) => {
    const filter = lifeFilterById(lifeTaxonId)
    set({
      lifeTaxonId: filter.id,
      lifeTaxonBaseName: filter.baseName,
      lifeTaxonLabel: filter.id === 'all' ? null : filter.label,
      lifePoints: [],
      lifeCount: 0,
      lifeStatus: 'idle',
      diversityBins: [],
      diversityStatus: 'idle',
    })
  },

  setLifeTaxonQuery: ({ id, baseName, label } = {}) => {
    const name = baseName || label || null
    if (!name) {
      get().setLifeTaxonId('all')
      return
    }
    set({
      lifeTaxonId: id || name,
      lifeTaxonBaseName: name,
      lifeTaxonLabel: label || name,
      lifePoints: [],
      lifeCount: 0,
      lifeStatus: 'idle',
      diversityBins: [],
      diversityStatus: 'idle',
    })
  },

  setDensityMode: (densityMode) => set({ densityMode: Boolean(densityMode) }),

  setLifeLimit: (lifeLimit) => {
    const n = Math.max(50, Math.min(2000, Math.round(Number(lifeLimit) || 500)))
    set({
      lifeLimit: n,
      lifePoints: [],
      lifeCount: 0,
      lifeStatus: 'idle',
    })
  },

  setDiversityResult: (result) => {
    if (!result) {
      set({ diversityStatus: 'idle', diversityBins: [] })
      return
    }
    if (result.ok) {
      set({ diversityStatus: 'ready', diversityBins: result.bins || [] })
      return
    }
    set({ diversityStatus: 'error', diversityBins: [] })
  },

  setDiversityLoading: () => set({ diversityStatus: 'loading' }),

  setSelectedEventId: (selectedEventId) => set({ selectedEventId: selectedEventId || null }),

  pinEvent: (eventId) =>
    set({
      pinnedEventId: eventId || null,
      selectedEventId: eventId || null,
    }),

  clearPinnedEvent: () => set({ pinnedEventId: null }),

  startTour: (tourId) => {
    if (get().reducedMotion) return false
    const tour = getTourById(tourId)
    if (!tour) return false
    const range = tourRangeYbp(tour)
    const ok = get().setRange(range.startYbp, range.endYbp, { keepTour: true })
    if (!ok) return false
    const chapter = resolveChapter(tour.chapters[0])
    set({
      activeTourId: tour.id,
      tourChapterIndex: 0,
      tourPlaying: true,
      tourNote: chapter.note,
      autoplay: false,
      pinnedEventId: chapter.eventId,
      selectedEventId: chapter.eventId,
      playheadYbp: clampYbpToRange(chapter.ybp, range),
    })
    get().syncUrl()
    return true
  },

  stopTour: () =>
    set({
      tourPlaying: false,
      activeTourId: null,
      tourChapterIndex: 0,
      tourNote: null,
    }),

  setTourPlaying: (v) => {
    if (get().reducedMotion) {
      set({ tourPlaying: false })
      return
    }
    set({ tourPlaying: Boolean(v), ...(v ? { autoplay: false } : {}) })
  },

  advanceTourChapter: () => {
    const s = get()
    const tour = getTourById(s.activeTourId)
    if (!tour) {
      set({ tourPlaying: false, activeTourId: null, tourNote: null })
      return false
    }
    const next = s.tourChapterIndex + 1
    if (next >= tour.chapters.length) {
      set({
        tourPlaying: false,
        tourNote: 'Tour complete.',
        pinnedEventId: null,
      })
      get().syncUrl()
      return false
    }
    const chapter = resolveChapter(tour.chapters[next])
    const range = { startYbp: s.rangeStartYbp, endYbp: s.rangeEndYbp }
    set({
      tourChapterIndex: next,
      tourNote: chapter.note,
      pinnedEventId: chapter.eventId,
      selectedEventId: chapter.eventId,
      playheadYbp: clampYbpToRange(chapter.ybp, range),
    })
    get().syncUrl()
    return true
  },

  setRange: (startYbp, endYbp, { keepTour = false } = {}) => {
    const v = validateRange(startYbp, endYbp)
    if (!v.ok) {
      set({ banner: v.error })
      return false
    }
    const playheadYbp = clampYbpToRange(get().playheadYbp, {
      startYbp: v.startYbp,
      endYbp: v.endYbp,
    })
    set({
      rangeStartYbp: v.startYbp,
      rangeEndYbp: v.endYbp,
      playheadYbp,
      banner: null,
      autoplay: false,
      ...(!keepTour
        ? { tourPlaying: false, activeTourId: null, tourChapterIndex: 0, tourNote: null }
        : {}),
    })
    return true
  },

  clearBanner: () => set({ banner: null, rangeAdjustedBanner: false }),

  setCamera: (camera) => set({ camera: { ...get().camera, ...camera } }),

  setManifest: (manifest) => set({ manifest, loadState: 'ready', manifestError: null }),

  setManifestError: (error) =>
    set({ manifestError: error, loadState: 'error' }),

  setLoadState: (loadState) => set({ loadState }),

  setErasBlurbs: (erasBlurbs) => set({ erasBlurbs }),

  setActiveTextureId: (activeTextureId) => set({ activeTextureId }),

  setTexturePending: (texturePending) => set({ texturePending: Boolean(texturePending) }),

  syncUrl: () => {
    const s = get()
    writeEarthHistoryUrlState({
      playheadYbp: s.playheadYbp,
      rangeStartYbp: s.rangeStartYbp,
      rangeEndYbp: s.rangeEndYbp,
      camera: s.camera,
      layers: s.layers,
      lifeTaxonId: s.lifeTaxonId,
      lifeTaxonBaseName: s.lifeTaxonBaseName,
      densityBoost: s.densityMode,
      polityDimension: s.polityDimension,
      colorblindSafe: s.colorblindSafe,
    })
  },

  // Hydrate last so URL overrides defaults (playhead, layers, taxon, dim, cb, dens).
  ...applyUrlHydration(),
}))
