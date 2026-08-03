import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { NARRATIVE_TOURS, getTourById } from '../core/narrativeTours'

/**
 * Narrative tour picker + transport. The dwell/advance engine runs in
 * TimelinePanel so tours keep playing while this UI is closed.
 */
export default function TourControls() {
  const reducedMotion = useEarthHistoryStore((s) => s.reducedMotion)
  const activeTourId = useEarthHistoryStore((s) => s.activeTourId)
  const tourChapterIndex = useEarthHistoryStore((s) => s.tourChapterIndex)
  const tourPlaying = useEarthHistoryStore((s) => s.tourPlaying)
  const startTour = useEarthHistoryStore((s) => s.startTour)
  const stopTour = useEarthHistoryStore((s) => s.stopTour)
  const setTourPlaying = useEarthHistoryStore((s) => s.setTourPlaying)

  if (reducedMotion) return null

  const active = getTourById(activeTourId)
  const total = active?.chapters.length ?? 0

  return (
    <div className="eh-tours">
      <div className="eh-tours__list" role="group" aria-label="Narrative tours">
        {NARRATIVE_TOURS.map((tour) => (
          <button
            key={tour.id}
            type="button"
            className={`eh-tours__btn${activeTourId === tour.id ? ' eh-tours__btn--active' : ''}`}
            title={tour.summary}
            onClick={() => startTour(tour.id)}
          >
            {tour.name}
          </button>
        ))}
      </div>

      {active && (
        <div className="eh-tours__status">
          <span className="eh-tours__progress">
            {Math.min(tourChapterIndex + 1, total)}/{total}
          </span>
          <button
            type="button"
            className="eh-tours__ctrl"
            onClick={() => setTourPlaying(!tourPlaying)}
            aria-pressed={tourPlaying}
          >
            {tourPlaying ? 'Pause tour' : 'Resume'}
          </button>
          <button type="button" className="eh-tours__ctrl" onClick={stopTour}>
            End
          </button>
        </div>
      )}
    </div>
  )
}
