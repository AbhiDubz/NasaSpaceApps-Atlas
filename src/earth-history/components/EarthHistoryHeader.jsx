import { AtlasWordmark } from '../../components/UI/AtlasWordmark'
import { useEarthHistoryStore } from '../store/earthHistoryStore'

export default function EarthHistoryHeader() {
  const drawerOpen = useEarthHistoryStore((s) => s.drawerOpen)
  const toggleDrawer = useEarthHistoryStore((s) => s.toggleDrawer)

  const goLive = () => {
    window.location.href = '/'
  }

  return (
    <header className="eh-header">
      <div className="eh-header__brand">
        <button
          type="button"
          className="eh-header__wordmark"
          onClick={goLive}
          aria-label="ATLAS home"
        >
          <AtlasWordmark className="eh-header__logo" />
        </button>
        <p className="eh-header__product">Earth History</p>
      </div>

      <div className="eh-header__actions">
        <a className="eh-header__link" href="/">
          Live ATLAS
        </a>
        <button
          type="button"
          className={`eh-header__layers${drawerOpen ? ' eh-header__layers--on' : ''}`}
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
          onClick={() => toggleDrawer()}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
            <path
              d="M8 2 14 5 8 8 2 5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              fill="none"
            />
            <path
              d="m2 8.5 6 3 6-3M2 12l6 3 6-3"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Layers
        </button>
      </div>
    </header>
  )
}
