/**
 * Trend variables read straight from satellite instruments and land models
 * (MODIS, AIRS, OMI, GPM, GLDAS), instead of through NASA POWER.
 *
 * `npm run trend:grids` builds a monthly grid over Washington for each one
 * and saves it as static files in public/trend-grids/. Two NASA services
 * feed the builder:
 *
 *   via 'gibs' — Global Imagery Browse Services. Each product is published
 *     as color-coded map tiles plus a table saying which data value every
 *     color stands for. The builder turns the colors back into values. A
 *     color stands for a small range, so each reading is rounded to the
 *     middle of its range (`step`); averaging many pixels and months makes
 *     that small next to the trends tested. No login needed.
 *
 *   via 'gesdisc' — the Goddard Earth Sciences data center's cloud OPeNDAP
 *     service, which returns the product's own numbers for just the
 *     Washington box. Needs a free NASA Earthdata Login token in
 *     EARTHDATA_TOKEN (.env.local) when building; the app itself never
 *     uses the token.
 *
 * Shared by the builder script, the API route and the browser. Pure JS.
 */
import { WASHINGTON_BBOX } from './washingtonShape.js'

export const GIBS_CREDIT = 'Data: NASA Global Imagery Browse Services (GIBS), part of NASA Earthdata (ESDIS).'
export const GESDISC_CREDIT = 'Data: NASA Goddard Earth Sciences Data and Information Services Center (GES DISC).'
export const GRID_END_YEAR = 2025
export const GRID_NODATA = -32768

/**
 * @typedef {object} InstrumentGridSpec
 * @property {'gibs'|'gesdisc'} via — which NASA service the builder reads
 * @property {string} instrument — who measured or modeled it, for the panel
 * @property {string} first — first month with data, 'YYYY-MM'
 * @property {number} cell — grid cell size in degrees (edges on multiples of it)
 * @property {number} chunkRows — grid rows per static file
 * @property {number} scale — stored integer = value × scale
 * @property {(v: number) => number} [convert] — decoded value → the unit shown
 *
 * via 'gibs':
 * @property {string} [layer] — GIBS layer id
 * @property {'month'|'day'} [cadence] — one tile set per month, or per day (reduced to months by the builder)
 * @property {string} [tileSet] — GIBS tile matrix set
 * @property {number} [level] — zoom level sampled (512-pixel tiles spanning 288° / 2^level)
 * @property {string} [step] — how coarse one decoded reading is
 * @property {'mean'|'wetDays'} [reduce] — how daily tiles become a monthly value
 *
 * via 'gesdisc':
 * @property {string} [collection] — CMR collection concept id
 * @property {(year: string, month: string) => string} [granule] — monthly file name (granule UR)
 * @property {string[]} [fields] — variables read from the file; `convert` receives them in this order
 * @property {string} [group] — HDF group the fields and coordinates live in ('' for none)
 * @property {'lat,lon'|'lon,lat'} [order] — dimension order after time
 * @property {number} [native] — the product's own cell size in degrees
 * @property {[number, number]} [origin] — center of the product's first cell, [lat, lon]
 * @property {number} [fill] — values at or below this are missing
 */

/** @type {Record<string, InstrumentGridSpec>} */
export const INSTRUMENT_GRIDS = {
  NDVI: {
    via: 'gibs',
    layer: 'MODIS_Terra_L3_NDVI_Monthly',
    instrument: 'MODIS on the Terra satellite',
    cadence: 'month',
    tileSet: '1km',
    level: 5,
    first: '2000-03',
    cell: 0.1,
    chunkRows: 2,
    scale: 10000,
    step: '0.01',
    reduce: 'mean',
  },
  LST_DAY: {
    via: 'gibs',
    layer: 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day',
    instrument: 'MODIS on the Terra satellite',
    cadence: 'month',
    tileSet: '2km',
    level: 4,
    first: '2000-03',
    cell: 0.1,
    chunkRows: 2,
    scale: 100,
    step: '0.6 °C',
    reduce: 'mean',
    convert: (kelvin) => kelvin - 273.15,
  },
  CO_500: {
    via: 'gibs',
    layer: 'AIRS_L3_Carbon_Monoxide_500hPa_Volume_Mixing_Ratio_Monthly_Day',
    instrument: 'AIRS on the Aqua satellite',
    cadence: 'month',
    tileSet: '2km',
    level: 3,
    first: '2002-09',
    cell: 1,
    chunkRows: 8,
    scale: 10,
    step: '1.4 ppb',
    reduce: 'mean',
  },
  NO2: {
    via: 'gibs',
    layer: 'OMI_Nitrogen_Dioxide_Tropo_Column',
    instrument: 'OMI on the Aura satellite',
    cadence: 'day',
    tileSet: '2km',
    level: 3,
    first: '2004-10',
    cell: 0.25,
    chunkRows: 8,
    scale: 1000,
    step: '0.1 ×10¹⁵',
    reduce: 'mean',
    convert: (molecules) => molecules / 1e15,
  },
  WET_DAYS: {
    via: 'gibs',
    layer: 'IMERG_Precipitation_Rate',
    instrument: 'the GPM mission (IMERG)',
    cadence: 'day',
    tileSet: '2km',
    level: 4,
    first: '2000-06',
    cell: 0.2,
    chunkRows: 6,
    scale: 100,
    step: '1 day',
    reduce: 'wetDays',
  },
  PRECIP_GPM: {
    via: 'gesdisc',
    collection: 'C2723754851-GES_DISC',
    granule: (y, m) => `GPM_3IMERGM.07:3B-MO.MS.MRG.3IMERG.${y}${m}01-S000000-E235959.${m}.V07B.HDF5`,
    instrument: 'the GPM mission (IMERG Final, version 7)',
    fields: ['precipitation'],
    group: 'Grid',
    order: 'lon,lat',
    native: 0.1,
    origin: [-89.95, -179.95],
    fill: -9000,
    first: '1998-01',
    cell: 0.2,
    chunkRows: 6,
    scale: 500,
    // mm per hour → mm per day
    convert: ([rate]) => rate * 24,
  },
  SOIL_GLDAS: {
    via: 'gesdisc',
    collection: 'C1342986036-GES_DISC',
    granule: (y, m) => `GLDAS_NOAH025_M.2.1:GLDAS_NOAH025_M.A${y}${m}.021.nc4`,
    instrument: 'the GLDAS land model (Noah, version 2.1)',
    fields: ['SoilMoi0_10cm_inst'],
    group: '',
    order: 'lat,lon',
    native: 0.25,
    origin: [-59.875, -179.875],
    fill: -9000,
    first: '2000-01',
    cell: 0.25,
    chunkRows: 8,
    scale: 100,
    convert: ([soil]) => soil,
  },
  RUNOFF: {
    via: 'gesdisc',
    collection: 'C1342986036-GES_DISC',
    granule: (y, m) => `GLDAS_NOAH025_M.2.1:GLDAS_NOAH025_M.A${y}${m}.021.nc4`,
    instrument: 'the GLDAS land model (Noah, version 2.1)',
    fields: ['Qs_acc', 'Qsb_acc'],
    group: '',
    order: 'lat,lon',
    native: 0.25,
    origin: [-59.875, -179.875],
    fill: -9000,
    first: '2000-01',
    cell: 0.25,
    chunkRows: 8,
    scale: 500,
    // Monthly files hold the average 3-hour total: surface runoff + baseflow, × 8 → mm per day.
    convert: ([surface, baseflow]) => (surface + baseflow) * 8,
  },
}

export const INSTRUMENT_GRID_CODES = Object.keys(INSTRUMENT_GRIDS)

/** Credit line for a grid variable, by the NASA service it was built from. */
export function gridCredit(code) {
  return INSTRUMENT_GRIDS[code]?.via === 'gesdisc' ? GESDISC_CREDIT : GIBS_CREDIT
}

const round6 = (v) => Math.round(v * 1e6) / 1e6

/**
 * The grid for one variable: Washington's bounding box pushed out to the
 * nearest cell edges. Row 0 is the southernmost row, column 0 the westernmost.
 */
export function gridLayout(code) {
  const spec = INSTRUMENT_GRIDS[code]
  if (!spec) return null
  const { cell } = spec
  const south = round6(Math.floor(WASHINGTON_BBOX.south / cell + 1e-9) * cell)
  const west = round6(Math.floor(WASHINGTON_BBOX.west / cell + 1e-9) * cell)
  const rows = Math.ceil((WASHINGTON_BBOX.north - south) / cell - 1e-9)
  const cols = Math.ceil((WASHINGTON_BBOX.east - west) / cell - 1e-9)
  return { south, west, cell, rows, cols, chunkRows: spec.chunkRows, chunks: Math.ceil(rows / spec.chunkRows) }
}

/** Row and column of the cell holding a point, or null when it is off the grid. */
export function gridIndex(code, lat, lng) {
  const g = gridLayout(code)
  if (!g) return null
  const row = Math.floor((lat - g.south) / g.cell + 1e-9)
  const col = Math.floor((lng - g.west) / g.cell + 1e-9)
  if (row < 0 || row >= g.rows || col < 0 || col >= g.cols) return null
  return { row, col, chunk: Math.floor(row / g.chunkRows) }
}

/** Static file holding the rows around a point. */
export function gridChunkUrl(code, chunk) {
  return `/trend-grids/${code}_${chunk}.json`
}

/** Every month from a 'YYYY-MM' start through December of the end year. */
export function monthsFrom(first, endYear = GRID_END_YEAR) {
  const out = []
  let y = Number(first.slice(0, 4))
  let m = Number(first.slice(5, 7))
  while (y <= endYear) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function base64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'))
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * Monthly series for one point from a chunk file.
 * Chunk layout: `data` is base64 little-endian int16, ordered row → column → month.
 * @param {object} chunk — parsed public/trend-grids/<CODE>_<n>.json
 * @param {number} lat
 * @param {number} lng
 * @param {string[]} axis — the month labels the caller wants the series aligned to
 * @returns {(number|null)[] | null} null when the point is not in this chunk
 */
export function seriesFromChunk(chunk, lat, lng, axis) {
  const at = gridIndex(chunk.code, lat, lng)
  if (!at) return null
  const row = at.row - chunk.rowStart
  if (row < 0 || row >= chunk.rows) return null
  const bytes = base64ToBytes(chunk.data)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const offset = (row * chunk.cols + at.col) * chunk.months.length
  const byMonth = new Map()
  chunk.months.forEach((ym, i) => {
    const raw = view.getInt16((offset + i) * 2, true)
    byMonth.set(ym, raw === GRID_NODATA ? null : raw / chunk.scale)
  })
  return axis.map((ym) => byMonth.get(ym) ?? null)
}
