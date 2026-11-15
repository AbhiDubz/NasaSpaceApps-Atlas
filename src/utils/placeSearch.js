/**
 * Address + place search for the header search bar.
 *
 * Google Places (New) is the primary provider. When it is unavailable
 * (no API key, API not enabled, quota, network) or finds nothing, we fall
 * back to Photon — a free OpenStreetMap geocoder built for type-ahead —
 * so searching an address keeps working in every environment.
 *
 * Every suggestion has the same shape regardless of provider:
 *   { id, source: 'google'|'osm', placeId?, main, secondary, description, types, resolved? }
 * OSM suggestions carry their coordinates in `resolved`, so selecting one
 * needs no second request.
 */
import { searchPlacePredictions, resolvePlaceDetails } from './googleMaps'

const PHOTON_URL = 'https://photon.komoot.io/api/'

/** Photon `type` → the Google place types the rest of the app keys off. */
const PHOTON_TYPE_TO_GOOGLE = {
  house: ['street_address'],
  street: ['route'],
  locality: ['neighborhood', 'political'],
  district: ['sublocality', 'political'],
  city: ['locality', 'political'],
  county: ['administrative_area_level_2', 'political'],
  state: ['administrative_area_level_1', 'political'],
  country: ['country', 'political'],
}

/** Half-size (degrees) of the synthetic viewport for point-like OSM hits. */
const POINT_HALF_SPAN_DEG = {
  house: 0.0015,
  street: 0.004,
  other: 0.003,
}

function uniqueJoin(parts) {
  const seen = new Set()
  const out = []
  for (const p of parts) {
    const v = typeof p === 'string' ? p.trim() : ''
    if (!v || seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
  }
  return out.join(', ')
}

/** Map one Photon GeoJSON feature to a suggestion. Exported for tests. */
export function photonFeatureToSuggestion(feature) {
  const props = feature?.properties || {}
  const [lng, lat] = feature?.geometry?.coordinates || []
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const streetLine = [props.housenumber, props.street].filter(Boolean).join(' ')
  const main = props.name || streetLine || props.city || props.state || props.country
  if (!main) return null

  const secondary = uniqueJoin([
    props.name && streetLine ? streetLine : null,
    props.district,
    props.city,
    props.state,
    props.country,
  ].filter((p) => p !== main))

  const kind = props.type || 'other'
  let viewport = null
  if (Array.isArray(props.extent) && props.extent.length === 4) {
    const [west, north, east, south] = props.extent
    viewport = { north, south, east, west }
  } else {
    const h = POINT_HALF_SPAN_DEG[kind] ?? POINT_HALF_SPAN_DEG.other
    viewport = { north: lat + h, south: lat - h, east: lng + h, west: lng - h }
  }

  const types = PHOTON_TYPE_TO_GOOGLE[kind] || ['point_of_interest']
  const description = uniqueJoin([main, secondary])
  return {
    id: `osm:${props.osm_type || ''}${props.osm_id ?? `${lat},${lng}`}`,
    source: 'osm',
    main,
    secondary,
    description,
    types,
    resolved: {
      lat,
      lng,
      name: main,
      formattedAddress: description,
      types,
      viewport,
      photoUrl: null,
      photoAttribution: '',
      description: '',
    },
  }
}

async function searchPhoton(query, { signal } = {}) {
  const url = `${PHOTON_URL}?${new URLSearchParams({ q: query, limit: '6', lang: 'en' })}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) throw new Error(`Photon ${res.status}`)
  const body = await res.json()
  const out = []
  const seen = new Set()
  for (const f of body?.features || []) {
    const s = photonFeatureToSuggestion(f)
    if (!s || seen.has(s.description)) continue
    seen.add(s.description)
    out.push(s)
  }
  return out
}

/**
 * Search addresses and places. Resolves to `{ suggestions, source }`;
 * rejects only when every provider failed.
 */
export async function searchPlaces(query, { sessionToken, signal } = {}) {
  const q = typeof query === 'string' ? query.trim() : ''
  if (!q) return { suggestions: [], source: null }

  let googleError = null
  try {
    const preds = await searchPlacePredictions(q, sessionToken)
    if (preds.length) {
      return {
        source: 'google',
        suggestions: preds.map((p) => ({ ...p, id: `google:${p.placeId}`, source: 'google' })),
      }
    }
  } catch (err) {
    googleError = err
  }

  try {
    const suggestions = await searchPhoton(q, { signal })
    return { suggestions, source: suggestions.length ? 'osm' : null }
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    // Google answered (with nothing) — report "no matches", not an outage.
    if (!googleError) return { suggestions: [], source: null }
    throw googleError
  }
}

/** Turn a suggestion into `{ lat, lng, name, viewport, ... }`, or null. */
export async function resolvePlace(suggestion, { sessionToken } = {}) {
  if (!suggestion) return null
  if (suggestion.resolved) return suggestion.resolved
  if (suggestion.placeId) return resolvePlaceDetails(suggestion.placeId, sessionToken)
  return null
}
