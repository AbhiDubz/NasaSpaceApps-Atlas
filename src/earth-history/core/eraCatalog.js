/**
 * ICS geological time intervals + lookup helpers.
 * Ages in Ma (million years ago). Loaded blurbs merge from eras.json when available.
 * Colors approximate ICS Chronostratigraphic Chart.
 */

import { maToYbp, normalizeYbp, ybpToMa } from './timeScale.js'

/**
 * @typedef {'eon'|'era'|'period'|'epoch'|'age'} EraRank
 * @typedef {{
 *   id: string,
 *   rank: EraRank,
 *   name: string,
 *   startMa: number,
 *   endMa: number,
 *   color: string,
 *   parentId?: string,
 *   blurb?: string,
 * }} EraInterval
 */

/** Drill ranks used by the timeline band strip (includes stage-level ages). */
export const DRILL_RANKS = Object.freeze(['eon', 'era', 'period', 'epoch', 'age'])

/** @type {EraInterval[]} */
export const ERA_INTERVALS = Object.freeze([
  // —— Eons ——
  { id: 'hadean', rank: 'eon', name: 'Hadean', startMa: 4540, endMa: 4000, color: '#AE827C' },
  { id: 'archean', rank: 'eon', name: 'Archean', startMa: 4000, endMa: 2500, color: '#F0746F' },
  { id: 'proterozoic', rank: 'eon', name: 'Proterozoic', startMa: 2500, endMa: 541, color: '#F73563' },
  { id: 'phanerozoic', rank: 'eon', name: 'Phanerozoic', startMa: 541, endMa: 0, color: '#9AD9AF' },

  // —— Precambrian eras ——
  { id: 'eoarchean', rank: 'era', name: 'Eoarchean', startMa: 4000, endMa: 3600, color: '#DA4653', parentId: 'archean' },
  { id: 'paleoarchean', rank: 'era', name: 'Paleoarchean', startMa: 3600, endMa: 3200, color: '#F4442E', parentId: 'archean' },
  { id: 'mesoarchean', rank: 'era', name: 'Mesoarchean', startMa: 3200, endMa: 2800, color: '#FB6078', parentId: 'archean' },
  { id: 'neoarchean', rank: 'era', name: 'Neoarchean', startMa: 2800, endMa: 2500, color: '#F75F70', parentId: 'archean' },
  { id: 'paleoproterozoic', rank: 'era', name: 'Paleoproterozoic', startMa: 2500, endMa: 1600, color: '#F74370', parentId: 'proterozoic' },
  { id: 'mesoproterozoic', rank: 'era', name: 'Mesoproterozoic', startMa: 1600, endMa: 1000, color: '#F9498D', parentId: 'proterozoic' },
  { id: 'neoproterozoic', rank: 'era', name: 'Neoproterozoic', startMa: 1000, endMa: 541, color: '#FEBADA', parentId: 'proterozoic' },

  // —— Phanerozoic eras ——
  { id: 'paleozoic', rank: 'era', name: 'Paleozoic', startMa: 541, endMa: 251.9, color: '#99C08D', parentId: 'phanerozoic' },
  { id: 'mesozoic', rank: 'era', name: 'Mesozoic', startMa: 251.9, endMa: 66, color: '#67C5CA', parentId: 'phanerozoic' },
  { id: 'cenozoic', rank: 'era', name: 'Cenozoic', startMa: 66, endMa: 0, color: '#F2F91D', parentId: 'phanerozoic' },

  // —— Paleozoic periods ——
  { id: 'cambrian', rank: 'period', name: 'Cambrian', startMa: 541, endMa: 485.4, color: '#7FA056', parentId: 'paleozoic' },
  { id: 'ordovician', rank: 'period', name: 'Ordovician', startMa: 485.4, endMa: 443.8, color: '#009270', parentId: 'paleozoic' },
  { id: 'silurian', rank: 'period', name: 'Silurian', startMa: 443.8, endMa: 419.2, color: '#B3E1B6', parentId: 'paleozoic' },
  { id: 'devonian', rank: 'period', name: 'Devonian', startMa: 419.2, endMa: 358.9, color: '#CB8C37', parentId: 'paleozoic' },
  { id: 'carboniferous', rank: 'period', name: 'Carboniferous', startMa: 358.9, endMa: 298.9, color: '#67A599', parentId: 'paleozoic' },
  { id: 'permian', rank: 'period', name: 'Permian', startMa: 298.9, endMa: 251.9, color: '#F04028', parentId: 'paleozoic' },

  // —— Mesozoic periods ——
  { id: 'triassic', rank: 'period', name: 'Triassic', startMa: 251.9, endMa: 201.4, color: '#812B92', parentId: 'mesozoic' },
  { id: 'jurassic', rank: 'period', name: 'Jurassic', startMa: 201.4, endMa: 145, color: '#34B2C9', parentId: 'mesozoic' },
  { id: 'cretaceous', rank: 'period', name: 'Cretaceous', startMa: 145, endMa: 66, color: '#7FC64E', parentId: 'mesozoic' },

  // —— Cenozoic periods ——
  { id: 'paleogene', rank: 'period', name: 'Paleogene', startMa: 66, endMa: 23.03, color: '#FD9A52', parentId: 'cenozoic' },
  { id: 'neogene', rank: 'period', name: 'Neogene', startMa: 23.03, endMa: 2.58, color: '#FFE619', parentId: 'cenozoic' },
  { id: 'quaternary', rank: 'period', name: 'Quaternary', startMa: 2.58, endMa: 0, color: '#F9F97F', parentId: 'cenozoic' },

  // —— Paleozoic epochs (ICS series) ——
  { id: 'terreneuvian', rank: 'epoch', name: 'Terreneuvian', startMa: 541, endMa: 521, color: '#8CB06C', parentId: 'cambrian' },
  { id: 'cambrian-series-2', rank: 'epoch', name: 'Cambrian Series 2', startMa: 521, endMa: 509, color: '#99C070', parentId: 'cambrian' },
  { id: 'miaolingian', rank: 'epoch', name: 'Miaolingian', startMa: 509, endMa: 497, color: '#A6C575', parentId: 'cambrian' },
  { id: 'furongian', rank: 'epoch', name: 'Furongian', startMa: 497, endMa: 485.4, color: '#B3CF7A', parentId: 'cambrian' },
  { id: 'early-ordovician', rank: 'epoch', name: 'Early Ordovician', startMa: 485.4, endMa: 470, color: '#1A9D6F', parentId: 'ordovician' },
  { id: 'middle-ordovician', rank: 'epoch', name: 'Middle Ordovician', startMa: 470, endMa: 458.4, color: '#40B07C', parentId: 'ordovician' },
  { id: 'late-ordovician', rank: 'epoch', name: 'Late Ordovician', startMa: 458.4, endMa: 443.8, color: '#66C28A', parentId: 'ordovician' },
  { id: 'llandovery', rank: 'epoch', name: 'Llandovery', startMa: 443.8, endMa: 433.4, color: '#99D4A8', parentId: 'silurian' },
  { id: 'wenlock', rank: 'epoch', name: 'Wenlock', startMa: 433.4, endMa: 427.4, color: '#A6D7A3', parentId: 'silurian' },
  { id: 'ludlow', rank: 'epoch', name: 'Ludlow', startMa: 427.4, endMa: 423, color: '#B3DAB0', parentId: 'silurian' },
  { id: 'pridoli', rank: 'epoch', name: 'Přídolí', startMa: 423, endMa: 419.2, color: '#C0DDAD', parentId: 'silurian' },
  { id: 'early-devonian', rank: 'epoch', name: 'Early Devonian', startMa: 419.2, endMa: 393.3, color: '#E5AD4F', parentId: 'devonian' },
  { id: 'middle-devonian', rank: 'epoch', name: 'Middle Devonian', startMa: 393.3, endMa: 382.7, color: '#EBB85C', parentId: 'devonian' },
  { id: 'late-devonian', rank: 'epoch', name: 'Late Devonian', startMa: 382.7, endMa: 358.9, color: '#F1C868', parentId: 'devonian' },
  { id: 'mississippian', rank: 'epoch', name: 'Mississippian', startMa: 358.9, endMa: 323.2, color: '#67A599', parentId: 'carboniferous' },
  { id: 'pennsylvanian', rank: 'epoch', name: 'Pennsylvanian', startMa: 323.2, endMa: 298.9, color: '#99C2B5', parentId: 'carboniferous' },
  { id: 'cisuralian', rank: 'epoch', name: 'Cisuralian', startMa: 298.9, endMa: 272.95, color: '#EF6950', parentId: 'permian' },
  { id: 'guadalupian', rank: 'epoch', name: 'Guadalupian', startMa: 272.95, endMa: 259.1, color: '#F79078', parentId: 'permian' },
  { id: 'lopingian', rank: 'epoch', name: 'Lopingian', startMa: 259.1, endMa: 251.9, color: '#FDBFBF', parentId: 'permian' },

  // —— Mesozoic epochs ——
  { id: 'early-triassic', rank: 'epoch', name: 'Early Triassic', startMa: 251.9, endMa: 247.2, color: '#983999', parentId: 'triassic' },
  { id: 'middle-triassic', rank: 'epoch', name: 'Middle Triassic', startMa: 247.2, endMa: 237, color: '#B168B1', parentId: 'triassic' },
  { id: 'late-triassic', rank: 'epoch', name: 'Late Triassic', startMa: 237, endMa: 201.4, color: '#BD87C0', parentId: 'triassic' },
  { id: 'early-jurassic', rank: 'epoch', name: 'Early Jurassic', startMa: 201.4, endMa: 174.1, color: '#00B4EB', parentId: 'jurassic' },
  { id: 'middle-jurassic', rank: 'epoch', name: 'Middle Jurassic', startMa: 174.1, endMa: 163.5, color: '#80CFEA', parentId: 'jurassic' },
  { id: 'late-jurassic', rank: 'epoch', name: 'Late Jurassic', startMa: 163.5, endMa: 145, color: '#B3E3EE', parentId: 'jurassic' },
  { id: 'early-cretaceous', rank: 'epoch', name: 'Early Cretaceous', startMa: 145, endMa: 100.5, color: '#A0C96D', parentId: 'cretaceous' },
  { id: 'late-cretaceous', rank: 'epoch', name: 'Late Cretaceous', startMa: 100.5, endMa: 66, color: '#C5E1A5', parentId: 'cretaceous' },

  // —— Cenozoic epochs ——
  { id: 'paleocene', rank: 'epoch', name: 'Paleocene', startMa: 66, endMa: 56, color: '#FDB46C', parentId: 'paleogene' },
  { id: 'eocene', rank: 'epoch', name: 'Eocene', startMa: 56, endMa: 33.9, color: '#FDC07A', parentId: 'paleogene' },
  { id: 'oligocene', rank: 'epoch', name: 'Oligocene', startMa: 33.9, endMa: 23.03, color: '#FDD49E', parentId: 'paleogene' },
  { id: 'miocene', rank: 'epoch', name: 'Miocene', startMa: 23.03, endMa: 5.333, color: '#FFFF00', parentId: 'neogene' },
  { id: 'pliocene', rank: 'epoch', name: 'Pliocene', startMa: 5.333, endMa: 2.58, color: '#FFFF99', parentId: 'neogene' },
  { id: 'pleistocene', rank: 'epoch', name: 'Pleistocene', startMa: 2.58, endMa: 0.0117, color: '#FFF2AE', parentId: 'quaternary' },
  { id: 'holocene', rank: 'epoch', name: 'Holocene', startMa: 0.0117, endMa: 0, color: '#FEF2E0', parentId: 'quaternary' },

  // —— Key Phanerozoic ages (stages) ——
  { id: 'fortunian', rank: 'age', name: 'Fortunian', startMa: 541, endMa: 529, color: '#8CB06C', parentId: 'cambrian' },
  { id: 'wuliuan', rank: 'age', name: 'Wuliuan', startMa: 509, endMa: 504.5, color: '#A6C575', parentId: 'cambrian' },
  { id: 'paibian', rank: 'age', name: 'Paibian', startMa: 497, endMa: 494, color: '#B3CF7A', parentId: 'cambrian' },
  { id: 'hirnantian', rank: 'age', name: 'Hirnantian', startMa: 445.2, endMa: 443.8, color: '#33A17C', parentId: 'ordovician' },
  { id: 'pricholi', rank: 'age', name: 'Přídolí', startMa: 423, endMa: 419.2, color: '#A6D7A3', parentId: 'silurian' },
  { id: 'famennian', rank: 'age', name: 'Famennian', startMa: 372.2, endMa: 358.9, color: '#F1C868', parentId: 'devonian' },
  { id: 'bashkirian', rank: 'age', name: 'Bashkirian', startMa: 323.2, endMa: 315.2, color: '#99C2B5', parentId: 'carboniferous' },
  { id: 'gzhelian', rank: 'age', name: 'Gzhelian', startMa: 303.7, endMa: 298.9, color: '#BDD5CB', parentId: 'carboniferous' },
  { id: 'changhsingian', rank: 'age', name: 'Changhsingian', startMa: 254.2, endMa: 251.9, color: '#FDBFBF', parentId: 'permian' },
  { id: 'carnian', rank: 'age', name: 'Carnian', startMa: 237, endMa: 227, color: '#A366A0', parentId: 'triassic' },
  { id: 'rhaetian', rank: 'age', name: 'Rhaetian', startMa: 208.5, endMa: 201.4, color: '#E2B0D5', parentId: 'triassic' },
  { id: 'toarcian', rank: 'age', name: 'Toarcian', startMa: 182.7, endMa: 174.1, color: '#00B4EB', parentId: 'jurassic' },
  { id: 'tithonian', rank: 'age', name: 'Tithonian', startMa: 152.1, endMa: 145, color: '#B3E3EE', parentId: 'jurassic' },
  { id: 'cenomanian', rank: 'age', name: 'Cenomanian', startMa: 100.5, endMa: 93.9, color: '#A0C96D', parentId: 'cretaceous' },
  { id: 'maastrichtian', rank: 'age', name: 'Maastrichtian', startMa: 72.1, endMa: 66, color: '#F1F7C5', parentId: 'cretaceous' },
  { id: 'danian', rank: 'age', name: 'Danian', startMa: 66, endMa: 61.6, color: '#FDBF6F', parentId: 'paleocene' },
  { id: 'lutetian', rank: 'age', name: 'Lutetian', startMa: 47.8, endMa: 41.2, color: '#FCCA8C', parentId: 'eocene' },
  { id: 'chattian', rank: 'age', name: 'Chattian', startMa: 28.1, endMa: 23.03, color: '#FEE1B0', parentId: 'oligocene' },
  { id: 'tortonian', rank: 'age', name: 'Tortonian', startMa: 11.63, endMa: 7.246, color: '#FFFF66', parentId: 'miocene' },
  { id: 'piacenzian', rank: 'age', name: 'Piacenzian', startMa: 3.6, endMa: 2.58, color: '#FFFFBF', parentId: 'pliocene' },
  { id: 'gelasian', rank: 'age', name: 'Gelasian', startMa: 2.58, endMa: 1.8, color: '#FFF7C4', parentId: 'pleistocene' },
  { id: 'calabrian', rank: 'age', name: 'Calabrian', startMa: 1.8, endMa: 0.774, color: '#FFF9D6', parentId: 'pleistocene' },
  { id: 'chibanian', rank: 'age', name: 'Chibanian', startMa: 0.774, endMa: 0.129, color: '#FFFBE6', parentId: 'pleistocene' },
  { id: 'tarantian', rank: 'age', name: 'Late Pleistocene', startMa: 0.129, endMa: 0.0117, color: '#FFFCED', parentId: 'pleistocene' },
  { id: 'greenlandian', rank: 'age', name: 'Greenlandian', startMa: 0.0117, endMa: 0.0082, color: '#FEF6E6', parentId: 'holocene' },
  { id: 'northgrippian', rank: 'age', name: 'Northgrippian', startMa: 0.0082, endMa: 0.0042, color: '#FEF8EC', parentId: 'holocene' },
  { id: 'meghalayan', rank: 'age', name: 'Meghalayan', startMa: 0.0042, endMa: 0, color: '#FEFAF2', parentId: 'holocene' },
])

export const ERAS = ERA_INTERVALS

const BY_ID = new Map(ERA_INTERVALS.map((e) => [e.id, e]))

const DEFAULT_BLURBS = {
  hadean: 'Earth accretes from the solar nebula. The surface is molten; no preserved continents yet — reconstructions are highly uncertain.',
  archean: 'First continental crust and oceans. Life may begin as simple microbes. Plate tectonics as we know them are still debated.',
  proterozoic: 'Continents assemble and break apart. Oxygen builds in the atmosphere. Multicellular life appears near the end.',
  phanerozoic: 'Visible life. Animals, plants, and complex ecosystems diversify across shifting continents and seas.',
  paleozoic: 'From Cambrian radiation to the end-Permian extinction — life conquers the seas, then the land.',
  mesozoic: 'Age of reptiles. Pangaea breaks apart; Atlantic opens; dinosaurs dominate until the end-Cretaceous impact.',
  cenozoic: 'Age of mammals. Continents approach modern positions; ice ages sculpt the Quaternary.',
  cambrian: 'Sudden diversification of animal body plans in the oceans.',
  ordovician: 'Marine invertebrates thrive; first land plants appear late in the period.',
  silurian: 'Coral reefs expand; jawed fish and early vascular plants spread.',
  devonian: 'Age of fishes; forests and tetrapods emerge on land.',
  carboniferous: 'Vast coal forests; amniotes appear; ice at the poles.',
  permian: 'Pangaea assembled; ends in Earth’s greatest mass extinction.',
  triassic: 'Recovery after Permian; first dinosaurs and mammals.',
  jurassic: 'Pangaea rifts; dinosaurs diversify; early birds.',
  cretaceous: 'High seas, flowering plants; ends with Chicxulub impact (~66 Ma).',
  paleogene: 'Mammals and birds radiate after the K–Pg extinction.',
  neogene: 'Grasslands spread; apes and early hominins evolve.',
  quaternary: 'Ice age cycles; Homo sapiens spreads worldwide.',
  paleocene: 'Recovery biotas after K–Pg; early placental mammal radiations.',
  eocene: 'Warm climates; early whales and primates diversify.',
  oligocene: 'Cooling and ice; open habitats expand.',
  miocene: 'Grasslands and apes; Himalaya uplift intensifies.',
  pliocene: 'Cooling toward Pleistocene ice ages; early Australopithecus.',
  pleistocene: 'Glacial–interglacial swings; megafauna and early humans.',
  holocene: 'Current interglacial. Agriculture, civilizations, and the modern world.',
}

/**
 * Viridis-like sequential color for colorblind-safe bands.
 * t=0 → purple (older), t=1 → yellow (younger).
 * @param {number} t01
 */
export function viridisColor(t01) {
  const t = Math.min(1, Math.max(0, Number(t01) || 0))
  // Sampled viridis stops (approx.)
  const stops = [
    [68, 1, 84],
    [72, 40, 120],
    [62, 74, 137],
    [49, 104, 142],
    [38, 130, 142],
    [31, 158, 137],
    [53, 183, 121],
    [109, 205, 89],
    [180, 222, 44],
    [253, 231, 37],
  ]
  const x = t * (stops.length - 1)
  const i = Math.floor(x)
  const f = x - i
  const a = stops[i]
  const b = stops[Math.min(i + 1, stops.length - 1)]
  const r = Math.round(a[0] + (b[0] - a[0]) * f)
  const g = Math.round(a[1] + (b[1] - a[1]) * f)
  const bl = Math.round(a[2] + (b[2] - a[2]) * f)
  return `rgb(${r},${g},${bl})`
}

/**
 * @param {EraRank|string} rank
 * @returns {EraInterval[]}
 */
export function intervalsAtRank(rank) {
  return ERA_INTERVALS.filter((e) => e.rank === rank)
}

/**
 * Direct children of an interval (by parentId).
 * @param {string} id
 * @returns {EraInterval[]}
 */
export function childrenOf(id) {
  if (!id) return []
  return ERA_INTERVALS.filter((e) => e.parentId === id)
}

/**
 * @param {string} id
 * @returns {EraInterval|null}
 */
export function intervalById(id) {
  return BY_ID.get(id) ?? null
}

/**
 * Next finer drill rank, or null at epoch.
 * @param {string} rank
 * @returns {string|null}
 */
export function nextDrillRank(rank) {
  const i = DRILL_RANKS.indexOf(rank)
  if (i < 0 || i >= DRILL_RANKS.length - 1) return null
  return DRILL_RANKS[i + 1]
}

/**
 * Whether an interval has children at the next drill rank (or any children).
 * @param {EraInterval} interval
 */
export function canDrillInterval(interval) {
  if (!interval) return false
  const next = nextDrillRank(interval.rank)
  const kids = childrenOf(interval.id)
  if (!kids.length) return false
  if (!next) return false
  return kids.some((k) => k.rank === next) || kids.some((k) => DRILL_RANKS.includes(k.rank))
}

/**
 * Intervals for the hierarchical slider band strip.
 * @param {'eon'|'era'|'period'|'epoch'|string} level
 * @param {{ parentId?: string|null, rangeStartMa?: number, rangeEndMa?: number }} [opts]
 * @returns {EraInterval[]}
 */
export function drilldownTrack(level, opts = {}) {
  const rank = DRILL_RANKS.includes(level) ? level : 'period'
  let list = intervalsAtRank(rank)

  if (opts.parentId) {
    list = list.filter((e) => e.parentId === opts.parentId)
  }

  // Prefer ages when epoch track is empty under a parent that only has ages
  if (rank === 'epoch' && opts.parentId && list.length === 0) {
    list = childrenOf(opts.parentId).filter((e) => e.rank === 'age')
  }

  const inRange = (items) => {
    if (opts.rangeStartMa == null || opts.rangeEndMa == null) return items
    const lo = Math.min(opts.rangeStartMa, opts.rangeEndMa)
    const hi = Math.max(opts.rangeStartMa, opts.rangeEndMa)
    return items.filter((e) => e.endMa < hi && e.startMa > lo)
  }

  list = inRange(list)

  // When epoch strip is empty (e.g. Cambrian zoom), show stage-level ages if any
  if (rank === 'epoch' && list.length === 0) {
    list = inRange(intervalsAtRank('age'))
  }

  return list.slice().sort((a, b) => b.startMa - a.startMa)
}

/**
 * @param {number} ybp
 * @param {{ blurbs?: Record<string, string> }} [opts]
 */
export function resolveEraContext(ybp, opts = {}) {
  const ma = ybpToMa(normalizeYbp(ybp))
  const blurbs = { ...DEFAULT_BLURBS, ...opts.blurbs }

  // Half-open on the older edge: base age belongs to the younger unit (ICS-style).
  const contains = (e) => ma <= e.startMa && (ma > e.endMa || e.endMa === 0)
  const pick = (rank) => ERAS.find((e) => e.rank === rank && contains(e)) ?? null

  const eon = pick('eon')
  const era = pick('era')
  const period = pick('period')
  const epoch = pick('epoch')
  const age = pick('age')

  const primary = age || epoch || period || era || eon
  const name = [eon?.name, era?.name, period?.name, epoch?.name, age?.name]
    .filter(Boolean)
    .join(' · ')
  const blurb =
    (primary && blurbs[primary.id]) ||
    (epoch && blurbs[epoch.id]) ||
    (period && blurbs[period.id]) ||
    (era && blurbs[era.id]) ||
    (eon && blurbs[eon.id]) ||
    'Geological reconstruction for this age.'

  return {
    ma,
    ybp: normalizeYbp(ybp),
    eon,
    era,
    period,
    epoch,
    age,
    primary,
    label: name || 'Deep time',
    blurb,
    color: primary?.color || '#5a6a7a',
  }
}

export function eraBoundaryAgesMa() {
  const set = new Set()
  for (const e of ERAS) {
    set.add(e.startMa)
    set.add(e.endMa)
  }
  return [...set].sort((a, b) => b - a)
}

/** Periods + eons for legacy full-Earth track labels. */
export function periodsForTrack() {
  return ERAS.filter((e) => e.rank === 'period' || e.rank === 'eon')
}

export { maToYbp }
