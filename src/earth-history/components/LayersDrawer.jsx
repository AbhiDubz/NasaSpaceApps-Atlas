import { useEffect, useRef } from 'react'
import { useEarthHistoryStore } from '../store/earthHistoryStore'
import { LAYER_REGISTRY, VIEW_PRESETS, matchViewPreset } from '../core/layerRegistry'
import { GWS_MODEL_CITATION, GWS_MODEL_ID } from '../../services/earthHistory/fetchPaleocoastlines'
import { PBDB_CITATION } from '../../services/earthHistory/fetchPbdbLife'
import { MACROSTRAT_CITATION } from '../../services/earthHistory/fetchMacrostratGeology'
import { CIV_CITATION } from '../core/civilizationPlaces'
import { NEOTOMA_CITATION } from '../../services/earthHistory/fetchNeotomaSites'
import { POLITY_CITATION } from '../../services/earthHistory/fetchHistoricalPolities'
import LayerRow from './LayerRow'
import LifeFilters from './LifeFilters'
import TaxonCard from './TaxonCard'
import ExportMenu from './ExportMenu'
import WorldAtTime from './WorldAtTime'
import SelectionCard from './SelectionCard'

const POLITY_DIMENSIONS = [
  { id: 'ruler', label: 'Ruler' },
  { id: 'religion', label: 'Religion' },
  { id: 'culture', label: 'Culture' },
  { id: 'population', label: 'Population' },
]

function PresetRow() {
  const layers = useEarthHistoryStore((s) => s.layers)
  const setLayer = useEarthHistoryStore((s) => s.setLayer)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)
  const active = matchViewPreset(layers)

  const applyPreset = (preset) => {
    for (const [key, value] of Object.entries(preset.layers)) setLayer(key, value)
    syncUrl()
  }

  return (
    <div className="eh-drawer__presets" role="group" aria-label="View presets">
      {VIEW_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`eh-drawer__preset${active === p.id ? ' eh-drawer__preset--on' : ''}`}
          aria-pressed={active === p.id}
          onClick={() => applyPreset(p)}
        >
          {p.label}
        </button>
      ))}
      {active === 'custom' && (
        <span className="eh-drawer__preset eh-drawer__preset--custom" aria-hidden>
          Custom
        </span>
      )}
    </div>
  )
}

function CivSubOptions() {
  const polityDimension = useEarthHistoryStore((s) => s.polityDimension)
  const setPolityDimension = useEarthHistoryStore((s) => s.setPolityDimension)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)

  return (
    <div className="eh-dim" role="group" aria-label="Polity dimension">
      <span className="eh-dim__label">Map by</span>
      <div className="eh-dim__opts">
        {POLITY_DIMENSIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`eh-dim__btn${polityDimension === opt.id ? ' eh-dim__btn--on' : ''}`}
            aria-pressed={polityDimension === opt.id}
            onClick={() => {
              setPolityDimension(opt.id)
              syncUrl()
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Sources() {
  const manifest = useEarthHistoryStore((s) => s.manifest)
  const layers = useEarthHistoryStore((s) => s.layers)
  const coastlineStatus = useEarthHistoryStore((s) => s.coastlineStatus)
  const coastlineAgeMa = useEarthHistoryStore((s) => s.coastlineAgeMa)
  const coastlineSource = useEarthHistoryStore((s) => s.coastlineSource)
  const lifeStatus = useEarthHistoryStore((s) => s.lifeStatus)
  const lifeAgeMa = useEarthHistoryStore((s) => s.lifeAgeMa)
  const lifeCount = useEarthHistoryStore((s) => s.lifeCount)
  const geologyStatus = useEarthHistoryStore((s) => s.geologyStatus)
  const geologyAgeMa = useEarthHistoryStore((s) => s.geologyAgeMa)
  const geologyCount = useEarthHistoryStore((s) => s.geologyCount)
  const civilizationStatus = useEarthHistoryStore((s) => s.civilizationStatus)
  const civilizationCount = useEarthHistoryStore((s) => s.civilizationCount)
  const polityStatus = useEarthHistoryStore((s) => s.polityStatus)
  const polityCount = useEarthHistoryStore((s) => s.polityCount)
  const polityYear = useEarthHistoryStore((s) => s.polityYear)
  const neotomaStatus = useEarthHistoryStore((s) => s.neotomaStatus)
  const neotomaAgeMa = useEarthHistoryStore((s) => s.neotomaAgeMa)
  const neotomaCount = useEarthHistoryStore((s) => s.neotomaCount)
  const neotomaSource = useEarthHistoryStore((s) => s.neotomaSource)

  const lines = []
  lines.push(manifest?.reconstructionLabel || 'Illustrative reconstruction')
  if (manifest?.modelCitation) lines.push(manifest.modelCitation)
  if (layers.coastlines && coastlineStatus === 'ready') {
    lines.push(
      `${coastlineSource === 'local' ? 'Local bake' : 'GWS'} coastlines · ${GWS_MODEL_ID} @ ${coastlineAgeMa} Ma`,
    )
    lines.push(GWS_MODEL_CITATION)
  }
  if (layers.life && lifeStatus === 'ready') {
    lines.push(`PBDB life · ${lifeCount} occs @ ~${lifeAgeMa} Ma`)
    lines.push(PBDB_CITATION)
  }
  if (layers.geology && geologyStatus === 'ready') {
    lines.push(`Macrostrat geology · ${geologyCount} columns @ ~${geologyAgeMa} Ma`)
    lines.push(MACROSTRAT_CITATION)
  }
  if (layers.civilization && civilizationStatus === 'ready') {
    lines.push(`Civilization places · ${civilizationCount} active`)
    lines.push(CIV_CITATION)
  }
  if (layers.civilization && polityStatus === 'ready') {
    lines.push(`Cliopatria polities · ${polityCount} @ ${polityYear}`)
    lines.push(POLITY_CITATION)
  }
  if (layers.neotoma && neotomaStatus === 'ready') {
    lines.push(
      `Neotoma · ${neotomaCount} sites @ ~${neotomaAgeMa} Ma${
        neotomaSource === 'fallback' ? ' (offline sample)' : ''
      }`,
    )
    lines.push(NEOTOMA_CITATION)
  }
  lines.push(
    'Starfield: NASA SVS “An Elsewhere Starfield” (randomized Tycho-2 / Gaia DR2)',
  )
  lines.push('NASA Scientific Visualization Studio — https://svs.gsfc.nasa.gov/4856')

  return (
    <details className="eh-drawer__sources">
      <summary>Sources &amp; citations</summary>
      <div className="eh-drawer__source-lines">
        {lines.map((line, i) => (
          <p key={`${i}-${line.slice(0, 24)}`}>{line}</p>
        ))}
      </div>
    </details>
  )
}

function LayersTab() {
  const lifeTaxonId = useEarthHistoryStore((s) => s.lifeTaxonId)
  const isCustomTaxon = lifeTaxonId !== 'all' && lifeTaxonId != null

  return (
    <div className="eh-drawer__scroll">
      <PresetRow />
      <div className="eh-drawer__layers">
        {LAYER_REGISTRY.map((layer) => (
          <LayerRow key={layer.id} layer={layer}>
            {layer.id === 'life' ? (
              <>
                <LifeFilters />
                {isCustomTaxon && <TaxonCard />}
                <ExportMenu />
              </>
            ) : layer.id === 'civilization' ? (
              <CivSubOptions />
            ) : null}
          </LayerRow>
        ))}
      </div>
      <Sources />
    </div>
  )
}

/**
 * Right-side drawer behind the single Layers button. Two tabs — LAYERS and
 * WORLD — and globe-click selections overlay it as one predictable card.
 */
export default function LayersDrawer() {
  const drawerOpen = useEarthHistoryStore((s) => s.drawerOpen)
  const drawerTab = useEarthHistoryStore((s) => s.drawerTab)
  const selectedOverlay = useEarthHistoryStore((s) => s.selectedOverlay)
  const setDrawerTab = useEarthHistoryStore((s) => s.setDrawerTab)
  const setDrawer = useEarthHistoryStore((s) => s.setDrawer)
  const clearSelectedOverlay = useEarthHistoryStore((s) => s.clearSelectedOverlay)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (useEarthHistoryStore.getState().selectedOverlay) clearSelectedOverlay()
      else setDrawer(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen, setDrawer, clearSelectedOverlay])

  if (!drawerOpen) return null

  return (
    <aside ref={rootRef} className="eh-drawer" aria-label="Data layers and world data">
      <div className="eh-drawer__head">
        <div className="eh-drawer__tabs" role="tablist" aria-label="Drawer sections">
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === 'layers'}
            className={`eh-drawer__tab${drawerTab === 'layers' ? ' eh-drawer__tab--on' : ''}`}
            onClick={() => setDrawerTab('layers')}
          >
            Layers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={drawerTab === 'world'}
            className={`eh-drawer__tab${drawerTab === 'world' ? ' eh-drawer__tab--on' : ''}`}
            onClick={() => setDrawerTab('world')}
          >
            World
          </button>
        </div>
        <button
          type="button"
          className="eh-drawer__close"
          aria-label="Close panel"
          onClick={() => setDrawer(false)}
        >
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {selectedOverlay ? (
        <SelectionCard />
      ) : drawerTab === 'layers' ? (
        <LayersTab />
      ) : (
        <div className="eh-drawer__scroll">
          <WorldAtTime />
        </div>
      )}
    </aside>
  )
}
