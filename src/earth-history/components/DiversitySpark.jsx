import { useEffect, useMemo, useRef } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { ybpToMa } from '../core/timeScale'
import {
  diversityPlayheadU,
  diversitySparkPath,
  fetchPbdbDiversity,
} from '../../services/earthHistory/fetchPbdbDiversity'

/**
 * Quick genera-diversity curve for the active life taxon filter.
 */
export default function DiversitySpark() {
  const showLife = useEarthHistoryStore((s) => s.layers.life)
  const lifeTaxonBaseName = useEarthHistoryStore((s) => s.lifeTaxonBaseName)
  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const diversityBins = useEarthHistoryStore((s) => s.diversityBins)
  const diversityStatus = useEarthHistoryStore((s) => s.diversityStatus)
  const setDiversityLoading = useEarthHistoryStore((s) => s.setDiversityLoading)
  const setDiversityResult = useEarthHistoryStore((s) => s.setDiversityResult)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!showLife) {
      setDiversityResult(null)
      return undefined
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setDiversityLoading()
    fetchPbdbDiversity({ baseName: lifeTaxonBaseName, signal: ac.signal })
      .then((result) => {
        if (!ac.signal.aborted) setDiversityResult(result)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setDiversityResult({ ok: false, reason: err.message })
      })
    return () => ac.abort()
  }, [showLife, lifeTaxonBaseName, setDiversityLoading, setDiversityResult])

  const spark = useMemo(() => diversitySparkPath(diversityBins), [diversityBins])
  const u = diversityPlayheadU(diversityBins, ybpToMa(playheadYbp))
  const markerX = spark.width != null ? 4 + u * (spark.width - 8) : null

  if (!showLife) return null

  return (
    <div className="eh-divspark" aria-label="Fossil diversity over time">
      <div className="eh-divspark__head">
        <span className="eh-divspark__title">Genera diversity</span>
        <span className="eh-divspark__meta">
          {diversityStatus === 'loading' && 'Loading…'}
          {diversityStatus === 'ready' && spark.max > 0 && `peak ${spark.max}`}
          {diversityStatus === 'error' && 'Unavailable'}
        </span>
      </div>
      {diversityStatus === 'ready' && spark.path ? (
        <svg
          className="eh-divspark__svg"
          viewBox={`0 0 ${spark.width} ${spark.height}`}
          role="img"
          aria-hidden
        >
          <path d={spark.path} fill="none" stroke="rgba(226, 232, 240, 0.75)" strokeWidth="1.4" />
          {markerX != null && (
            <line
              x1={markerX}
              x2={markerX}
              y1={2}
              y2={spark.height - 2}
              stroke="rgba(0, 207, 255, 0.85)"
              strokeWidth="1.2"
            />
          )}
        </svg>
      ) : (
        <div className="eh-divspark__placeholder" />
      )}
      <div className="eh-divspark__ends" aria-hidden>
        <span>540 Ma</span>
        <span>Present</span>
      </div>
    </div>
  )
}
