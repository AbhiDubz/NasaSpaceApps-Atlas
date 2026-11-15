import { useEffect, useRef } from 'react'
import { useAtlasStore, isLegacyCuratedSourceList } from '../store/atlasStore'
import { supabase } from '../services/supabase'
import { readAccountTourDecision, readLocalTourDecision } from '../core/tourState'

const DEBOUNCE_MS = 900

function userPrefsStorageKey(userId) {
  return `atlas_user_prefs_${userId}`
}

function readLocalUserPrefs(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(userPrefsStorageKey(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLocalUserPrefs(userId, prefs) {
  if (!userId) return
  try {
    localStorage.setItem(userPrefsStorageKey(userId), JSON.stringify(prefs))
  } catch {
    /* ignore */
  }
}

export function pickPreferences(state) {
  const cleanOverrides = { ...(state.qualityOverrides || {}) }
  delete cleanOverrides.__atlas_ext

  const ext = {
    data_layers: state.dataLayers,
    time_filter: state.timeFilter,
    tactical_mode: Boolean(state.tacticalMode),
    detection_mode: Boolean(state.detectionMode),
    detection_label_density: state.detectionLabelDensity || 'sparse',
    tour_state: readLocalTourDecision() || readAccountTourDecision(state.user) || null,
  }

  return {
    selected_sources: state.selectedSources,
    globe_mode: state.globeMode,
    quality_tier: state.qualityTier,
    quality_overrides: {
      ...cleanOverrides,
      __atlas_ext: ext,
    },
    colorblind_mode: Boolean(state.colorblindMode),
    active_dimensions: [...state.activeDimensions],
    data_layers: ext.data_layers,
    time_filter: ext.time_filter,
    tactical_mode: ext.tactical_mode,
    detection_mode: ext.detection_mode,
    detection_label_density: ext.detection_label_density,
    tour_state: ext.tour_state,
  }
}

/** Apply a preferences snapshot (from Supabase `profiles` or per-user local cache) to the store. */
export function applyPreferencesToStore(data, store = useAtlasStore.getState()) {
  if (!data || typeof data !== 'object') return

  const ext =
    data.quality_overrides && typeof data.quality_overrides === 'object'
      ? data.quality_overrides.__atlas_ext || {}
      : {}

  if (data.selected_sources && !isLegacyCuratedSourceList(data.selected_sources)) {
    store.setSelectedSources(data.selected_sources)
  }
  if (data.globe_mode) {
    store.setGlobeMode(data.globe_mode)
  }
  if (data.quality_tier) {
    store.setQualityTier(data.quality_tier)
  }
  if (data.quality_overrides && typeof data.quality_overrides === 'object') {
    store.setQualityOverrides(data.quality_overrides)
  }
  if (typeof data.colorblind_mode === 'boolean') {
    store.setColorblindMode(data.colorblind_mode)
  }
  if (Array.isArray(data.active_dimensions) && data.active_dimensions.length > 0) {
    store.setActiveDimensions(data.active_dimensions)
  }

  const dataLayers = data.data_layers || ext.data_layers
  if (dataLayers && typeof dataLayers === 'object' && !Array.isArray(dataLayers)) {
    store.setDataLayers(dataLayers)
  }

  const timeFilter = data.time_filter || ext.time_filter
  if (typeof timeFilter === 'string' && timeFilter) {
    store.setTimeFilter(timeFilter)
  }

  const tacticalMode =
    typeof data.tactical_mode === 'boolean' ? data.tactical_mode : ext.tactical_mode
  if (typeof tacticalMode === 'boolean') {
    store.setTacticalMode(tacticalMode)
  }

  const detectionMode =
    typeof data.detection_mode === 'boolean' ? data.detection_mode : ext.detection_mode
  if (typeof detectionMode === 'boolean') {
    store.setDetectionMode(detectionMode)
  }

  const detectionDensity = data.detection_label_density || ext.detection_label_density
  if (detectionDensity === 'dense' || detectionDensity === 'sparse') {
    store.setDetectionLabelDensity(detectionDensity)
  }

  const tourState = data.tour_state || ext.tour_state
  if (tourState && (tourState.status === 'completed' || tourState.status === 'skipped')) {
    try {
      localStorage.setItem('atlas_tour_v1', JSON.stringify(tourState))
    } catch {
      /* ignore */
    }
  }
}

async function upsertProfileRow(userId, prefs) {
  if (!supabase || !userId) return
  const now = new Date().toISOString()
  const fullRow = {
    id: userId,
    ...prefs,
    updated_at: now,
  }
  const { error } = await supabase.from('profiles').upsert(fullRow)
  if (!error) return

  // Fallback for databases that have 001 + 006 migrated but not 012 yet:
  // extended fields are still preserved inside `quality_overrides.__atlas_ext`.
  const baseRow = {
    id: userId,
    selected_sources: prefs.selected_sources,
    globe_mode: prefs.globe_mode,
    quality_tier: prefs.quality_tier,
    quality_overrides: prefs.quality_overrides,
    colorblind_mode: prefs.colorblind_mode,
    active_dimensions: prefs.active_dimensions,
    updated_at: now,
  }
  await supabase.from('profiles').upsert(baseRow)
}

export function usePreferencesSync() {
  const user = useAtlasStore((s) => s.user)
  const timerRef = useRef(null)
  const lastJsonRef = useRef(null)
  const hydratingRef = useRef(false)

  useEffect(() => {
    if (!user) return undefined

    let cancelled = false

    // 1. Instant local per-user restore before network completes
    const cached = readLocalUserPrefs(user.id)
    if (cached) {
      hydratingRef.current = true
      applyPreferencesToStore(cached)
      hydratingRef.current = false
    }

    // 2. Remote Supabase `profiles` hydration
    const loadProfile = async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (cancelled) return

      const hasSavedRow =
        data &&
        (data.globe_mode != null ||
          data.quality_tier != null ||
          data.selected_sources != null ||
          data.active_dimensions != null)

      if (!error && hasSavedRow) {
        hydratingRef.current = true
        applyPreferencesToStore(data)
        hydratingRef.current = false
        const currentPrefs = pickPreferences(useAtlasStore.getState())
        writeLocalUserPrefs(user.id, currentPrefs)
        lastJsonRef.current = JSON.stringify(currentPrefs)
      } else {
        // First sign-in (or empty trigger row): seed the profile with current client state
        const initialPrefs = pickPreferences(useAtlasStore.getState())
        writeLocalUserPrefs(user.id, initialPrefs)
        lastJsonRef.current = JSON.stringify(initialPrefs)
        await upsertProfileRow(user.id, initialPrefs)
      }
    }

    loadProfile()

    const unsub = useAtlasStore.subscribe((state) => {
      if (!user || hydratingRef.current) return
      const prefs = pickPreferences(state)
      const json = JSON.stringify(prefs)
      if (json === lastJsonRef.current) return
      lastJsonRef.current = json
      writeLocalUserPrefs(user.id, prefs)

      if (!supabase) return
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        upsertProfileRow(user.id, prefs)
      }, DEBOUNCE_MS)
    })

    return () => {
      cancelled = true
      clearTimeout(timerRef.current)
      unsub()
    }
  }, [user])
}
