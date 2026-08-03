import { useCallback, useEffect, useState } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { formatDeepTime, ybpToMa } from '../core/timeScale'
import { formatHolocenePlayhead } from '../core/calendarYear'

const STORAGE_KEY = 'atlas.eh.savedViews'

function readViews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeViews(views) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views))
  } catch {
    /* ignore quota */
  }
}

/**
 * Save / load named Earth History camera+playhead views.
 */
export default function SavedViews() {
  const playheadYbp = useEarthHistoryStore((s) => s.playheadYbp)
  const rangeStartYbp = useEarthHistoryStore((s) => s.rangeStartYbp)
  const rangeEndYbp = useEarthHistoryStore((s) => s.rangeEndYbp)
  const camera = useEarthHistoryStore((s) => s.camera)
  const layers = useEarthHistoryStore((s) => s.layers)
  const lifeTaxonId = useEarthHistoryStore((s) => s.lifeTaxonId)
  const densityBoost = useEarthHistoryStore((s) => s.densityMode)
  const polityDimension = useEarthHistoryStore((s) => s.polityDimension)
  const colorblindSafe = useEarthHistoryStore((s) => s.colorblindSafe)
  const setPlayheadYbp = useEarthHistoryStore((s) => s.setPlayheadYbp)
  const setRange = useEarthHistoryStore((s) => s.setRange)
  const setCamera = useEarthHistoryStore((s) => s.setCamera)
  const setLayer = useEarthHistoryStore((s) => s.setLayer)
  const setLifeTaxonId = useEarthHistoryStore((s) => s.setLifeTaxonId)
  const setDensityBoost = useEarthHistoryStore((s) => s.setDensityBoost)
  const setPolityDimension = useEarthHistoryStore((s) => s.setPolityDimension)
  const setColorblindSafe = useEarthHistoryStore((s) => s.setColorblindSafe)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)

  const [views, setViews] = useState([])
  const [name, setName] = useState('')

  useEffect(() => {
    setViews(readViews())
  }, [])

  const save = useCallback(() => {
    const label =
      name.trim() ||
      formatHolocenePlayhead(playheadYbp) ||
      formatDeepTime(playheadYbp) ||
      `${ybpToMa(playheadYbp)} Ma`
    const view = {
      id: `v_${Date.now().toString(36)}`,
      name: label,
      playheadYbp,
      rangeStartYbp,
      rangeEndYbp,
      camera: { ...camera },
      layers: { ...layers },
      lifeTaxonId,
      densityBoost,
      polityDimension,
      colorblindSafe,
      savedAt: Date.now(),
    }
    const next = [view, ...views].slice(0, 24)
    setViews(next)
    writeViews(next)
    setName('')
  }, [
    name,
    playheadYbp,
    rangeStartYbp,
    rangeEndYbp,
    camera,
    layers,
    lifeTaxonId,
    densityBoost,
    polityDimension,
    colorblindSafe,
    views,
  ])

  const load = useCallback(
    (view) => {
      if (!view) return
      if (view.rangeStartYbp != null && view.rangeEndYbp != null) {
        setRange(view.rangeStartYbp, view.rangeEndYbp)
      }
      if (view.playheadYbp != null) setPlayheadYbp(view.playheadYbp)
      if (view.camera) setCamera(view.camera)
      if (view.layers) {
        for (const [k, v] of Object.entries(view.layers)) setLayer(k, v)
      }
      if (view.lifeTaxonId) setLifeTaxonId(view.lifeTaxonId)
      if (view.densityBoost != null) setDensityBoost(view.densityBoost)
      if (view.polityDimension) setPolityDimension(view.polityDimension)
      if (view.colorblindSafe != null) setColorblindSafe(view.colorblindSafe)
      syncUrl()
    },
    [
      setRange,
      setPlayheadYbp,
      setCamera,
      setLayer,
      setLifeTaxonId,
      setDensityBoost,
      setPolityDimension,
      setColorblindSafe,
      syncUrl,
    ],
  )

  const remove = useCallback(
    (id) => {
      const next = views.filter((v) => v.id !== id)
      setViews(next)
      writeViews(next)
    },
    [views],
  )

  return (
    <div className="eh-saved">
      <div className="eh-saved__body">
        <div className="eh-saved__form">
          <input
            className="eh-saved__input"
            type="text"
            placeholder="Name this view"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={48}
          />
          <button type="button" className="eh-saved__btn" onClick={save}>
            Save
          </button>
        </div>
        {views.length === 0 && <p className="eh-saved__empty">No saved views yet.</p>}
        <ul className="eh-saved__list">
          {views.map((v) => (
            <li key={v.id} className="eh-saved__item">
              <button type="button" className="eh-saved__load" onClick={() => load(v)}>
                {v.name}
              </button>
              <button
                type="button"
                className="eh-saved__del"
                aria-label={`Delete ${v.name}`}
                onClick={() => remove(v.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
