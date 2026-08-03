import { useEffect, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { maToYbp } from '../core/timeScale'
import { LIFE_TAXON_FILTERS } from '../../services/earthHistory/fetchPbdbLife'
import { fetchTaxonInfo, PBDB_TAXON_CITATION } from '../../services/earthHistory/fetchPbdbTaxa'

export default function TaxonCard() {
  const showLife = useEarthHistoryStore((s) => s.layers.life)
  const lifeTaxonId = useEarthHistoryStore((s) => s.lifeTaxonId)
  const lifeTaxonBaseName = useEarthHistoryStore((s) => s.lifeTaxonBaseName)
  const lifeTaxonLabel = useEarthHistoryStore((s) => s.lifeTaxonLabel)
  const setRange = useEarthHistoryStore((s) => s.setRange)
  const setPlayheadYbp = useEarthHistoryStore((s) => s.setPlayheadYbp)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)

  const [info, setInfo] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState(null)

  const isPreset = LIFE_TAXON_FILTERS.some((f) => f.id === lifeTaxonId)
  const isCustom = Boolean(lifeTaxonBaseName) && !isPreset
  const queryName = lifeTaxonBaseName

  useEffect(() => {
    if (!showLife || !queryName || !isCustom) {
      setInfo(null)
      setStatus('idle')
      setMessage(null)
      return undefined
    }

    const ac = new AbortController()
    setStatus('loading')
    setMessage(null)
    fetchTaxonInfo(lifeTaxonId?.startsWith('txn:') ? lifeTaxonId : queryName, {
      signal: ac.signal,
    })
      .then((result) => {
        if (ac.signal.aborted) return
        if (result.ok && result.info) {
          setInfo(result.info)
          setStatus('ready')
        } else {
          setInfo(null)
          setStatus('error')
          setMessage(result.reason || 'Taxon unavailable')
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setInfo(null)
        setStatus('error')
        setMessage(err.message || 'Taxon unavailable')
      })

    return () => ac.abort()
  }, [showLife, queryName, lifeTaxonId, isCustom])

  if (!showLife || !isCustom || !queryName) return null

  const snapToRange = () => {
    if (!info?.firstMa && info?.firstMa !== 0) return
    const first = Number(info.firstMa)
    const last = Number.isFinite(Number(info.lastMa)) ? Number(info.lastMa) : 0
    const startYbp = maToYbp(Math.max(first, last))
    const endYbp = maToYbp(Math.min(first, last))
    const ok = setRange(startYbp, endYbp)
    if (!ok) return
    const mid = Math.round((startYbp + endYbp) / 2)
    setPlayheadYbp(mid)
    syncUrl()
  }

  const rangeLabel =
    info?.firstMa != null
      ? `${info.firstMa}${info.lastMa != null ? ` → ${info.lastMa}` : ''} Ma`
      : null

  return (
    <div className="eh-taxon-card" aria-label="Selected taxon">
      <p className="eh-taxon-card__kicker">Taxon</p>
      <p className="eh-taxon-card__name">{info?.name || lifeTaxonLabel || queryName}</p>
      {(info?.rank || status === 'loading') && (
        <p className="eh-taxon-card__rank">
          {status === 'loading' ? 'Loading range…' : info.rank}
          {info?.attribution ? ` · ${info.attribution}` : ''}
        </p>
      )}
      {status === 'error' && <p className="eh-taxon-card__hint">{message}</p>}
      {rangeLabel && (
        <p className="eh-taxon-card__range">
          Stratigraphic range · {rangeLabel}
          {(info.earlyInterval || info.lateInterval) && (
            <span>
              {' '}
              (
              {[info.earlyInterval, info.lateInterval].filter(Boolean).join('–')})
            </span>
          )}
        </p>
      )}
      {info?.firstMa != null && (
        <button type="button" className="eh-taxon-card__snap" onClick={snapToRange}>
          Snap timeline to range
        </button>
      )}
      <p className="eh-taxon-card__cite">{PBDB_TAXON_CITATION}</p>
    </div>
  )
}
