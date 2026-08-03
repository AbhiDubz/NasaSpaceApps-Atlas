import { useEffect, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'

/**
 * Fetch Wikipedia REST summary for a wiki title / selected overlay.
 */
export default function WikipediaPanel() {
  const selectedOverlay = useEarthHistoryStore((s) => s.selectedOverlay)
  const clearSelectedOverlay = useEarthHistoryStore((s) => s.clearSelectedOverlay)
  const [summary, setSummary] = useState(null)
  const [status, setStatus] = useState('idle')

  const wiki =
    selectedOverlay?.wiki ||
    selectedOverlay?.meta?.wiki ||
    selectedOverlay?.meta?.wikipedia ||
    null
  const title = selectedOverlay?.name

  useEffect(() => {
    if (!selectedOverlay) {
      setSummary(null)
      setStatus('idle')
      return undefined
    }

    const page = String(wiki || title || '')
      .replace(/^https?:\/\/en\.wikipedia\.org\/wiki\//i, '')
      .trim()
    if (!page) return undefined

    let cancelled = false
    setStatus('loading')
    setSummary(null)

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      decodeURIComponent(page),
    )}`

    fetch(url, { headers: { Accept: 'application/json' } })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setSummary({
          title: data.title || title,
          extract: data.extract || selectedOverlay?.summary || '',
          thumbnail: data.thumbnail?.source || null,
          url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${page}`,
        })
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setSummary({
          title: title || page,
          extract: selectedOverlay?.summary || 'No Wikipedia summary available.',
          thumbnail: null,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page)}`,
        })
        setStatus('fallback')
      })

    return () => {
      cancelled = true
    }
  }, [wiki, title, selectedOverlay])

  if (!selectedOverlay) return null

  return (
    <div className="eh-wiki" role="complementary" aria-label="Wikipedia summary">
      <div className="eh-wiki__head">
        <p className="eh-wiki__kicker">
          {selectedOverlay.kind === 'polity'
            ? 'Polity'
            : selectedOverlay.kind === 'marker'
              ? selectedOverlay.meta?.kind || 'Marker'
              : selectedOverlay.kind || 'Wikipedia'}
        </p>
        <button type="button" className="eh-wiki__close" onClick={clearSelectedOverlay}>
          Close
        </button>
      </div>
      {status === 'loading' && <p className="eh-wiki__msg">Loading summary…</p>}
      {summary && (
        <>
          <p className="eh-wiki__title">{summary.title}</p>
          {summary.thumbnail && (
            <img className="eh-wiki__thumb" src={summary.thumbnail} alt="" loading="lazy" />
          )}
          <p className="eh-wiki__extract">{summary.extract}</p>
          <a className="eh-wiki__link" href={summary.url} target="_blank" rel="noreferrer">
            Open on Wikipedia
          </a>
        </>
      )}
    </div>
  )
}
