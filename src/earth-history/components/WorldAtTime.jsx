import { useEffect, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { ybpToMa } from '../core/timeScale'
import { fetchAlmanacAtAge } from '../../services/earthHistory/fetchAlmanac'

function fmt(n, digits = 0) {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(digits, 1) : 0,
  })
}

function RangeRow({ label, unit, range, digits = 0 }) {
  if (!range) return null
  return (
    <div className="eh-almanac__row">
      <span className="eh-almanac__label">{label}</span>
      <span className="eh-almanac__value">
        {fmt(range.mid, digits)}
        {unit}
        <span className="eh-almanac__range">
          ({fmt(range.low, digits)}–{fmt(range.high, digits)})
        </span>
      </span>
    </div>
  )
}

function ScalarRow({ label, unit, value, digits = 1 }) {
  if (!Number.isFinite(value)) return null
  return (
    <div className="eh-almanac__row">
      <span className="eh-almanac__label">{label}</span>
      <span className="eh-almanac__value">
        {fmt(value, digits)}
        {unit}
      </span>
    </div>
  )
}

/**
 * “World at this time” Earth-system almanac — the drawer's WORLD tab.
 */
export default function WorldAtTime() {
  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const scrubbing = useEarthHistoryStore((s) => s.scrubbing)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (scrubbing) return undefined
    const ageMa = ybpToMa(playheadYbp)
    let cancelled = false
    const timer = window.setTimeout(() => {
      fetchAlmanacAtAge(ageMa)
        .then((r) => {
          if (!cancelled) setResult(r)
        })
        .catch(() => {
          if (!cancelled) setResult({ ok: false, reason: 'Almanac load failed.' })
        })
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [playheadYbp, scrubbing])

  const v = result?.ok ? result.values : null

  return (
    <div className="eh-almanac">
      {!result?.ok && (
        <p className="eh-almanac__msg">{result?.reason || 'Loading almanac…'}</p>
      )}
      {v && (
        <div className="eh-almanac__body">
          <RangeRow label="CO₂" unit=" ppm" range={v.co2Ppm} digits={0} />
          <RangeRow label="O₂" unit="%" range={v.o2Pct} digits={1} />
          <RangeRow label="ΔT" unit=" °C" range={v.tempC} digits={1} />
          <ScalarRow label="Day length" unit=" h" value={v.dayLengthHours} digits={1} />
          <ScalarRow label="Days / year" unit="" value={v.daysPerYear} digits={0} />
          <ScalarRow label="Sea level" unit=" m" value={v.seaLevelM} digits={0} />
          <ScalarRow label="⁸⁷Sr/⁸⁶Sr" unit="" value={v.srRatio} digits={5} />
          {result.citations?.length > 0 && (
            <details className="eh-almanac__cites">
              <summary>Citations</summary>
              <ul>
                {result.citations.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </details>
          )}
          <p className="eh-almanac__note">
            Illustrative interpolated ranges — not peer-reviewed reconstructions.
          </p>
        </div>
      )}
    </div>
  )
}
