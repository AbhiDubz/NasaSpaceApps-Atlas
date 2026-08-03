/**
 * PBDB quick diversity curve for the life panel.
 * Docs: https://paleobiodb.org/data1.2/occs/quickdiv
 */

import { ehCacheGet, ehCacheSet } from './ehResponseCache.js'
import { PBDB_MAX_SUPPORTED_MA } from './fetchPbdbLife.js'

const QUICKDIV_URL = 'https://paleobiodb.org/data1.2/occs/quickdiv.json'

/**
 * @typedef {{ maxMa: number, minMa: number, sampled: number, nOccs: number, name?: string }} DiversityBin
 */

/**
 * @param {{ baseName?: string | null, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ ok: true, bins: DiversityBin[] } | { ok: false, reason: string }>}
 */
export async function fetchPbdbDiversity(opts = {}) {
  const baseName = opts.baseName || null
  const cacheKey = `pbdb:quickdiv:v1:${baseName || 'all'}`

  const cached = await ehCacheGet(cacheKey)
  if (cached?.bins?.length) {
    return { ok: true, bins: cached.bins }
  }

  const url = new URL(QUICKDIV_URL)
  url.searchParams.set('min_ma', '0')
  url.searchParams.set('max_ma', String(PBDB_MAX_SUPPORTED_MA))
  url.searchParams.set('count', 'genera')
  url.searchParams.set('vocab', 'pbdb')
  if (baseName) url.searchParams.set('base_name', baseName)

  let res
  try {
    res = await fetch(url.toString(), {
      method: 'GET',
      signal: opts.signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return { ok: false, reason: err.message || 'Diversity network error' }
  }
  if (!res.ok) {
    return { ok: false, reason: `PBDB quickdiv HTTP ${res.status}` }
  }

  const data = await res.json()
  const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
  const bins = records
    .map((r) => ({
      maxMa: Number(r.max_ma ?? r.eag),
      minMa: Number(r.min_ma ?? r.lag),
      sampled: Number(r.sampled_in_bin ?? r.dsb ?? 0),
      nOccs: Number(r.n_occs ?? r.noc ?? 0),
      name: String(r.interval_name ?? r.nam ?? ''),
    }))
    .filter((b) => Number.isFinite(b.maxMa) && Number.isFinite(b.minMa))
    .sort((a, b) => b.maxMa - a.maxMa)

  if (bins.length) {
    await ehCacheSet(cacheKey, { bins }, { ttlMs: 14 * 24 * 60 * 60 * 1000 })
  }
  return { ok: true, bins }
}

/**
 * Build an SVG polyline path for diversity bins (older → younger left→right).
 * @param {DiversityBin[]} bins
 * @param {{ width?: number, height?: number, pad?: number }} [opts]
 */
export function diversitySparkPath(bins, opts = {}) {
  const width = opts.width ?? 280
  const height = opts.height ?? 48
  const pad = opts.pad ?? 4
  if (!bins?.length) return { path: '', max: 0, markerX: null }

  const values = bins.map((b) => b.sampled || b.nOccs || 0)
  const max = Math.max(1, ...values)
  const n = bins.length
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  // bins are older→younger; plot left=older
  const pts = bins.map((b, i) => {
    const x = pad + (i / Math.max(1, n - 1)) * innerW
    const v = b.sampled || b.nOccs || 0
    const y = pad + innerH - (v / max) * innerH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return { path: `M ${pts.join(' L ')}`, max, width, height }
}

/**
 * X position (0–1) of playhead on the diversity spark for a given age.
 * @param {DiversityBin[]} bins
 * @param {number} ageMa
 */
export function diversityPlayheadU(bins, ageMa) {
  if (!bins?.length) return 0
  const oldest = bins[0].maxMa
  const youngest = bins[bins.length - 1].minMa
  if (oldest === youngest) return 0
  const t = Math.min(oldest, Math.max(youngest, Number(ageMa) || 0))
  return (oldest - t) / (oldest - youngest)
}
