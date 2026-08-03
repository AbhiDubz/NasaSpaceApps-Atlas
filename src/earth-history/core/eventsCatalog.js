/**
 * Curated deep-time events for Phase 2 timeline markers.
 * Ages are approximate; not a substitute for PBDB / peer-reviewed databases.
 */

import { maToYbp, normalizeYbp, ybpToMa, ybpToSlider } from './timeScale.js'

/** @typedef {'extinction' | 'life' | 'civilization' | 'geology'} EventKind */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   ageMa: number,
 *   kind: EventKind,
 *   summary: string,
 *   citation?: string,
 *   lat?: number,
 *   lng?: number,
 * }} DeepTimeEvent
 */

/** @type {DeepTimeEvent[]} */
export const DEEP_TIME_EVENTS = Object.freeze([
  {
    id: 'origin-life',
    name: 'Earliest life',
    ageMa: 3500,
    kind: 'life',
    summary: 'Evidence for microbial life in Archean rocks; Earth still largely ocean-covered.',
    citation: 'Illustrative milestone (approx.)',
  },
  {
    id: 'great-oxidation',
    name: 'Great Oxidation Event',
    ageMa: 2400,
    kind: 'geology',
    summary: 'Atmospheric oxygen rises; chemistry of surface environments transforms.',
    citation: 'Illustrative milestone (approx.)',
  },
  {
    id: 'ediacara',
    name: 'Ediacaran biota',
    ageMa: 575,
    kind: 'life',
    summary: 'Soft-bodied macroscopic organisms appear before the Cambrian radiation.',
  },
  {
    id: 'cambrian-explosion',
    name: 'Cambrian radiation',
    ageMa: 530,
    kind: 'life',
    summary: 'Rapid diversification of animal body plans in marine ecosystems.',
  },
  {
    id: 'first-shells',
    name: 'First mineralized shells',
    ageMa: 550,
    kind: 'life',
    summary: 'Small shelly fossils appear near the Ediacaran–Cambrian transition.',
  },
  {
    id: 'first-land-plants',
    name: 'First land plants',
    ageMa: 470,
    kind: 'life',
    summary: 'Embryophytes colonize land; spore evidence from the mid-Ordovician.',
  },
  {
    id: 'ordovician-extinction',
    name: 'Late Ordovician extinction',
    ageMa: 445,
    kind: 'extinction',
    summary: 'One of the “Big Five” mass extinctions; marine invertebrates hit hardest.',
  },
  {
    id: 'pangaea',
    name: 'Pangaea assembled',
    ageMa: 300,
    kind: 'geology',
    summary: 'Supercontinent Pangaea largely assembled by the late Paleozoic.',
  },
  {
    id: 'first-dinosaurs',
    name: 'First dinosaurs',
    ageMa: 230,
    kind: 'life',
    summary: 'Early dinosaurs appear in the Late Triassic after the Permian recovery.',
  },
  {
    id: 'devonian-extinction',
    name: 'Late Devonian crises',
    ageMa: 372,
    kind: 'extinction',
    summary: 'Pulsed extinctions affect reef systems and marine life over millions of years.',
  },
  {
    id: 'permian-triassic',
    name: 'End-Permian extinction',
    ageMa: 252,
    kind: 'extinction',
    summary: 'Largest Phanerozoic mass extinction; clears the stage for Mesozoic ecosystems.',
    lat: 66,
    lng: 90,
  },
  {
    id: 'siberian-traps',
    name: 'Siberian Traps',
    ageMa: 251,
    kind: 'geology',
    summary: 'Massive flood-basalt province in Siberia; linked to end-Permian biotic crisis.',
    citation: 'Illustrative LIP location (approx. modern coords)',
    lat: 66,
    lng: 90,
  },
  {
    id: 'triassic-jurassic',
    name: 'Triassic–Jurassic extinction',
    ageMa: 201,
    kind: 'extinction',
    summary: 'Major turnover at the dawn of the Jurassic; dinosaurs expand afterward.',
    lat: 40,
    lng: -74,
  },
  {
    id: 'camp',
    name: 'Central Atlantic Magmatic Province',
    ageMa: 201,
    kind: 'geology',
    summary: 'CAMP flood basalts accompany Pangea breakup and the Triassic–Jurassic crisis.',
    citation: 'Illustrative LIP location (approx.)',
    lat: 40,
    lng: -74,
  },
  {
    id: 'kt-extinction',
    name: 'End-Cretaceous extinction',
    ageMa: 66,
    kind: 'extinction',
    summary: 'Chicxulub impact and volcanism end non-avian dinosaurs; mammals diversify.',
    lat: 21.3,
    lng: -89.5,
  },
  {
    id: 'chicxulub',
    name: 'Chicxulub impact',
    ageMa: 66,
    kind: 'geology',
    summary: '~180 km impact structure on the Yucatán Peninsula; K–Pg boundary event.',
    citation: 'Chicxulub crater ~21.3°N, 89.5°W',
    lat: 21.3,
    lng: -89.5,
  },
  {
    id: 'deccan-traps',
    name: 'Deccan Traps',
    ageMa: 66,
    kind: 'geology',
    summary: 'Flood basalts of the Indian subcontinent erupt near the K–Pg boundary.',
    citation: 'Illustrative LIP location (approx. modern coords)',
    lat: 20,
    lng: 76,
  },
  {
    id: 'manicouagan',
    name: 'Manicouagan impact',
    ageMa: 214,
    kind: 'geology',
    summary: 'Large Late Triassic impact structure in Québec, Canada.',
    lat: 51.4,
    lng: -68.7,
  },
  {
    id: 'popigai',
    name: 'Popigai impact',
    ageMa: 35.7,
    kind: 'geology',
    summary: 'One of the largest Cenozoic impact structures, northern Siberia.',
    lat: 71.65,
    lng: 111.18,
  },
  {
    id: 'chesapeake-bay',
    name: 'Chesapeake Bay impact',
    ageMa: 35.5,
    kind: 'geology',
    summary: 'Submarine impact on the Atlantic margin of North America.',
    lat: 37.3,
    lng: -76.1,
  },
  {
    id: 'columbia-river-basalts',
    name: 'Columbia River Basalts',
    ageMa: 16,
    kind: 'geology',
    summary: 'Miocene flood-basalt province of the Pacific Northwest.',
    lat: 46.5,
    lng: -119.5,
  },
  {
    id: 'hominins',
    name: 'Early hominins',
    ageMa: 6,
    kind: 'life',
    summary: 'Hominin lineage diverges in Africa; bipedalism and tool use emerge later.',
    lat: 3,
    lng: 36,
  },
  {
    id: 'homo-sapiens',
    name: 'Homo sapiens',
    ageMa: 0.3,
    kind: 'life',
    summary: 'Anatomically modern humans appear; later disperse across continents.',
    lat: 9,
    lng: 38.5,
  },
  {
    id: 'lgm',
    name: 'Last Glacial Maximum',
    ageMa: 0.021,
    kind: 'geology',
    summary: 'Ice sheets at maximum extent; sea levels far below present.',
  },
  {
    id: 'agriculture',
    name: 'Neolithic agriculture',
    ageMa: 0.01,
    kind: 'civilization',
    summary: 'Farming and settled communities spread in multiple independent centers.',
    lat: 37,
    lng: 38,
  },
  {
    id: 'urban-bronze',
    name: 'Early urban civilizations',
    ageMa: 0.005,
    kind: 'civilization',
    summary: 'Cities, writing, and long-distance trade networks take shape in several regions.',
    lat: 33.5,
    lng: 44.4,
  },
  {
    id: 'industrial',
    name: 'Industrial acceleration',
    ageMa: 0.00025,
    kind: 'civilization',
    summary: 'Fossil-fuel industry remakes energy, climate forcing, and global connectivity.',
    lat: 53.5,
    lng: -2.2,
  },
])

const KIND_ORDER = { extinction: 0, life: 1, geology: 2, civilization: 3 }

/**
 * Semantic jump targets for the timeline “Jump to…” control.
 * Ordered oldest → youngest for ← / → stepping.
 * @typedef {{ id: string, label: string, ageMa: number, eventId?: string }} DeepTimeMilestone
 */

/** @type {DeepTimeMilestone[]} */
export const DEEP_TIME_MILESTONES = Object.freeze([
  { id: 'ms-origin-life', label: 'Earliest life', ageMa: 3500, eventId: 'origin-life' },
  { id: 'ms-great-oxidation', label: 'Great Oxidation', ageMa: 2400, eventId: 'great-oxidation' },
  { id: 'ms-first-shells', label: 'First shells', ageMa: 550, eventId: 'first-shells' },
  { id: 'ms-cambrian', label: 'Cambrian radiation', ageMa: 530, eventId: 'cambrian-explosion' },
  { id: 'ms-land-plants', label: 'First land plants', ageMa: 470, eventId: 'first-land-plants' },
  { id: 'ms-pangaea', label: 'Pangaea', ageMa: 300, eventId: 'pangaea' },
  { id: 'ms-end-permian', label: 'End-Permian extinction', ageMa: 252, eventId: 'permian-triassic' },
  { id: 'ms-first-dinos', label: 'First dinosaurs', ageMa: 230, eventId: 'first-dinosaurs' },
  { id: 'ms-kpg', label: 'K–Pg extinction', ageMa: 66, eventId: 'kt-extinction' },
  { id: 'ms-hominids', label: 'First hominids', ageMa: 6, eventId: 'hominins' },
  { id: 'ms-sapiens', label: 'Homo sapiens', ageMa: 0.3, eventId: 'homo-sapiens' },
  { id: 'ms-agriculture', label: 'Agriculture', ageMa: 0.01, eventId: 'agriculture' },
  { id: 'ms-present', label: 'Present', ageMa: 0 },
])

/**
 * Milestones sorted oldest → youngest (for ← older / → younger).
 * @returns {DeepTimeMilestone[]}
 */
export function milestonesSorted() {
  return DEEP_TIME_MILESTONES.slice().sort((a, b) => b.ageMa - a.ageMa)
}

/**
 * Index of the milestone nearest to a playhead age.
 * @param {number} ageMa
 * @param {DeepTimeMilestone[]} [list]
 */
export function nearestMilestoneIndex(ageMa, list = milestonesSorted()) {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < list.length; i++) {
    const d = Math.abs(list[i].ageMa - ageMa)
    if (d < bestDist) {
      bestDist = d
      best = i
    }
  }
  return best
}

export function eventYbp(event) {
  return normalizeYbp(maToYbp(event.ageMa))
}

/**
 * Events visible inside an editable range (inclusive).
 * @param {{ startYbp: number, endYbp: number }} range
 * @param {DeepTimeEvent[]} [events]
 */
export function eventsInRange(range, events = DEEP_TIME_EVENTS) {
  const start = normalizeYbp(range.startYbp)
  const end = normalizeYbp(range.endYbp)
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  return events
    .filter((e) => {
      const y = eventYbp(e)
      return y >= lo && y <= hi
    })
    .slice()
    .sort((a, b) => eventYbp(b) - eventYbp(a))
}

/**
 * Events with lat/lng near the playhead age window.
 * @param {{ startYbp: number, endYbp: number }} range
 * @param {{ playheadYbp?: number, halfWindowMa?: number, events?: DeepTimeEvent[] }} [opts]
 * @returns {DeepTimeEvent[]}
 */
export function eventsWithLocation(range, opts = {}) {
  const events = opts.events || DEEP_TIME_EVENTS
  const halfWindowMa = opts.halfWindowMa ?? null
  const inRange = eventsInRange(range, events).filter(
    (e) => Number.isFinite(e.lat) && Number.isFinite(e.lng),
  )
  if (halfWindowMa == null || opts.playheadYbp == null) return inRange

  const playMa = ybpToMa(opts.playheadYbp)
  return inRange.filter((e) => Math.abs(e.ageMa - playMa) <= halfWindowMa)
}

/**
 * Nearest event to playhead in slider-space (fair across deep time).
 * @param {number} playheadYbp
 * @param {{ startYbp: number, endYbp: number }} range
 * @param {{ events?: DeepTimeEvent[], maxSliderDist?: number }} [opts]
 * @returns {{ event: DeepTimeEvent, sliderDist: number } | null}
 */
export function nearestEvent(playheadYbp, range, opts = {}) {
  const events = opts.events || DEEP_TIME_EVENTS
  const maxSliderDist = opts.maxSliderDist ?? 0.04
  const u = ybpToSlider(playheadYbp, range)
  let best = null
  let bestDist = Infinity
  for (const e of events) {
    const y = eventYbp(e)
    if (y > Math.max(range.startYbp, range.endYbp) || y < Math.min(range.startYbp, range.endYbp)) {
      continue
    }
    const eu = ybpToSlider(y, range)
    const d = Math.abs(eu - u)
    if (d < bestDist) {
      bestDist = d
      best = e
    }
  }
  if (!best || bestDist > maxSliderDist) return null
  return { event: best, sliderDist: bestDist }
}

export function eventKindLabel(kind) {
  switch (kind) {
    case 'extinction':
      return 'Mass extinction'
    case 'life':
      return 'Life'
    case 'civilization':
      return 'Civilization'
    case 'geology':
      return 'Earth system'
    default:
      return 'Event'
  }
}

export function eventKindRank(kind) {
  return KIND_ORDER[kind] ?? 99
}
