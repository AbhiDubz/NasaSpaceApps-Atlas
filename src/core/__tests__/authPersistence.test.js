import { describe, it, expect } from 'vitest'
import {
  hasOAuthCallbackParams,
  readOAuthCallbackError,
} from '../../services/supabase'
import { applyPreferencesToStore, pickPreferences } from '../../hooks/usePreferencesSync'

describe('OAuth callback URL detection', () => {
  it('detects implicit flow access_token in URL hash', () => {
    expect(hasOAuthCallbackParams({ hash: '#access_token=abc&refresh_token=def', search: '' })).toBe(true)
  })

  it('detects PKCE flow code in URL search', () => {
    expect(hasOAuthCallbackParams({ hash: '', search: '?code=pkce_12345' })).toBe(true)
  })

  it('returns false for normal ATLAS share URLs', () => {
    expect(hasOAuthCallbackParams({ hash: '', search: '?gm=globegl&tac=1' })).toBe(false)
  })

  it('extracts and decodes OAuth callback error descriptions', () => {
    expect(
      readOAuthCallbackError({
        hash: '#error=access_denied&error_description=User+cancelled+login',
        search: '',
      }),
    ).toBe('User cancelled login')
  })
})

describe('Preferences persistence serialization & hydration', () => {
  it('packs extended preferences (layers, timeFilter, tactical, detection, tour) and hydrates them back', () => {
    const fakeState = {
      selectedSources: [
        { id: 's1', name: 'Source 1' },
        { id: 's2', name: 'Source 2' },
      ],
      globeMode: 'globegl',
      qualityTier: 'high',
      qualityOverrides: { bloom: false, __atlas_ext: { stale: true } },
      colorblindMode: true,
      activeDimensions: new Set(['safety', 'economy']),
      dataLayers: { firms: false, usgs: true, windOverlay: true },
      timeFilter: '7d',
      tacticalMode: true,
      detectionMode: true,
      detectionLabelDensity: 'dense',
      user: {
        id: 'u-1',
        user_metadata: { atlas_tour: { status: 'completed', at: '2026-11-15T00:00:00Z' } },
      },
    }

    const picked = pickPreferences(fakeState)
    expect(picked.globe_mode).toBe('globegl')
    expect(picked.quality_overrides.bloom).toBe(false)
    expect(picked.quality_overrides.__atlas_ext.time_filter).toBe('7d')
    expect(picked.quality_overrides.__atlas_ext.tactical_mode).toBe(true)
    expect(picked.quality_overrides.__atlas_ext.data_layers.windOverlay).toBe(true)
    expect(picked.tour_state).toEqual({ status: 'completed', at: '2026-11-15T00:00:00Z' })

    // Simulate hydrating from a DB that only stored base columns + quality_overrides.__atlas_ext
    const applied = {}
    const fakeStore = {
      setSelectedSources: (v) => { applied.selectedSources = v },
      setGlobeMode: (v) => { applied.globeMode = v },
      setQualityTier: (v) => { applied.qualityTier = v },
      setQualityOverrides: (v) => { applied.qualityOverrides = v },
      setColorblindMode: (v) => { applied.colorblindMode = v },
      setActiveDimensions: (v) => { applied.activeDimensions = v },
      setDataLayers: (v) => { applied.dataLayers = v },
      setTimeFilter: (v) => { applied.timeFilter = v },
      setTacticalMode: (v) => { applied.tacticalMode = v },
      setDetectionMode: (v) => { applied.detectionMode = v },
      setDetectionLabelDensity: (v) => { applied.detectionLabelDensity = v },
    }

    applyPreferencesToStore(
      {
        selected_sources: picked.selected_sources,
        globe_mode: picked.globe_mode,
        quality_tier: picked.quality_tier,
        quality_overrides: picked.quality_overrides,
        colorblind_mode: picked.colorblind_mode,
        active_dimensions: picked.active_dimensions,
      },
      fakeStore,
    )

    expect(applied.globeMode).toBe('globegl')
    expect(applied.qualityTier).toBe('high')
    expect(applied.colorblindMode).toBe(true)
    expect(applied.activeDimensions).toEqual(['safety', 'economy'])
    expect(applied.dataLayers).toEqual({ firms: false, usgs: true, windOverlay: true })
    expect(applied.timeFilter).toBe('7d')
    expect(applied.tacticalMode).toBe(true)
    expect(applied.detectionMode).toBe(true)
    expect(applied.detectionLabelDensity).toBe('dense')
  })
})
