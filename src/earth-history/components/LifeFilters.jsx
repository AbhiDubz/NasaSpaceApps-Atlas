import { useEffect, useId, useRef, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { LIFE_TAXON_FILTERS } from '../../services/earthHistory/fetchPbdbLife'
import { searchTaxa } from '../../services/earthHistory/fetchPbdbTaxa'

const DEBOUNCE_MS = 250

export default function LifeFilters() {
  const showLife = useEarthHistoryStore((s) => s.layers.life)
  const lifeTaxonId = useEarthHistoryStore((s) => s.lifeTaxonId)
  const lifeTaxonBaseName = useEarthHistoryStore((s) => s.lifeTaxonBaseName)
  const lifeTaxonLabel = useEarthHistoryStore((s) => s.lifeTaxonLabel)
  const densityMode = useEarthHistoryStore((s) => s.densityMode)
  const setLifeTaxonId = useEarthHistoryStore((s) => s.setLifeTaxonId)
  const setLifeTaxonQuery = useEarthHistoryStore((s) => s.setLifeTaxonQuery)
  const setDensityMode = useEarthHistoryStore((s) => s.setDensityMode)

  const listId = useId()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('idle') // idle | loading | error
  const [activeIndex, setActiveIndex] = useState(-1)
  const abortRef = useRef(null)
  const wrapRef = useRef(null)

  const isCustom =
    Boolean(lifeTaxonBaseName) && !LIFE_TAXON_FILTERS.some((f) => f.id === lifeTaxonId)

  useEffect(() => {
    if (!showLife) return undefined
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions([])
      setStatus('idle')
      return undefined
    }

    const timer = window.setTimeout(() => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setStatus('loading')
      searchTaxa(q, { signal: ac.signal, limit: 8 })
        .then((result) => {
          if (ac.signal.aborted) return
          setSuggestions(result.suggestions || [])
          setStatus(result.ok ? 'idle' : 'error')
          setOpen(true)
          setActiveIndex(-1)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setSuggestions([])
          setStatus('error')
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query, showLife])

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (!showLife) return null

  const selectSuggestion = (s) => {
    setLifeTaxonQuery({
      id: s.oid ? `txn:${s.oid}` : s.name,
      baseName: s.name,
      label: s.label || s.name,
    })
    setQuery('')
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  const clearCustom = () => {
    setLifeTaxonId('all')
    setQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const onKeyDown = (e) => {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(suggestions.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="eh-life-filters" role="group" aria-label="Life taxon filter">
      <div className="eh-life-filters__chips">
        {LIFE_TAXON_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`eh-life-filters__btn${
              !isCustom && lifeTaxonId === f.id ? ' eh-life-filters__btn--on' : ''
            }`}
            aria-pressed={!isCustom && lifeTaxonId === f.id}
            onClick={() => setLifeTaxonId(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className={`eh-life-filters__btn${densityMode ? ' eh-life-filters__btn--on' : ''}`}
          aria-pressed={densityMode}
          title="Cluster localities when zoomed out"
          onClick={() => setDensityMode(!densityMode)}
        >
          Density
        </button>
      </div>

      <div className="eh-taxon-search" ref={wrapRef}>
        <label className="eh-taxon-search__label" htmlFor={`${listId}-input`}>
          Search taxon
        </label>
        <input
          id={`${listId}-input`}
          type="search"
          className="eh-taxon-search__input"
          placeholder="e.g. Tyrannosaurus"
          value={query}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${listId}-list`}
          aria-expanded={open && suggestions.length > 0}
          role="combobox"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (suggestions.length) setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {status === 'loading' && (
          <span className="eh-taxon-search__status" aria-live="polite">
            Searching…
          </span>
        )}
        {open && suggestions.length > 0 && (
          <ul
            id={`${listId}-list`}
            className="eh-taxon-search__list"
            role="listbox"
            aria-label="Taxon suggestions"
          >
            {suggestions.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  className={`eh-taxon-search__opt${i === activeIndex ? ' eh-taxon-search__opt--on' : ''}`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectSuggestion(s)}
                >
                  <span className="eh-taxon-search__name">{s.name}</span>
                  {s.rank && <span className="eh-taxon-search__rank">{s.rank}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isCustom && lifeTaxonLabel && (
        <div className="eh-life-filters__selected">
          <span className="eh-life-filters__chip" title={lifeTaxonBaseName || ''}>
            {lifeTaxonLabel}
          </span>
          <button type="button" className="eh-life-filters__clear" onClick={clearCustom}>
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
