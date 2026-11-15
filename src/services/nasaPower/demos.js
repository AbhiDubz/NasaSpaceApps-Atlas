/**
 * Saved case files, all inside Washington State (the Trend Detective study
 * region). Their results are cached as JSON in public/trend-demos/
 * (rebuild with `npm run trend:demos`) so the demo works without a live API.
 */

/** @typedef {{ lat: number, lng: number, label: string }} DemoPlace */

const SNOQUALMIE = { lat: 47.42, lng: -121.41, label: 'Snoqualmie Pass, Washington' }
const SEATTLE = { lat: 47.61, lng: -122.33, label: 'Seattle, Washington' }
const YAKIMA = { lat: 46.6, lng: -120.51, label: 'Yakima, Washington' }
const WENATCHEE = { lat: 47.42, lng: -120.31, label: 'Wenatchee, Washington' }
const MOUNT_VERNON = { lat: 48.42, lng: -122.33, label: 'Skagit Valley, Washington' }
const METHOW = { lat: 48.48, lng: -120.19, label: 'Methow Valley, Washington' }

/**
 * `season` is optional: 'winter' | 'spring' | 'summer' | 'fall' opens the case
 * on that season's test; without it the case opens on the whole year.
 * @type {{ id: string, title: string, blurb: string, variable: string, season?: string, places: DemoPlace[] }[]}
 */
export const TREND_DEMOS = [
  {
    id: 'seattle-haze',
    title: 'Seattle haze: two seasons, two answers',
    blurb: 'Is the air getting hazier or clearer? Spring says clearer. Summer says hazier.',
    variable: 'AOD_55',
    places: [SEATTLE],
  },
  {
    id: 'snoqualmie-snow',
    title: 'Snoqualmie Pass snow',
    blurb: 'Is the snowpack above Seattle shrinking?',
    variable: 'SNODP',
    places: [SNOQUALMIE],
  },
  {
    id: 'cascades-humidity',
    title: 'Two sides of the Cascades',
    blurb: 'The air is getting more humid in Seattle and drier in Yakima.',
    variable: 'RH2M',
    places: [SEATTLE, YAKIMA],
  },
  {
    id: 'yakima-soil',
    title: 'Yakima Valley soil',
    blurb: 'Is farm country east of the mountains drying out?',
    variable: 'GWETROOT',
    places: [YAKIMA],
  },
]

/**
 * Where a Washington news tip opens, by news theme: a place where that kind
 * of story is typical (floods on the Skagit, drought in the Yakima Valley…).
 */
export const TIP_PLACES = {
  drought: YAKIMA,
  flood: MOUNT_VERNON,
  heat: WENATCHEE,
  snow: SNOQUALMIE,
  smoke: METHOW,
}

/** Variables cached for every saved place, so the picker keeps working offline. */
export const DEMO_CACHED_VARIABLES = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'RH2M', 'SNODP', 'ALLSKY_SFC_SW_DWN', 'AOD_55']

/** Every distinct saved place. */
export function demoPlaces() {
  const out = new Map()
  for (const d of TREND_DEMOS) for (const p of d.places) out.set(`${p.lat},${p.lng}`, p)
  return [...out.values()]
}

export function demoCacheUrl(lat, lng, variable) {
  return `/trend-demos/${Number(lat).toFixed(2)}_${Number(lng).toFixed(2)}_${variable}.json`
}

const near = (p, lat, lng) => Math.abs(p.lat - lat) < 0.005 && Math.abs(p.lng - lng) < 0.005

/** True when this point + variable has a cached result in the repo. */
export function isCachedDemo(lat, lng, variable) {
  if (!DEMO_CACHED_VARIABLES.includes(variable)) return false
  return demoPlaces().some((p) => near(p, lat, lng))
}

export function demoPlaceLabel(lat, lng) {
  const all = [...demoPlaces(), ...Object.values(TIP_PLACES)]
  return all.find((p) => near(p, lat, lng))?.label || null
}
