/**
 * What the map should draw for an open Trend Detective case: the study-region
 * border and, for each chosen place, the NASA POWER grid cell its data covers.
 * Shared by all three renderers (Globe.GL, Google globe, flat map).
 */
import { useMemo } from 'react'
import { useAtlasStore } from '../store/atlasStore'
import { gridCell, gridCellRing } from '../services/nasaPower/grid.js'

/** Place colors, shared with the case-file panel (first place, comparison place). */
export const TREND_PLACE_COLORS = ['#38bdf8', '#fb923c']

/**
 * @returns {{ regionOn: boolean, cells: { key: string, ring: number[][], color: string }[] }}
 */
export function useTrendOverlays() {
  const trendCase = useAtlasStore((s) => s.trendCase)
  const places = trendCase?.places
  const variable = trendCase?.variable
  const open = Boolean(trendCase)

  return useMemo(() => {
    if (!open) return { regionOn: false, cells: [] }
    const cells = (places || []).map((p, i) => {
      const cell = gridCell(p.lat, p.lng, variable)
      return {
        key: `${i}:${cell.west},${cell.south},${cell.dLng}`,
        ring: gridCellRing(cell),
        color: TREND_PLACE_COLORS[i] || TREND_PLACE_COLORS[0],
      }
    })
    return { regionOn: true, cells }
  }, [open, places, variable])
}
