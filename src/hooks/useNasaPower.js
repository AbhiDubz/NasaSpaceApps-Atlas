/**
 * NASA POWER hooks.
 *
 *   useNasaPower({ lat, lng, vars? }) → clean monthly series for a point
 *   useTrend({ lat, lng, variable, season? }) → deseasonalized series + trend test
 *
 * Both return `{ data, loading, error }`. Saved demo places load from static
 * JSON in /trend-demos first, so they work without the live API.
 *
 * A season test is worked out in the browser from the whole-year record that
 * is already loaded (same statistics module as the API), so switching
 * seasons needs no new request and works for saved cases offline.
 */
import { useEffect, useMemo, useState } from 'react'
import { demoCacheUrl, isCachedDemo } from '../services/nasaPower/demos.js'
import { analyzeTrend, seasonById } from '../services/nasaPower/trendStats.js'

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

export function useTrend({ lat, lng, variable, season = 'all' } = {}) {
  const ok = Number.isFinite(lat) && Number.isFinite(lng) && Boolean(variable)
  const url = ok ? `/api/trend?lat=${lat}&lng=${lng}&var=${variable}` : null
  const year = useAsync(url, async () => {
    if (isCachedDemo(lat, lng, variable)) {
      try {
        return await cachedJson(demoCacheUrl(lat, lng, variable))
      } catch {
        /* fall through to the live API */
      }
    }
    return cachedJson(url)
  })

  const data = useMemo(() => {
    const whole = year.data
    if (!whole || !seasonById(season)) return whole
    // Keeps the whole-year extras (place, season scan) and swaps in the season's test.
    return { ...whole, ...analyzeTrend({ code: variable, months: whole.months, values: whole.values, season }) }
  }, [year.data, season, variable])

  return { ...year, data }
}
