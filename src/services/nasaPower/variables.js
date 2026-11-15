/**
 * NASA POWER variable catalog — shared by the API routes and the UI.
 *
 * `rising` / `falling` are the plain-language words used in the verdict
 * sentence when the trend is statistically significant.
 */

export const POWER_START_YEAR = 1981
export const POWER_END_YEAR = 2025

export const POWER_CREDIT =
  'Data: NASA Prediction Of Worldwide Energy Resources (POWER) Project, NASA Langley Research Center.'

/**
 * @typedef {object} PowerVariable
 * @property {string} code
 * @property {string} label
 * @property {string} unit
 * @property {'heat'|'rain'|'water'|'snow'|'sun'|'air'} theme
 * @property {string} definition — plain-language, for students and the public
 * @property {string} rising
 * @property {string} falling
 * @property {number} decimals — digits shown for a per-decade rate
 * @property {number} [startYear]
 * @property {string} [seasonNote] — background shown when seasons trend in opposite directions
 */

/** @type {Record<string, PowerVariable>} */
export const POWER_VARIABLES = {
  T2M: {
    code: 'T2M',
    label: 'Average air temperature',
    unit: '°C',
    theme: 'heat',
    definition: 'The average temperature of the air about 2 meters above the ground, over the whole month.',
    rising: 'Warming',
    falling: 'Cooling',
    decimals: 2,
  },
  T2M_MAX: {
    code: 'T2M_MAX',
    label: 'Hottest temperature',
    unit: '°C',
    theme: 'heat',
    definition: 'The highest air temperature reached during the month.',
    rising: 'Hottest days getting hotter',
    falling: 'Hottest days getting cooler',
    decimals: 2,
  },
  PRECTOTCORR: {
    code: 'PRECTOTCORR',
    label: 'Precipitation',
    unit: 'mm/day',
    theme: 'rain',
    definition: 'Rain and melted snow, averaged per day over the month.',
    rising: 'Getting wetter',
    falling: 'Getting drier',
    decimals: 3,
  },
  GWETROOT: {
    code: 'GWETROOT',
    label: 'Root-zone soil wetness',
    unit: '(0–1)',
    theme: 'water',
    definition: 'How wet the soil is where plant roots grow. 0 is completely dry, 1 is fully soaked.',
    rising: 'Soil getting wetter',
    falling: 'Soil drying out',
    decimals: 3,
  },
  RH2M: {
    code: 'RH2M',
    label: 'Relative humidity',
    unit: '%',
    theme: 'water',
    definition: 'How much water vapor the air holds compared with the most it could hold at that temperature.',
    rising: 'Air getting more humid',
    falling: 'Air getting drier',
    decimals: 2,
  },
  SNODP: {
    code: 'SNODP',
    label: 'Snow depth',
    unit: 'cm',
    theme: 'snow',
    definition: 'The average depth of snow on the ground during the month.',
    rising: 'Snow getting deeper',
    falling: 'Snow getting shallower',
    decimals: 2,
  },
  ALLSKY_SFC_SW_DWN: {
    code: 'ALLSKY_SFC_SW_DWN',
    label: 'Sunlight at the surface',
    unit: 'MJ/m²/day',
    theme: 'sun',
    definition: 'The energy from sunlight reaching the ground each day, clouds included. Records start in 1984.',
    rising: 'More sunlight reaching the ground',
    falling: 'Less sunlight reaching the ground',
    decimals: 3,
    startYear: 1984,
  },
  AOD_55: {
    code: 'AOD_55',
    label: 'Haze in the air',
    unit: '(optical depth)',
    theme: 'air',
    definition:
      'How much dust, smoke and pollution hangs in the air, measured by how much sunlight it blocks on the way down (aerosol optical depth). Below 0.1 is very clear; above 0.3 looks hazy. Records start in 2001.',
    rising: 'Air getting hazier',
    falling: 'Air getting clearer',
    decimals: 3,
    startYear: 2001,
    seasonNote:
      'Possible reasons, from published research: spring haze here is partly dust and pollution carried across the Pacific from Asia, where emissions have fallen. Summer haze is mostly wildfire smoke, which has grown. This tool tests the trend; it cannot prove the cause.',
  },
}

export const POWER_VARIABLE_CODES = Object.keys(POWER_VARIABLES)

export const POWER_THEMES = [
  { id: 'heat', label: 'Heat' },
  { id: 'rain', label: 'Rain' },
  { id: 'water', label: 'Water' },
  { id: 'snow', label: 'Snow' },
  { id: 'sun', label: 'Sun' },
  { id: 'air', label: 'Air' },
]

/** Variables suggested for a curiosity theme (primary matches first, then close relatives). */
const THEME_RELATED = {
  heat: ['T2M', 'T2M_MAX', 'RH2M'],
  rain: ['PRECTOTCORR', 'GWETROOT', 'RH2M'],
  water: ['GWETROOT', 'RH2M', 'PRECTOTCORR'],
  snow: ['SNODP', 'T2M', 'PRECTOTCORR'],
  sun: ['ALLSKY_SFC_SW_DWN', 'T2M_MAX'],
  air: ['AOD_55', 'ALLSKY_SFC_SW_DWN'],
}

export function variablesForTheme(theme) {
  return (THEME_RELATED[theme] || POWER_VARIABLE_CODES).map((c) => POWER_VARIABLES[c])
}

/** Parse a `vars=T2M,SNODP` query value; unknown codes are dropped. */
export function parseVarList(raw) {
  if (!raw) return POWER_VARIABLE_CODES
  const out = String(raw)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((c) => POWER_VARIABLES[c])
  return out.length ? [...new Set(out)] : POWER_VARIABLE_CODES
}

/** Clamp latitude, wrap longitude to [-180, 180], round to the 0.01° POWER accepts. */
export function normalizeLatLng(lat, lng) {
  const la = Number(lat)
  let lo = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90) return null
  lo = ((((lo + 180) % 360) + 360) % 360) - 180
  return { lat: Math.round(la * 100) / 100, lng: Math.round(lo * 100) / 100 }
}
