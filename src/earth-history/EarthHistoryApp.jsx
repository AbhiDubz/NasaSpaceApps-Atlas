import { lazy, Suspense, useEffect, useState } from 'react'
import { useEarthHistoryStore } from './store/earthHistoryStore'
import { EH_HISTORY_EVENT } from './core/urlState'
import { loadErasJson, loadKeyframeManifest } from '../services/earthHistory/loadKeyframeManifest'
import EarthHistoryHeader from './components/EarthHistoryHeader'
import ContextCard from './components/ContextCard'
import LayersDrawer from './components/LayersDrawer'
import TimelinePanel from './components/TimelinePanel'
import './styles/earth-history.css'

const EarthHistoryGlobe = lazy(() => import('./components/EarthHistoryGlobe'))

/**
 * Isolated Earth History product shell — no live OSINT / fetchManager.
 */
export default function EarthHistoryApp() {
  const hydrateFromUrl = useEarthHistoryStore((s) => s.hydrateFromUrl)
  const setManifest = useEarthHistoryStore((s) => s.setManifest)
  const setManifestError = useEarthHistoryStore((s) => s.setManifestError)
  const setLoadState = useEarthHistoryStore((s) => s.setLoadState)
  const setErasBlurbs = useEarthHistoryStore((s) => s.setErasBlurbs)
  const setReducedMotion = useEarthHistoryStore((s) => s.setReducedMotion)
  const setColorblindSafe = useEarthHistoryStore((s) => s.setColorblindSafe)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)
  const loadState = useEarthHistoryStore((s) => s.loadState)
  const manifestError = useEarthHistoryStore((s) => s.manifestError)
  const rangeAdjustedBanner = useEarthHistoryStore((s) => s.rangeAdjustedBanner)
  const clearBanner = useEarthHistoryStore((s) => s.clearBanner)
  const [globeReady, setGlobeReady] = useState(false)

  useEffect(() => {
    document.title = 'Earth History · ATLAS'
    document.body.classList.add('earth-history-mode')
    setColorblindSafe(useEarthHistoryStore.getState().colorblindSafe)
    return () => {
      document.body.classList.remove('earth-history-mode')
      document.title = 'ATLAS'
    }
  }, [setColorblindSafe])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [setReducedMotion])

  useEffect(() => {
    hydrateFromUrl()
    setLoadState('loading')
    let cancelled = false
    ;(async () => {
      try {
        const [manifest, eras] = await Promise.all([loadKeyframeManifest(), loadErasJson()])
        if (cancelled) return
        setManifest(manifest)
        setErasBlurbs(eras.blurbs || {})
        syncUrl()
      } catch (err) {
        if (!cancelled) setManifestError(err.message || 'Failed to load Earth History data')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrateFromUrl, setErasBlurbs, setLoadState, setManifest, setManifestError, syncUrl])

  useEffect(() => {
    const onPop = () => hydrateFromUrl()
    window.addEventListener('popstate', onPop)
    window.addEventListener(EH_HISTORY_EVENT, onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(EH_HISTORY_EVENT, onPop)
    }
  }, [hydrateFromUrl])

  return (
    <div className="eh-app">
      <Suspense
        fallback={
          <div className="eh-boot">Loading globe…</div>
        }
      >
        <EarthHistoryGlobe onReady={() => setGlobeReady(true)} />
      </Suspense>

      <div className={`eh-chrome${globeReady ? ' eh-chrome--ready' : ''}`}>
        <EarthHistoryHeader />
        <ContextCard />
        <LayersDrawer />
        <TimelinePanel />
      </div>

      {loadState === 'loading' && !globeReady && (
        <div className="eh-boot eh-boot--overlay">Loading Earth History…</div>
      )}
      {manifestError && (
        <div className="eh-boot eh-boot--error" role="alert">
          {manifestError}
        </div>
      )}
      {rangeAdjustedBanner && (
        <div className="eh-toast" role="status">
          Range in URL was invalid — reset to full Earth history.
          <button type="button" onClick={clearBanner}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
