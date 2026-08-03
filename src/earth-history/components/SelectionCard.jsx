import { useEarthHistoryStore } from '../store/earthHistoryStore'
import LocalityDetail from './LocalityDetail'
import WikipediaPanel from './WikipediaPanel'

function isLifeSelection(overlay) {
  return Boolean(
    overlay && (overlay.kind === 'life' || overlay.collectionNo || overlay.meta?.collectionNo),
  )
}

function isWikiSelection(overlay) {
  return Boolean(
    overlay &&
      (overlay.kind === 'marker' ||
        overlay.kind === 'polity' ||
        overlay.wiki ||
        overlay.meta?.wikipedia ||
        overlay.meta?.wiki),
  )
}

/**
 * Globe-click detail. Every selection — fossil locality, marker, polity,
 * ancient place — resolves to this one card inside the drawer.
 */
export default function SelectionCard() {
  const selectedOverlay = useEarthHistoryStore((s) => s.selectedOverlay)
  const clearSelectedOverlay = useEarthHistoryStore((s) => s.clearSelectedOverlay)

  if (!selectedOverlay) return null

  return (
    <div className="eh-selection">
      <button type="button" className="eh-selection__back" onClick={clearSelectedOverlay}>
        ‹ Back
      </button>
      <div className="eh-drawer__scroll">
        {isLifeSelection(selectedOverlay) ? (
          <LocalityDetail />
        ) : isWikiSelection(selectedOverlay) ? (
          <WikipediaPanel />
        ) : (
          <div className="eh-selection__place">
            <p className="eh-selection__kind">Place</p>
            <p className="eh-selection__name">{selectedOverlay.name}</p>
            {selectedOverlay.summary && (
              <p className="eh-selection__summary">{selectedOverlay.summary}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
