import { useEffect, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import {
  PBDB_CITATION,
  fetchCollectionOccurrences,
  fetchMacrostratAtPoint,
  fetchPhylopicThumb,
} from '../../services/earthHistory/fetchPbdbLocality'

function isLifeOverlay(overlay) {
  if (!overlay) return false
  if (overlay.kind === 'life') return true
  if (overlay.collectionNo) return true
  if (overlay.meta?.collectionNo) return true
  return false
}

export default function LocalityDetail() {
  const selectedOverlay = useEarthHistoryStore((s) => s.selectedOverlay)
  const clearSelectedOverlay = useEarthHistoryStore((s) => s.clearSelectedOverlay)
  const [occurrences, setOccurrences] = useState([])
  const [occStatus, setOccStatus] = useState('idle')
  const [occMessage, setOccMessage] = useState(null)
  const [bedrock, setBedrock] = useState([])
  const [bedrockStatus, setBedrockStatus] = useState('idle')

  const meta = selectedOverlay?.meta || selectedOverlay || {}
  const collectionNo = selectedOverlay?.collectionNo || meta.collectionNo || null
  const name = selectedOverlay?.name || meta.name || 'Locality'
  const modernLat = meta.modernLat
  const modernLng = meta.modernLng

  useEffect(() => {
    if (!isLifeOverlay(selectedOverlay) || !collectionNo) {
      setOccurrences([])
      setOccStatus('idle')
      setOccMessage(null)
      return undefined
    }

    const ac = new AbortController()
    setOccStatus('loading')
    setOccMessage(null)
    fetchCollectionOccurrences(collectionNo, { signal: ac.signal })
      .then((result) => {
        if (ac.signal.aborted) return
        if (result.ok) {
          setOccurrences(result.occurrences || [])
          setOccStatus('ready')
        } else {
          setOccurrences([])
          setOccStatus('error')
          setOccMessage(result.reason || 'Could not load occurrences')
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setOccurrences([])
        setOccStatus('error')
        setOccMessage(err.message || 'Could not load occurrences')
      })

    return () => ac.abort()
  }, [selectedOverlay, collectionNo])

  useEffect(() => {
    const lat = Number(modernLat)
    const lng = Number(modernLng)
    if (!isLifeOverlay(selectedOverlay) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setBedrock([])
      setBedrockStatus('idle')
      return undefined
    }

    const ac = new AbortController()
    setBedrockStatus('loading')
    fetchMacrostratAtPoint(lat, lng, { signal: ac.signal })
      .then((result) => {
        if (ac.signal.aborted) return
        if (result.ok) {
          setBedrock(result.units || [])
          setBedrockStatus('ready')
        } else {
          setBedrock([])
          setBedrockStatus('error')
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setBedrock([])
        setBedrockStatus('error')
      })

    return () => ac.abort()
  }, [selectedOverlay, modernLat, modernLng])

  if (!isLifeOverlay(selectedOverlay)) return null

  return (
    <div className="eh-locality" aria-label="Fossil locality detail">
      <div className="eh-locality__head">
        <p className="eh-locality__kind">Locality</p>
        <button type="button" className="eh-locality__clear" onClick={clearSelectedOverlay}>
          Clear
        </button>
      </div>
      <p className="eh-locality__name">{name}</p>
      {collectionNo && (
        <p className="eh-locality__meta">PBDB collection {collectionNo}</p>
      )}
      {(Number.isFinite(Number(meta.paleoLat)) || Number.isFinite(Number(modernLat))) && (
        <p className="eh-locality__meta">
          {Number.isFinite(Number(meta.paleoLat)) && (
            <>
              Paleo {Number(meta.paleoLat).toFixed(1)}°, {Number(meta.paleoLng).toFixed(1)}°
            </>
          )}
          {Number.isFinite(Number(modernLat)) && (
            <>
              {Number.isFinite(Number(meta.paleoLat)) ? ' · ' : ''}
              Modern {Number(modernLat).toFixed(1)}°, {Number(modernLng).toFixed(1)}°
            </>
          )}
        </p>
      )}

      <div className="eh-locality__section">
        <p className="eh-locality__section-title">Taxa</p>
        {occStatus === 'loading' && <p className="eh-locality__hint">Loading occurrences…</p>}
        {occStatus === 'error' && (
          <p className="eh-locality__hint">{occMessage || 'Unavailable'}</p>
        )}
        {occStatus === 'ready' && occurrences.length === 0 && (
          <p className="eh-locality__hint">No occurrences returned.</p>
        )}
        {occurrences.length > 0 && (
          <ul className="eh-locality__taxa">
            {occurrences.slice(0, 40).map((occ) => (
              <li key={occ.id} className="eh-locality__taxon">
                <img
                  className="eh-locality__thumb"
                  src={occ.thumbUrl || fetchPhylopicThumb(occ.taxonOid)}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span>
                  <span className="eh-locality__taxon-name">{occ.name}</span>
                  {(occ.rank || occ.phylum) && (
                    <span className="eh-locality__taxon-meta">
                      {[occ.rank, occ.phylum].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {occurrences.length > 40 && (
          <p className="eh-locality__hint">+{occurrences.length - 40} more</p>
        )}
      </div>

      {bedrockStatus === 'ready' && bedrock.length > 0 && (
        <div className="eh-locality__section">
          <p className="eh-locality__section-title">Bedrock (modern)</p>
          <ul className="eh-locality__bedrock">
            {bedrock.map((u, i) => (
              <li key={`${u.name}-${i}`}>
                {u.name}
                {u.interval ? ` · ${u.interval}` : ''}
                {u.lith ? ` · ${u.lith}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="eh-locality__cite">{PBDB_CITATION}</p>
    </div>
  )
}
