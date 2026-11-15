/**
 * NASA POWER hooks.
 *
 *   useNasaPower({ lat, lng, vars? }) → clean monthly series for a point
 *   useTrend({ lat, lng, variable, season? }) → deseasonalized series + trend test
 *   useTrendScan({ lat, lng })        → the trend test for every variable at a point
 *
 * The first two return `{ data, loading, error }`. Saved demo places load from static
 * JSON in /trend-demos first, so they work without the live API. Instrument
 * variables (MODIS, AIRS, OMI, GPM, GLDAS) never touch the API: their grids
 * are static files, and the trend test runs in the browser.
 *
 * A season test is worked out in the browser from the whole-year record that
 * is already loaded (same statistics module as the API), so switching
 * seasons needs no new request and works for saved cases offline.
 */
import { useEffect, useMemo, useState } from 'react'
import { demoCacheUrl, isCachedDemo } from '../services/nasaPower/demos.js'
import { analyzeTrend, seasonById } from '../services/nasaPower/trendStats.js'
import { isGridVariable, POWER_VARIABLE_CODES } from '../services/nasaPower/variables.js'
import { gridChunkUrl } from '../services/nasaPower/instrumentGrids.js'
import { gridChunkFor, gridTrend, NO_GRID_DATA_MESSAGE } from '../services/nasaPower/instrumentTrend.js'

/** @type {Map<string, Promise<object>>} */
const memo = new Map()

async function getJson(url, signal) {
  const res = await fetch(url, { signal })
  const type = res.headers.get('content-type') || ''
  if (!type.includes('json')) throw new Error('The trend service is unavailable.')
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
  return body
}

function cachedJson(url) {
  let p = memo.get(url)
  if (!p) {
    p = getJson(url)
    memo.set(url, p)
    p.catch(() => memo.delete(url))
  }
  return p
}

function useAsync(key, loader) {
  const [state, setState] = useState({ key: null, data: null, error: null })

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    loader()
      .then((data) => alive && setState({ key, data, error: null }))
      .catch((err) => alive && setState({ key, data: null, error: err?.message || 'Could not load data.' }))
    return () => {
      alive = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = state.key === key
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(key) && !current,
  }
}

export function useNasaPower({ lat, lng, vars } = {}) {
  const ok = Number.isFinite(lat) && Number.isFinite(lng)
  const varList = Array.isArray(vars) ? vars.join(',') : vars || ''
  const url = ok ? `/api/nasa-power?lat=${lat}&lng=${lng}${varList ? `&vars=${varList}` : ''}` : null
  return useAsync(url, () => cachedJson(url))
}

const trendUrl = (lat, lng, variable) => `/api/trend?lat=${lat}&lng=${lng}&var=${variable}`

/** Trend results worked out in the browser from the static instrument grids. */
const gridMemo = new Map()

function loadGridTrend(lat, lng, variable) {
  const key = `${variable}:${lat},${lng}`
  let p = gridMemo.get(key)
  if (!p) {
    const chunk = gridChunkFor(variable, lat, lng)
    p =
      chunk == null
        ? Promise.reject(new Error(NO_GRID_DATA_MESSAGE))
        : cachedJson(gridChunkUrl(variable, chunk)).then((file) => gridTrend(file, { code: variable, lat, lng }))
    gridMemo.set(key, p)
    p.catch(() => gridMemo.delete(key))
  }
  return p
}

/**
 * Whole-year trend result for one variable: the static grid for instrument
 * variables, else the saved copy when there is one, else the live API.
 */
function loadTrend(lat, lng, variable) {
  if (isGridVariable(variable)) return loadGridTrend(lat, lng, variable)
  const live = () => cachedJson(trendUrl(lat, lng, variable))
  if (!isCachedDemo(lat, lng, variable)) return live()
  return cachedJson(demoCacheUrl(lat, lng, variable)).catch(live)
}

export function useTrend({ lat, lng, variable, season = 'all' } = {}) {
  const ok = Number.isFinite(lat) && Number.isFinite(lng) && Boolean(variable)
  const year = useAsync(ok ? trendUrl(lat, lng, variable) : null, () => loadTrend(lat, lng, variable))

  const data = useMemo(() => {
    const whole = year.data
    if (!whole || !seasonById(season)) return whole
    // Keeps the whole-year extras (place, season scan) and swaps in the season's test.
    return { ...whole, ...analyzeTrend({ code: variable, months: whole.months, values: whole.values, season }) }
  }, [year.data, season, variable])

  return { ...year, data }
}

const EMPTY_SCAN = {}

/**
 * Test every variable at one point. Returns `{ [code]: { data } | { error } }`,
 * filling in as each result arrives; a missing code is still loading.
 * Shares its requests with useTrend, so opening a variable afterwards is instant.
 */
export function useTrendScan({ lat, lng } = {}) {
  const key = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : null
  const [state, setState] = useState({ key: null, results: {} })

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    for (const code of POWER_VARIABLE_CODES) {
      loadTrend(lat, lng, code)
        .then(
          (data) => ({ data }),
          (err) => ({ error: err?.message || 'Could not load data.' }),
        )
        .then((result) => {
          if (!alive) return
          setState((s) => ({ key, results: { ...(s.key === key ? s.results : {}), [code]: result } }))
        })
    }
    return () => {
      alive = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return state.key === key ? state.results : EMPTY_SCAN
}
