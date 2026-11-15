import { describe, expect, it } from 'vitest'
import {
  INSTRUMENT_GRIDS,
  INSTRUMENT_GRID_CODES,
  GRID_NODATA,
  gridChunkUrl,
  gridCredit,
  gridIndex,
  gridLayout,
  monthsFrom,
  seriesFromChunk,
} from '../instrumentGrids.js'
import { gridChunkFor, gridTrend } from '../instrumentTrend.js'
import { buildMonthAxis } from '../fetchPower.js'
import { isGridVariable, POWER_API_CODES, POWER_VARIABLES } from '../variables.js'

/** A grid file like the builder writes, with `fill(row, col, monthIndex)` giving each value (or null). */
function chunkFile(code, chunk, fill) {
  const g = gridLayout(code)
  const spec = INSTRUMENT_GRIDS[code]
  const months = monthsFrom(spec.first)
  const rowStart = chunk * g.chunkRows
  const rows = Math.min(g.chunkRows, g.rows - rowStart)
  const data = new Int16Array(rows * g.cols * months.length)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      for (let m = 0; m < months.length; m++) {
        const v = fill(rowStart + r, c, m)
        data[(r * g.cols + c) * months.length + m] = v == null ? GRID_NODATA : Math.round(v * spec.scale)
      }
    }
  }
  return { code, rowStart, rows, cols: g.cols, scale: spec.scale, months, data: Buffer.from(data.buffer).toString('base64') }
}

describe('instrument grids', () => {
  it('every grid variable is in the catalog and kept off the NASA POWER API', () => {
    for (const code of INSTRUMENT_GRID_CODES) {
      expect(POWER_VARIABLES[code]?.provider).toBe('grid')
      expect(isGridVariable(code)).toBe(true)
      expect(POWER_API_CODES).not.toContain(code)
    }
    expect(isGridVariable('T2M')).toBe(false)
  })

  it('credits the NASA service each variable was built from', () => {
    expect(gridCredit('NDVI')).toMatch(/GIBS/)
    expect(gridCredit('RUNOFF')).toMatch(/GES DISC/)
    // Monthly runoff files hold the average 3-hour total of surface runoff and baseflow.
    expect(INSTRUMENT_GRIDS.RUNOFF.convert([0.05, 0.2])).toBeCloseTo(2, 9)
    expect(INSTRUMENT_GRIDS.PRECIP_GPM.convert([0.1])).toBeCloseTo(2.4, 9)
  })

  it('lays the grid over Washington on whole cell edges', () => {
    expect(gridLayout('NDVI')).toMatchObject({ south: 45.5, west: -124.8, cell: 0.1, rows: 35, cols: 79, chunks: 18 })
    expect(gridLayout('CO_500')).toMatchObject({ south: 45, west: -125, cell: 1, rows: 4, cols: 9, chunks: 1 })
    expect(gridLayout('NO2')).toMatchObject({ south: 45.5, west: -124.75, cell: 0.25, rows: 14, cols: 32 })
    expect(gridLayout('PRECIP_GPM')).toMatchObject({ south: 45.4, west: -124.8, cell: 0.2, rows: 18, cols: 40 })
    expect(gridLayout('T2M')).toBeNull()
  })

  it('finds the cell and file for a point', () => {
    // Seattle: 47.61°N is the 22nd 0.1° row above 45.5°N; 122.33°W is the 25th column east of 124.8°W.
    expect(gridIndex('NDVI', 47.61, -122.33)).toEqual({ row: 21, col: 24, chunk: 10 })
    expect(gridChunkFor('NDVI', 47.61, -122.33)).toBe(10)
    expect(gridChunkUrl('NDVI', 10)).toBe('/trend-grids/NDVI_10.json')
    // A cell edge belongs to the cell above / to the east of it.
    expect(gridIndex('NDVI', 47.6, -122.3)).toEqual({ row: 21, col: 25, chunk: 10 })
    expect(gridIndex('NDVI', 44, -122.33)).toBeNull()
    expect(gridChunkFor('NDVI', 47.61, -110)).toBeNull()
  })

  it('lists months through the end year', () => {
    const months = monthsFrom('2004-10', 2005)
    expect(months[0]).toBe('2004-10')
    expect(months.at(-1)).toBe('2005-12')
    expect(months).toHaveLength(15)
  })

  it('reads one cell from a grid file and lines it up with the shared month axis', () => {
    const at = gridIndex('NDVI', 47.61, -122.33)
    const file = chunkFile('NDVI', at.chunk, (row, col, m) => (row === at.row && col === at.col ? (m === 3 ? null : 0.5 + m / 1000) : 0.1))
    const axis = buildMonthAxis()
    const values = seriesFromChunk(file, 47.61, -122.33, axis)
    expect(values).toHaveLength(axis.length)
    expect(values[axis.indexOf('2000-02')]).toBeNull() // before the record starts
    expect(values[axis.indexOf('2000-03')]).toBeCloseTo(0.5, 4)
    expect(values[axis.indexOf('2000-06')]).toBeNull() // a missing month
    expect(values[axis.indexOf('2025-12')]).toBeCloseTo(0.809, 3)
    // The neighboring cell is a different series; a point in another file is not here at all.
    expect(seriesFromChunk(file, 47.61, -122.45, axis)[axis.indexOf('2010-01')]).toBeCloseTo(0.1, 4)
    expect(seriesFromChunk(file, 46.25, -122.17, axis)).toBeNull()
  })

  it('runs the same trend test as the NASA POWER variables', () => {
    const at = gridIndex('NDVI', 46.25, -122.17)
    // Greening by 0.06 per decade on top of a seasonal cycle.
    const file = chunkFile('NDVI', at.chunk, (row, col, m) => 0.3 + 0.1 * Math.sin((2 * Math.PI * m) / 12) + (0.06 / 120) * m)
    const out = gridTrend(file, { code: 'NDVI', lat: 46.25, lng: -122.17 })
    expect(out).toMatchObject({ variable: 'NDVI', lat: 46.25, lng: -122.17, elevation: null, significant: true, direction: 'rising' })
    expect(out.slopePerDecade).toBeCloseTo(0.06, 2)
    expect(out.firstMonth).toBe('2000-03')
    expect(out.verdict).toMatch(/^Land getting greener: 0\.0\d+ per decade, statistically significant/)
    expect(out.credit).toMatch(/GIBS/)
    expect(out.seasons).toHaveLength(4)
    const summer = gridTrend(file, { code: 'NDVI', lat: 46.25, lng: -122.17, season: 'summer' })
    expect(summer).toMatchObject({ season: 'summer', step: 'year' })
    expect(() => gridTrend(file, { code: 'NDVI', lat: 47.61, lng: -122.33 })).toThrow(/no satellite record/)
  })
})
