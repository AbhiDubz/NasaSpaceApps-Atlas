/**
 * Single source of truth for Earth History data layers: id, label, URL flag,
 * swatch color, description, and which store keys report fetch status.
 * urlState.js derives its flag map from here; the Layers drawer renders from here.
 */

/**
 * @typedef {{
 *   id: string,
 *   flag: string,
 *   label: string,
 *   swatch: string,
 *   description: string,
 *   statusKey?: string,
 *   countKey?: string,
 *   messageKey?: string,
 * }} LayerDef
 */

/** @type {LayerDef[]} Order defines drawer order and URL flag order. */
export const LAYER_REGISTRY = Object.freeze([
  {
    id: 'events',
    flag: 'e',
    label: 'Events',
    swatch: '#f87171',
    description: 'Curated milestones as rings on the globe and ticks on the timeline.',
  },
  {
    id: 'coastlines',
    flag: 'c',
    label: 'Coastlines',
    swatch: '#7dd3fc',
    description: 'Paleocoastline vectors (GPlates Web Service).',
    statusKey: 'coastlineStatus',
    messageKey: 'coastlineMessage',
  },
  {
    id: 'life',
    flag: 'l',
    label: 'Life',
    swatch: '#34d399',
    description: 'Fossil occurrences from the Paleobiology Database.',
    statusKey: 'lifeStatus',
    countKey: 'lifeCount',
    messageKey: 'lifeMessage',
  },
  {
    id: 'geology',
    flag: 'g',
    label: 'Geology',
    swatch: '#c4a574',
    description: 'Macrostrat rock-record columns (Phanerozoic).',
    statusKey: 'geologyStatus',
    countKey: 'geologyCount',
    messageKey: 'geologyMessage',
  },
  {
    id: 'civilization',
    flag: 'v',
    label: 'Civilization',
    swatch: '#e8b45a',
    description: 'Ancient places and historical polity extents (Holocene).',
    statusKey: 'polityStatus',
    countKey: 'polityCount',
    messageKey: 'polityMessage',
  },
  {
    id: 'neotoma',
    flag: 'n',
    label: 'Quaternary',
    swatch: '#a78bfa',
    description: 'Neotoma paleoecology sites (Quaternary).',
    statusKey: 'neotomaStatus',
    countKey: 'neotomaCount',
    messageKey: 'neotomaMessage',
  },
  {
    id: 'markers',
    flag: 'm',
    label: 'Markers',
    swatch: '#e2e8f0',
    description: 'Historical markers with Wikipedia summaries (Holocene).',
    statusKey: 'markerStatus',
    countKey: 'markerCount',
    messageKey: 'markerMessage',
  },
])

export const LAYER_IDS = Object.freeze(LAYER_REGISTRY.map((l) => l.id))

/** flag letter → store key, derived for urlState. */
export const LAYER_FLAG_MAP = Object.freeze(
  Object.fromEntries(LAYER_REGISTRY.map((l) => [l.flag, l.id])),
)

export const LAYER_FLAG_ORDER = Object.freeze(LAYER_REGISTRY.map((l) => l.flag))

export function layerById(id) {
  return LAYER_REGISTRY.find((l) => l.id === id) ?? null
}

/**
 * Named view presets (Google Earth "map style" pattern).
 * @type {{ id: string, label: string, layers: Record<string, boolean> }[]}
 */
export const VIEW_PRESETS = Object.freeze([
  {
    id: 'paleogeography',
    label: 'Paleogeography',
    layers: {
      events: true,
      coastlines: true,
      life: false,
      geology: true,
      civilization: false,
      neotoma: false,
      markers: false,
    },
  },
  {
    id: 'life',
    label: 'Life & Fossils',
    layers: {
      events: true,
      coastlines: true,
      life: true,
      geology: false,
      civilization: false,
      neotoma: false,
      markers: false,
    },
  },
  {
    id: 'human',
    label: 'Human Era',
    layers: {
      events: true,
      coastlines: false,
      life: false,
      geology: false,
      civilization: true,
      neotoma: true,
      markers: true,
    },
  },
  {
    id: 'everything',
    label: 'Everything',
    layers: {
      events: true,
      coastlines: true,
      life: true,
      geology: true,
      civilization: true,
      neotoma: true,
      markers: true,
    },
  },
])

/**
 * Which preset matches the current layers object, or 'custom'.
 * @param {Record<string, boolean>} layers
 */
export function matchViewPreset(layers) {
  for (const preset of VIEW_PRESETS) {
    if (LAYER_IDS.every((id) => Boolean(layers?.[id]) === Boolean(preset.layers[id]))) {
      return preset.id
    }
  }
  return 'custom'
}
