/**
 * Trend Detective — news tips.
 *
 * Uses ATLAS's GDELT news layer to suggest which NASA variable to test.
 * GDELT only suggests where to look; the trend test never uses news data.
 */
import { useEffect, useMemo, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { useAtlasStore } from '../../store/atlasStore'
import { findCountryAtPointAsync } from '../../services/countryIndex'
import { fetchDocArticles } from '../../services/gdelt/analyticsService'
import { POWER_VARIABLES } from '../../services/nasaPower/variables.js'
import { newsTipQuery, tipsForCountry, tipsFromHeadlines, topNewsTips } from '../../services/nasaPower/newsTips.js'
import { cn } from '../../lib/utils'

const BTN =
  'inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3! py-1.5! text-sm transition-colors'
const BTN_IDLE = 'border-line bg-surface text-muted hover:text-text'
const BTN_ACTIVE = 'border-accent-border bg-accent-dim text-accent'
const CARD = 'flex flex-col gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3! py-3!'

const GDELT_NOTE = 'News tips: the GDELT Project. Tips only suggest where to look; every verdict uses NASA data alone.'

function TipHeader() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
      <Newspaper className="h-4 w-4" aria-hidden="true" />
      Tip from the news
    </p>
  )
}

/** Country under a point, or null over open ocean. */
function useCountryAt(lat, lng) {
  const [state, setState] = useState({ key: null, country: null })
  const key = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat},${lng}` : null

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    findCountryAtPointAsync(lat, lng)
      .then((country) => alive && setState({ key, country: country || null }))
      .catch(() => alive && setState({ key, country: null }))
    return () => {
      alive = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  return state.key === key ? state.country : null
}

/** Recent weather-themed headlines mentioning a country (one best-effort GDELT search). */
function useCountryHeadlines(countryName) {
  const [state, setState] = useState({ name: null, titles: [] })

  useEffect(() => {
    const query = newsTipQuery(countryName)
    if (!query) return undefined
    const ctrl = new AbortController()
    let retryTimer = null
    const load = (attemptsLeft) =>
      fetchDocArticles(query, '7d', { maxrecords: 50, signal: ctrl.signal, priority: 'interactive' })
        .then((articles) => {
          if (ctrl.signal.aborted) return
          setState({ name: countryName, titles: (articles || []).map((a) => a?.title).filter(Boolean) })
        })
        .catch(() => {
          // GDELT allows one request every 5 seconds and ATLAS polls it too:
          // try once more, then rely on tips from the live feed.
          if (attemptsLeft > 0 && !ctrl.signal.aborted) retryTimer = setTimeout(() => load(attemptsLeft - 1), 15_000)
        })
    load(1)
    return () => {
      clearTimeout(retryTimer)
      ctrl.abort()
    }
  }, [countryName])

  return state.name === countryName ? state.titles : []
}

/** Tips for the country the open case sits in. */
export function PlaceNewsTips({ place, variable, onPickVariable }) {
  const events = useAtlasStore((s) => s.events)
  const country = useCountryAt(place?.lat, place?.lng)
  const searchTitles = useCountryHeadlines(country?.name)

  const tips = useMemo(() => {
    if (!country) return []
    const fromFeed = tipsForCountry(events, country.iso)
    return tipsFromHeadlines(searchTitles, fromFeed)
  }, [events, country, searchTitles])

  if (!country || tips.length === 0) return null

  return (
    <div className="flex flex-col gap-2" aria-label="News tips">
      {tips.map((tip) => (
        <div key={tip.theme} className={CARD}>
          <TipHeader />
          <p className="text-sm leading-normal text-text">
            {tip.count} recent headlines about {country.name} mention {tip.label}. Does the long-term record agree? Try testing:
          </p>
          <div className="flex flex-wrap gap-2">
            {tip.variables.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={variable === code}
                className={cn(BTN, variable === code ? BTN_ACTIVE : BTN_IDLE)}
                onClick={() => onPickVariable(code)}
              >
                {POWER_VARIABLES[code].label}
              </button>
            ))}
          </div>
          {tip.headline ? <p className="text-sm leading-normal text-muted">For example: “{tip.headline}”</p> : null}
        </div>
      ))}
      <p className="text-sm leading-normal text-muted">{GDELT_NOTE}</p>
    </div>
  )
}

/** Strongest tips anywhere in the live feed, shown before a place is chosen. */
export function GlobalNewsTips({ onOpen }) {
  const events = useAtlasStore((s) => s.events)
  const tips = useMemo(() => topNewsTips(events, 3), [events])
  const [names, setNames] = useState({})

  useEffect(() => {
    let alive = true
    Promise.all(
      tips.map((t) =>
        findCountryAtPointAsync(t.lat, t.lng)
          .then((c) => [t.iso, c?.name || t.iso])
          .catch(() => [t.iso, t.iso]),
      ),
    ).then((pairs) => alive && setNames(Object.fromEntries(pairs)))
    return () => {
      alive = false
    }
  }, [tips])

  if (tips.length === 0) return null

  return (
    <div className={CARD} aria-label="News tips">
      <TipHeader />
      {tips.map((tip) => {
        const code = tip.variables[0]
        const name = names[tip.iso] || tip.iso
        return (
          <button
            key={`${tip.iso}-${tip.theme}`}
            type="button"
            className={cn(BTN, BTN_IDLE, 'h-auto w-full flex-col items-start gap-0 whitespace-normal py-2! text-left')}
            onClick={() => onOpen({ lat: tip.lat, lng: tip.lng, label: name, variable: code })}
          >
            <span className="text-base text-text">
              {name}: {tip.count} headlines mention {tip.label}
            </span>
            <span className="text-sm text-muted">Test {POWER_VARIABLES[code].label.toLowerCase()} there</span>
          </button>
        )
      })}
      <p className="text-sm leading-normal text-muted">{GDELT_NOTE}</p>
    </div>
  )
}
