/**
 * Trend Detective variable catalog — shared by the API routes and the UI.
 *
 * Two providers feed it:
 *   - 'power' (the default): NASA POWER's monthly point API, which serves
 *     MERRA-2 model output and CERES satellite products, from 1981.
 *   - 'grid': products read straight from the instruments and land models
 *     (MODIS, AIRS, OMI, GPM, GLDAS), prebuilt into static grids over
 *     Washington. See instrumentGrids.js.
 *
 * The exports keep their POWER_ names from when POWER was the only provider.
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
 * @property {'heat'|'rain'|'water'|'snow'|'sun'|'air'|'plants'} theme
 * @property {'power'|'grid'} [provider] — where the data comes from; 'power' when omitted
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
  EVLAND: {
    code: 'EVLAND',
    label: 'Evaporation from land',
    unit: 'mm/day',
    theme: 'water',
    definition:
      'Water leaving the ground and plants as vapor, averaged per day over the month. It needs both moisture to draw on and energy to lift it, so it can fall in a drying place and rise in a warming one.',
    rising: 'More evaporation',
    falling: 'Less evaporation',
    decimals: 3,
  },
  NDVI: {
    code: 'NDVI',
    provider: 'grid',
    label: 'Plant greenness',
    unit: '(0–1)',
    theme: 'plants',
    definition:
      'How green and leafy the land looks from space (the NDVI index). Near 0 is bare rock or pavement; near 1 is dense forest. Measured by the MODIS instrument on NASA’s Terra satellite since 2000. Water and snow-covered ground are left out.',
    rising: 'Land getting greener',
    falling: 'Land getting less green',
    decimals: 3,
    startYear: 2000,
  },
  LST_DAY: {
    code: 'LST_DAY',
    provider: 'grid',
    label: 'Ground temperature (daytime)',
    unit: '°C',
    theme: 'heat',
    definition:
      'How hot the ground itself gets on clear days, seen by the MODIS instrument on NASA’s Terra satellite in the late morning. Bare ground and pavement run far hotter than the air above them. Records start in 2000.',
    rising: 'Ground getting hotter',
    falling: 'Ground getting cooler',
    decimals: 2,
    startYear: 2000,
  },
  SOIL_GLDAS: {
    code: 'SOIL_GLDAS',
    provider: 'grid',
    label: 'Topsoil moisture',
    unit: 'kg/m²',
    theme: 'water',
    definition:
      'Water held in the top 10 cm of soil, in kilograms per square meter, from NASA’s GLDAS land model, which blends satellite and ground observations. Records start in 2000.',
    rising: 'Topsoil getting wetter',
    falling: 'Topsoil drying out',
    decimals: 2,
    startYear: 2000,
  },
  PRECIP_GPM: {
    code: 'PRECIP_GPM',
    provider: 'grid',
    label: 'Rain and snow (GPM satellites)',
    unit: 'mm/day',
    theme: 'rain',
    definition:
      'Rain and melted snow, averaged per day over the month, from the GPM mission’s IMERG record, which merges many satellites and adjusts them to rain gauges. Records start in 1998.',
    rising: 'Getting wetter',
    falling: 'Getting drier',
    decimals: 3,
    startYear: 1998,
  },
  RUNOFF: {
    code: 'RUNOFF',
    provider: 'grid',
    label: 'Runoff toward streams',
    unit: 'mm/day',
    theme: 'water',
    definition:
      'Rain and snowmelt that the soil cannot hold, which runs off or seeps out toward streams and rivers, per day. It is the water that becomes streamflow. From NASA’s GLDAS land model since 2000. The model’s rain and snow input is coarse, so a mountain range and its dry side can blur together.',
    rising: 'More runoff',
    falling: 'Less runoff',
    decimals: 3,
    startYear: 2000,
  },
  WET_DAYS: {
    code: 'WET_DAYS',
    provider: 'grid',
    label: 'Rainy or snowy days',
    unit: 'days/month',
    theme: 'rain',
    definition:
      'Days in the month when rain or snow averaged at least 0.1 mm an hour (about 2.4 mm a day), from the GPM mission’s IMERG record, which merges many satellites. Satellite estimates can differ from rain gauges, especially over snow. Records start in 2000.',
    rising: 'More wet days',
    falling: 'Fewer wet days',
    decimals: 2,
    startYear: 2000,
  },
  NO2: {
    code: 'NO2',
    provider: 'grid',
    label: 'Nitrogen dioxide pollution',
    unit: '×10¹⁵/cm²',
    theme: 'air',
    definition:
      'A gas from car exhaust, power plants and fires, counted as molecules in the lower atmosphere above each square centimeter of ground. Measured by the OMI instrument on NASA’s Aura satellite since 2004.',
    rising: 'Nitrogen dioxide rising',
    falling: 'Nitrogen dioxide falling',
    decimals: 2,
    startYear: 2004,
  },
  CO_500: {
    code: 'CO_500',
    provider: 'grid',
    label: 'Carbon monoxide aloft',
    unit: 'ppb',
    theme: 'air',
    definition:
      'Carbon monoxide about 5.5 km up, in parts per billion. It comes from fires and burning fuel, and winds carry it across oceans. Measured by the AIRS instrument on NASA’s Aqua satellite since 2002.',
    rising: 'Carbon monoxide rising',
    falling: 'Carbon monoxide falling',
    decimals: 1,
    startYear: 2002,
  },
}

/** Every variable in the catalog, both providers. */
export const POWER_VARIABLE_CODES = Object.keys(POWER_VARIABLES)

/** Only the variables NASA POWER's API serves. */
export const POWER_API_CODES = POWER_VARIABLE_CODES.filter((c) => (POWER_VARIABLES[c].provider || 'power') === 'power')

export const isGridVariable = (code) => POWER_VARIABLES[code]?.provider === 'grid'

export const POWER_THEMES = [
  { id: 'heat', label: 'Heat' },
  { id: 'rain', label: 'Rain' },
  { id: 'water', label: 'Water' },
  { id: 'snow', label: 'Snow' },
  { id: 'sun', label: 'Sun' },
  { id: 'air', label: 'Air' },
  { id: 'plants', label: 'Plants' },
]

/** Variables suggested for a curiosity theme (primary matches first, then close relatives). */
const THEME_RELATED = {
  heat: ['T2M', 'T2M_MAX', 'LST_DAY', 'RH2M'],
  rain: ['PRECTOTCORR', 'PRECIP_GPM', 'WET_DAYS', 'RUNOFF'],
  water: ['RUNOFF', 'GWETROOT', 'SOIL_GLDAS', 'EVLAND', 'RH2M'],
  snow: ['SNODP', 'T2M', 'PRECTOTCORR'],
  sun: ['ALLSKY_SFC_SW_DWN', 'T2M_MAX'],
  air: ['AOD_55', 'NO2', 'CO_500'],
  plants: ['NDVI', 'SOIL_GLDAS', 'EVLAND'],
}

export function variablesForTheme(theme) {
  return (THEME_RELATED[theme] || POWER_VARIABLE_CODES).map((c) => POWER_VARIABLES[c])
}

/** Parse a `vars=T2M,SNODP` query value for the NASA POWER API; codes it does not serve are dropped. */
export function parseVarList(raw) {
  if (!raw) return POWER_API_CODES
  const out = String(raw)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((c) => POWER_API_CODES.includes(c))
  return out.length ? [...new Set(out)] : POWER_API_CODES
}

/** Clamp latitude, wrap longitude to [-180, 180], round to the 0.01° POWER accepts. */
export function normalizeLatLng(lat, lng) {
  const la = Number(lat)
  let lo = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90) return null
  lo = ((((lo + 180) % 360) + 360) % 360) - 180
  return { lat: Math.round(la * 100) / 100, lng: Math.round(lo * 100) / 100 }
}
