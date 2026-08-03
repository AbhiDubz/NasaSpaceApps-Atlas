import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { EARTH_BIRTH_YBP, formatDeepTime } from '../core/timeScale'
import { matchViewPreset, VIEW_PRESETS } from '../core/layerRegistry'
import { getTourById } from '../core/narrativeTours'
import { DEFAULT_LAYERS } from '../core/urlState'

/**
 * The visible counterpart to progressive disclosure: any non-default state a
 * closed panel left behind shows here as a removable chip, so the globe never
 * looks wrong for an invisible reason.
 */
export default function ActiveFilterChips() {
  const lifeTaxonId = useEarthHistoryStore((s) => s.lifeTaxonId)
  const lifeTaxonLabel = useEarthHistoryStore((s) => s.lifeTaxonLabel)
  const showLife = useEarthHistoryStore((s) => s.layers.life)
  const activeTourId = useEarthHistoryStore((s) => s.activeTourId)
  const rangeStartYbp = useEarthHistoryStore((s) => s.rangeStartYbp)
  const rangeEndYbp = useEarthHistoryStore((s) => s.rangeEndYbp)
  const layers = useEarthHistoryStore((s) => s.layers)
  const setLifeTaxonId = useEarthHistoryStore((s) => s.setLifeTaxonId)
  const stopTour = useEarthHistoryStore((s) => s.stopTour)
  const setRange = useEarthHistoryStore((s) => s.setRange)
  const setDrawer = useEarthHistoryStore((s) => s.setDrawer)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)

  const chips = []

  if (showLife && lifeTaxonId && lifeTaxonId !== 'all') {
    chips.push({
      id: 'taxon',
      label: lifeTaxonLabel || lifeTaxonId,
      remove: () => {
        setLifeTaxonId('all')
        syncUrl()
      },
    })
  }

  const tour = getTourById(activeTourId)
  if (tour) {
    chips.push({
      id: 'tour',
      label: `Tour · ${tour.name}`,
      remove: () => {
        stopTour()
        syncUrl()
      },
    })
  }

  const fullRange = rangeStartYbp === EARTH_BIRTH_YBP && rangeEndYbp === 0
  if (!fullRange) {
    chips.push({
      id: 'range',
      label: `${formatDeepTime(rangeStartYbp)} – ${formatDeepTime(rangeEndYbp)}`,
      remove: () => {
        setRange(EARTH_BIRTH_YBP, 0)
        syncUrl()
      },
    })
  }

  const layersDiffer = Object.keys(DEFAULT_LAYERS).some(
    (key) => Boolean(layers[key]) !== Boolean(DEFAULT_LAYERS[key]),
  )
  if (layersDiffer) {
    const preset = matchViewPreset(layers)
    const presetLabel = VIEW_PRESETS.find((p) => p.id === preset)?.label
    chips.push({
      id: 'layers',
      label: presetLabel || 'Custom layers',
      open: () => setDrawer(true, 'layers'),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="eh-chips" role="group" aria-label="Active filters">
      {chips.map((chip) =>
        chip.remove ? (
          <span key={chip.id} className="eh-chips__chip">
            {chip.label}
            <button
              type="button"
              className="eh-chips__x"
              aria-label={`Clear ${chip.label}`}
              onClick={chip.remove}
            >
              ×
            </button>
          </span>
        ) : (
          <button key={chip.id} type="button" className="eh-chips__chip eh-chips__chip--link" onClick={chip.open}>
            {chip.label}
          </button>
        ),
      )}
    </div>
  )
}
