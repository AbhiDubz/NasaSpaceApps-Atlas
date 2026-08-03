/**
 * Chaptered narrative tours — jump/dwell between curated milestones.
 */

import { DEEP_TIME_EVENTS, eventYbp } from './eventsCatalog.js'
import { maToYbp, normalizeYbp } from './timeScale.js'

/**
 * @typedef {{
 *   id: string,
 *   eventId?: string,
 *   ageMa?: number,
 *   title: string,
 *   note: string,
 *   dwellMs: number,
 * }} TourChapter
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   summary: string,
 *   rangeStartMa: number,
 *   rangeEndMa: number,
 *   chapters: TourChapter[],
 * }} NarrativeTour
 */

/** @type {NarrativeTour[]} */
export const NARRATIVE_TOURS = Object.freeze([
  {
    id: 'big-five',
    name: 'The Big Five',
    summary: 'Five mass extinctions that reshaped Phanerozoic life.',
    rangeStartMa: 460,
    rangeEndMa: 0,
    chapters: [
      {
        id: 'bf-ord',
        eventId: 'ordovician-extinction',
        title: 'Late Ordovician',
        note: 'Icehouse pulses and marine extinctions open the Big Five story.',
        dwellMs: 4500,
      },
      {
        id: 'bf-dev',
        eventId: 'devonian-extinction',
        title: 'Late Devonian',
        note: 'Reef systems collapse across pulsed crises.',
        dwellMs: 4500,
      },
      {
        id: 'bf-pt',
        eventId: 'permian-triassic',
        title: 'End-Permian',
        note: 'The greatest Phanerozoic die-off — Pangea world, stressed biosphere.',
        dwellMs: 5500,
      },
      {
        id: 'bf-tj',
        eventId: 'triassic-jurassic',
        title: 'Triassic–Jurassic',
        note: 'Another turnover clears niches as dinosaurs rise.',
        dwellMs: 4500,
      },
      {
        id: 'bf-kt',
        eventId: 'kt-extinction',
        title: 'End-Cretaceous',
        note: 'Impact + volcanism end the non-avian dinosaurs.',
        dwellMs: 5500,
      },
    ],
  },
  {
    id: 'to-humans',
    name: 'Path to humanity',
    summary: 'From early mammals after the K–Pg to cities and industry.',
    rangeStartMa: 70,
    rangeEndMa: 0,
    chapters: [
      {
        id: 'th-kt',
        eventId: 'kt-extinction',
        title: 'After the impact',
        note: 'Mammals inherit emptied niches in a remade world.',
        dwellMs: 4000,
      },
      {
        id: 'th-hom',
        eventId: 'hominins',
        title: 'Early hominins',
        note: 'African origins of the human lineage.',
        dwellMs: 4500,
      },
      {
        id: 'th-sap',
        eventId: 'homo-sapiens',
        title: 'Homo sapiens',
        note: 'Anatomically modern humans appear and later disperse.',
        dwellMs: 4500,
      },
      {
        id: 'th-lgm',
        eventId: 'lgm',
        title: 'Ice age Earth',
        note: 'Last Glacial Maximum — coastlines and climates far from today.',
        dwellMs: 4000,
      },
      {
        id: 'th-ag',
        eventId: 'agriculture',
        title: 'Farming begins',
        note: 'Neolithic food production reshapes landscapes and demography.',
        dwellMs: 4000,
      },
      {
        id: 'th-city',
        eventId: 'urban-bronze',
        title: 'Cities & states',
        note: 'Urban civilizations and writing networks emerge.',
        dwellMs: 4000,
      },
      {
        id: 'th-ind',
        eventId: 'industrial',
        title: 'Industrial age',
        note: 'Fossil energy accelerates planetary change.',
        dwellMs: 4000,
      },
    ],
  },
  {
    id: 'deep-life',
    name: 'Deep life',
    summary: 'Milestones from early microbes to animal radiation.',
    rangeStartMa: 3600,
    rangeEndMa: 500,
    chapters: [
      {
        id: 'dl-life',
        eventId: 'origin-life',
        title: 'Earliest life',
        note: 'Microbial biosphere in an Archean ocean world.',
        dwellMs: 5000,
      },
      {
        id: 'dl-ox',
        eventId: 'great-oxidation',
        title: 'Oxygen rises',
        note: 'The Great Oxidation Event remakes surface chemistry.',
        dwellMs: 5000,
      },
      {
        id: 'dl-edi',
        eventId: 'ediacara',
        title: 'Ediacaran biota',
        note: 'Soft-bodied macro-life before the Cambrian.',
        dwellMs: 4500,
      },
      {
        id: 'dl-cam',
        eventId: 'cambrian-explosion',
        title: 'Cambrian radiation',
        note: 'Animal body plans diversify in the seas.',
        dwellMs: 5000,
      },
    ],
  },
  {
    id: 'path-to-present',
    name: 'Path to the present',
    summary: 'From Cambrian seas through Pangaea and K–Pg to Holocene civilizations.',
    rangeStartMa: 540,
    rangeEndMa: 0,
    chapters: [
      {
        id: 'ptp-cam',
        eventId: 'cambrian-explosion',
        title: 'Cambrian seas',
        note: 'Animal body plans radiate in warm, high-CO₂ oceans.',
        dwellMs: 5000,
      },
      {
        id: 'ptp-plants',
        eventId: 'first-land-plants',
        title: 'Life on land',
        note: 'Embryophytes begin greening the continents.',
        dwellMs: 4500,
      },
      {
        id: 'ptp-pangaea',
        eventId: 'pangaea',
        title: 'Pangaea',
        note: 'A single supercontinent reshapes climate and evolution.',
        dwellMs: 4500,
      },
      {
        id: 'ptp-kpg',
        eventId: 'kt-extinction',
        title: 'K–Pg boundary',
        note: 'Chicxulub impact and Deccan volcanism end the Mesozoic world.',
        dwellMs: 5500,
      },
      {
        id: 'ptp-lgm',
        eventId: 'lgm',
        title: 'Ice-age Earth',
        note: 'Last Glacial Maximum — ice sheets and lowered seas.',
        dwellMs: 4000,
      },
      {
        id: 'ptp-ag',
        eventId: 'agriculture',
        title: 'Early agriculture',
        note: 'Farming transforms landscapes and demography.',
        dwellMs: 4000,
      },
      {
        id: 'ptp-rome',
        ageMa: 0.002,
        title: 'Rome & classical world',
        note: 'Mediterranean empires link Afro-Eurasian exchange networks (~0 CE).',
        dwellMs: 4500,
      },
      {
        id: 'ptp-1000',
        ageMa: 0.001,
        title: 'World at 1000 CE',
        note: 'Song, Abbasid, Byzantine, and Mesoamerican worlds at the millennium.',
        dwellMs: 4500,
      },
    ],
  },
])

/**
 * Resolve a chapter to absolute YBP + display copy.
 * @param {TourChapter} chapter
 */
export function resolveChapter(chapter) {
  if (chapter.eventId) {
    const event = DEEP_TIME_EVENTS.find((e) => e.id === chapter.eventId)
    if (event) {
      return {
        ybp: eventYbp(event),
        eventId: event.id,
        title: chapter.title || event.name,
        note: chapter.note,
        dwellMs: chapter.dwellMs,
      }
    }
  }
  const ageMa = Number(chapter.ageMa)
  return {
    ybp: normalizeYbp(maToYbp(ageMa)),
    eventId: null,
    title: chapter.title,
    note: chapter.note,
    dwellMs: chapter.dwellMs,
  }
}

export function getTourById(id) {
  return NARRATIVE_TOURS.find((t) => t.id === id) || null
}

/**
 * @param {NarrativeTour} tour
 * @returns {{ startYbp: number, endYbp: number }}
 */
export function tourRangeYbp(tour) {
  return {
    startYbp: normalizeYbp(maToYbp(tour.rangeStartMa)),
    endYbp: normalizeYbp(maToYbp(tour.rangeEndMa)),
  }
}
