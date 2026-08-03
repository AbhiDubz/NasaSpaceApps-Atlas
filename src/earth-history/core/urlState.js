/**
 * Earth History URL state — isolated from live ATLAS urlState.
 * Query keys: t (playhead Ma), t0/t1 (range start/end Ma), cam (lat,lng,alt),
 * year (optional Holocene calendar year CE/BCE),
 * L (layer flags), taxon, dens, dim, cb.
 */

import { EARTH_BIRTH_YBP, maToYbp, normalizeYbp, validateRange, ybpToMa } from './timeScale.js'
import {
  calendarYearToYbp,
  formatCalendarYear,
  isHolocenePlayhead,
  ybpToCalendarYear,
} from './calendarYear.js'
import { LAYER_FLAG_MAP, LAYER_FLAG_ORDER } from './layerRegistry.js'

const EH_HISTORY_EVENT = 'atlas-eh-history'

export { LAYER_FLAG_MAP, LAYER_FLAG_ORDER }

const DEFAULT_LAYERS = {
  events: true,
  coastlines: true,
  life: true,
  geology: false,
  civilization: true,
  neotoma: true,
  markers: true,
}

/**
 * @param {string | null} flags
 * @returns {Record<string, boolean> | null}
 */
export function parseLayerFlags(flags) {
  if (flags == null || flags === '') return null
  const layers = { ...DEFAULT_LAYERS }
  for (const key of Object.values(LAYER_FLAG_MAP)) layers[key] = false
  for (const ch of String(flags)) {
    const key = LAYER_FLAG_MAP[ch]
    if (key) layers[key] = true
  }
  return layers
}

/**
 * @param {Record<string, boolean>} layers
 */
export function serializeLayerFlags(layers) {
  let out = ''
  for (const ch of LAYER_FLAG_ORDER) {
    const key = LAYER_FLAG_MAP[ch]
    if (layers?.[key]) out += ch
  }
  return out
}

export function readEarthHistoryUrlState(search = typeof window !== 'undefined' ? window.location.search : '') {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const out = {
    playheadYbp: null,
    rangeStartYbp: null,
    rangeEndYbp: null,
    camera: null,
    rangeAdjusted: false,
    layers: null,
    lifeTaxonId: null,
    densityBoost: null,
    polityDimension: null,
    colorblindSafe: null,
  }

  const t = params.get('t')
  if (t != null && t !== '') {
    const ma = Number(t)
    if (Number.isFinite(ma)) out.playheadYbp = normalizeYbp(maToYbp(ma))
  }

  const yearParam = params.get('year')
  if (yearParam != null && yearParam !== '' && out.playheadYbp == null) {
    const y = Number(yearParam)
    if (Number.isFinite(y) && y !== 0) {
      out.playheadYbp = calendarYearToYbp(y)
    }
  }

  const t0 = params.get('t0')
  const t1 = params.get('t1')
  if (t0 != null && t1 != null) {
    const start = normalizeYbp(maToYbp(Number(t0)))
    const end = normalizeYbp(maToYbp(Number(t1)))
    const v = validateRange(start, end)
    if (v.ok) {
      out.rangeStartYbp = v.startYbp
      out.rangeEndYbp = v.endYbp
    } else {
      out.rangeStartYbp = EARTH_BIRTH_YBP
      out.rangeEndYbp = 0
      out.rangeAdjusted = true
    }
  }

  const cam = params.get('cam')
  if (cam) {
    const parts = cam.split(',').map(Number)
    if (parts.length >= 2 && parts.every(Number.isFinite)) {
      out.camera = {
        lat: parts[0],
        lng: parts[1],
        altitude: Number.isFinite(parts[2]) ? parts[2] : 2.2,
      }
    }
  }

  const L = params.get('L')
  if (L != null) out.layers = parseLayerFlags(L)

  const taxon = params.get('taxon')
  if (taxon != null && taxon !== '') out.lifeTaxonId = taxon

  const dens = params.get('dens')
  if (dens != null) out.densityBoost = dens === '1' || dens === 'true'

  const dim = params.get('dim')
  if (dim && ['ruler', 'religion', 'culture', 'population'].includes(dim)) {
    out.polityDimension = dim
  }

  const cb = params.get('cb')
  if (cb != null) out.colorblindSafe = cb === '1' || cb === 'true'

  return out
}

export function serializeEarthHistoryUrlState(state) {
  const params = new URLSearchParams()
  if (state.playheadYbp != null) {
    params.set('t', formatMaParam(ybpToMa(state.playheadYbp)))
    if (isHolocenePlayhead(state.playheadYbp)) {
      const year = ybpToCalendarYear(state.playheadYbp)
      params.set('year', String(year))
    }
  }
  if (state.rangeStartYbp != null && state.rangeEndYbp != null) {
    const full =
      state.rangeStartYbp === EARTH_BIRTH_YBP && state.rangeEndYbp === 0
    if (!full) {
      params.set('t0', formatMaParam(ybpToMa(state.rangeStartYbp)))
      params.set('t1', formatMaParam(ybpToMa(state.rangeEndYbp)))
    }
  }
  if (state.camera && Number.isFinite(state.camera.lat) && Number.isFinite(state.camera.lng)) {
    const alt = Number.isFinite(state.camera.altitude) ? state.camera.altitude : 2.2
    params.set(
      'cam',
      `${state.camera.lat.toFixed(2)},${state.camera.lng.toFixed(2)},${alt.toFixed(2)}`,
    )
  }
  if (state.layers) {
    const flags = serializeLayerFlags(state.layers)
    const defaultFlags = serializeLayerFlags(DEFAULT_LAYERS)
    if (flags !== defaultFlags) params.set('L', flags)
  }
  if (state.lifeTaxonBaseName) {
    params.set('taxon', state.lifeTaxonBaseName)
  } else if (state.lifeTaxonId && state.lifeTaxonId !== 'all') {
    params.set('taxon', state.lifeTaxonId)
  }
  if (state.densityBoost) params.set('dens', '1')
  if (state.polityDimension && state.polityDimension !== 'ruler') {
    params.set('dim', state.polityDimension)
  }
  if (state.colorblindSafe) params.set('cb', '1')
  return params
}

function formatMaParam(ma) {
  if (ma === 0) return '0'
  if (ma >= 100) return String(Math.round(ma))
  if (ma >= 1) return ma.toFixed(2).replace(/\.?0+$/, '')
  return ma.toPrecision(3)
}

export function writeEarthHistoryUrlState(state, { replace = true } = {}) {
  if (typeof window === 'undefined') return
  const params = serializeEarthHistoryUrlState(state)
  const qs = params.toString()
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`
  if (replace) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new Event(EH_HISTORY_EVENT))
}

export { EH_HISTORY_EVENT, formatCalendarYear, DEFAULT_LAYERS }
