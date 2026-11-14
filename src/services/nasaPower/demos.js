/**
 * Saved case files. Their results are cached as JSON in public/trend-demos/
 * (rebuild with `npm run trend:demos`) so the demo works without a live API.
 */

/** @typedef {{ lat: number, lng: number, label: string }} DemoPlace */

/** @type {{ id: string, title: string, blurb: string, variable: string, places: DemoPlace[] }[]} */
export const TREND_DEMOS = [
  {
    id: 'snoqualmie-snow',
    title: 'Snoqualmie Pass snow',
    blurb: 'Is the snowpack above Seattle shrinking?',
    variable: 'SNODP',
    places: [{ lat: 47.42, lng: -121.41, label: 'Snoqualmie Pass, Washington' }],
  },
  {
    id: 'rain-contrast',
    title: 'Same variable, opposite trends',
    blurb: 'Rainfall is rising in Dhaka and falling in São Paulo.',
    variable: 'PRECTOTCORR',
    places: [
      { lat: 23.81, lng: 90.41, label: 'Dhaka, Bangladesh' },
      { lat: -23.55, lng: -46.63, label: 'São Paulo, Brazil' },
    ],
  },
]

/** Variables cached for every saved place, so the picker keeps working offline. */
export const DEMO_CACHED_VARIABLES = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'RH2M', 'SNODP', 'ALLSKY_SFC_SW_DWN']

export function demoCacheUrl(lat, lng, variable) {
  return `/trend-demos/${Number(lat).toFixed(2)}_${Number(lng).toFixed(2)}_${variable}.json`
}

/** True when this point + variable has a cached result in the repo. */
export function isCachedDemo(lat, lng, variable) {
  if (!DEMO_CACHED_VARIABLES.includes(variable)) return false
  return TREND_DEMOS.some((d) =>
    d.places.some((p) => Math.abs(p.lat - lat) < 0.005 && Math.abs(p.lng - lng) < 0.005),
  )
}

export function demoPlaceLabel(lat, lng) {
  for (const d of TREND_DEMOS) {
    const hit = d.places.find((p) => Math.abs(p.lat - lat) < 0.005 && Math.abs(p.lng - lng) < 0.005)
    if (hit) return hit.label
  }
  return null
}
