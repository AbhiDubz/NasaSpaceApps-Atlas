/**
 * Shared milestone ages for Earth History bake scripts + manifest.
 *
 * - Precambrian (>1800 Ma): illustrative placeholders
 * - Mid-Proterozoic CAO2024 milestones: 1800, 1000, 750 Ma (coastline / GWS bake)
 * - Phanerozoic 0–540 Ma: Scotese & Wright 2018 PaleoDEM at 5 Myr cadence
 * - Holocene keys: 2.58, 0.012 Ma (GWS coastline bake; not on PaleoDEM grid)
 *
 * PaleoDEM attribution (numeric grids only — CC BY 4.0 License.txt on EarthByte FTP).
 * Do NOT redistribute Scotese pre-rendered PaleoAtlas JPEGs.
 */

/** Illustrative Precambrian (no plate model). */
const ILLUSTRATIVE_AGES_MA = [4540, 4000, 3500, 2500]

/** CAO2024 milestones older than PaleoDEM span. */
const CAO_PRE_PALEODEM_AGES_MA = [1800, 1000, 750]

/** Finer Holocene keys between PaleoDEM 5 Ma and present. */
const HOLOCENE_KEYS_MA = [2.58, 0.012]

/**
 * PaleoDEM 0–540 Ma at 5 Myr steps (oldest → youngest, excluding duplicates of 0).
 * @returns {number[]}
 */
export function paleodemAges() {
  const ages = []
  for (let ma = 540; ma >= 0; ma -= 5) ages.push(ma)
  return ages
}

const PALEODEM_AGES_MA = paleodemAges()
const PALEODEM_AGE_SET = new Set(PALEODEM_AGES_MA)

/** Full keyframe list: oldest → youngest. */
export const MILESTONE_AGES_MA = Object.freeze([
  ...ILLUSTRATIVE_AGES_MA,
  ...CAO_PRE_PALEODEM_AGES_MA,
  ...PALEODEM_AGES_MA.filter((a) => a > 0),
  ...HOLOCENE_KEYS_MA,
  0,
])

/** Cao et al. 2024 via GPlates Web Service (coastline bake). */
export const BAKE_MODEL_ID = 'CAO2024'
export const BAKE_MODEL_MAX_MA = 1800
export const BAKE_MODEL_CITATION =
  'Cao et al. (2024), Earth\'s tectonic and plate boundary evolution over 1.8 Ga (Geoscience Frontiers) via GPlates Web Service coastlines. Precambrian frames older than 1800 Ma remain illustrative placeholders.'

/**
 * Scotese & Wright 2018 PaleoDEM numeric grids (lat/lon/elev), CC BY 4.0.
 * Cite when shipping hypsometric textures derived from the grids — not PaleoAtlas imagery.
 */
export const PALEODEM_CITATION =
  'Scotese, C.R., and Wright, N., 2018. PALEOMAP Paleodigital Elevation Models (PaleoDEMS) for the Phanerozoic. https://doi.org/10.5281/zenodo.5460860 (CC BY 4.0 numeric grids; ATLAS hypsometric render — not PaleoAtlas imagery).'

export const PALEODEM_MAX_MA = 540
export const PALEODEM_STEP_MA = 5

export function ageSlug(ageMa) {
  return ageMa === Math.floor(ageMa) ? String(ageMa) : String(ageMa)
}

/** True for ages covered by Scotese & Wright PaleoDEM (0–540 @ 5 Myr). */
export function isPaleodemAge(ageMa) {
  const n = Number(ageMa)
  if (!Number.isFinite(n)) return false
  if (PALEODEM_AGE_SET.has(n)) return true
  // tolerate float noise on the 5 Myr grid
  if (n < -1e-9 || n > PALEODEM_MAX_MA + 1e-6) return false
  const nearest = Math.round(n / PALEODEM_STEP_MA) * PALEODEM_STEP_MA
  return Math.abs(n - nearest) < 1e-6
}

export function isScientificAge(ageMa) {
  return Number(ageMa) <= BAKE_MODEL_MAX_MA + 1e-6
}

/** All scientific milestone ages (CAO2024 span + PaleoDEM + Holocene). */
export function scientificAges() {
  return MILESTONE_AGES_MA.filter(isScientificAge)
}

/**
 * Ages that still use GWS coastline / coastline-raster texture bake.
 * PaleoDEM ages are hypsometric textures from numeric grids — skip GWS for those.
 */
export function gwsBakeAges() {
  return MILESTONE_AGES_MA.filter((a) => isScientificAge(a) && !isPaleodemAge(a))
}

export function illustrativeAges() {
  return MILESTONE_AGES_MA.filter((a) => !isScientificAge(a))
}
