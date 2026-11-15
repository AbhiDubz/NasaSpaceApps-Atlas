/**
 * "What is changing here?" — one line per variable for a place, built from
 * the same trend results the case file shows. Pure, no I/O.
 *
 * The user should not have to guess which variable to test: the scan tests
 * all of them and puts the ones that are changing first.
 */
import { POWER_VARIABLE_CODES } from './variables.js'
import { seasonById } from './trendStats.js'

/**
 * @typedef {object} ScanRow
 * @property {string} code
 * @property {'loading'|'error'|'short'|'ready'} status — 'short' = too little data to test
 * @property {number} [slopePerDecade]
 * @property {number} [pValue]
 * @property {boolean} [significant]
 * @property {'rising'|'falling'|'flat'} [direction]
 * @property {{ rising: string, falling: string } | null} [opposite] — seasons that
 *   trend in opposite directions (whole-year scan only)
 * @property {string} [error]
 */

/** Changing first, then hidden seasonal flips, then no trend, then nothing to test. */
function rank(row) {
  if (row.status !== 'ready') return 3
  if (row.significant) return 0
  return row.opposite ? 1 : 2
}

/**
 * @param {Record<string, { data?: object, error?: string } | undefined>} results —
 *   whole-year trend result per variable code; a missing entry is still loading
 * @param {string} [season] — 'all', or a season id to report that season's test
 * @returns {{ rows: ScanRow[], done: number, total: number, complete: boolean, significantCount: number, hiddenCount: number }}
 */
export function summarizeScan(results, season = 'all') {
  const chosen = seasonById(season)
  const rows = POWER_VARIABLE_CODES.map((code) => {
    const r = results?.[code]
    if (!r) return { code, status: 'loading' }
    if (r.error || !r.data) return { code, status: 'error', error: r.error || 'Could not load data.' }
    const test = chosen ? r.data.seasons?.find((s) => s.id === chosen.id) : r.data
    if (!test || test.slopePerDecade == null) return { code, status: 'short' }
    const opp = chosen ? null : r.data.oppositeSeasons
    return {
      code,
      status: 'ready',
      slopePerDecade: test.slopePerDecade,
      pValue: test.pValue,
      significant: Boolean(test.significant),
      direction: test.direction,
      opposite: opp ? { rising: opp.rising, falling: opp.falling } : null,
    }
  })

  const done = rows.filter((r) => r.status !== 'loading').length
  const complete = done === rows.length
  // Keep the catalog order while results arrive, so rows do not jump around.
  if (complete) {
    const order = new Map(rows.map((r, i) => [r.code, i]))
    rows.sort((a, b) => rank(a) - rank(b) || (a.pValue ?? 1) - (b.pValue ?? 1) || order.get(a.code) - order.get(b.code))
  }

  return {
    rows,
    done,
    total: rows.length,
    complete,
    significantCount: rows.filter((r) => r.significant).length,
    hiddenCount: rows.filter((r) => r.status === 'ready' && !r.significant && r.opposite).length,
  }
}
