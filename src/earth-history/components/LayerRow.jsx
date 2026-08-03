import { useEarthHistoryStore } from '../store/earthHistoryStore'

/**
 * One data layer in the drawer: swatch, name, fetch status, switch.
 * Sub-options for the enabled layer nest underneath via `children`.
 */
export default function LayerRow({ layer, children }) {
  const enabled = useEarthHistoryStore((s) => Boolean(s.layers[layer.id]))
  const status = useEarthHistoryStore((s) => (layer.statusKey ? s[layer.statusKey] : null))
  const count = useEarthHistoryStore((s) => (layer.countKey ? s[layer.countKey] : null))
  const message = useEarthHistoryStore((s) => (layer.messageKey ? s[layer.messageKey] : null))
  const toggleLayer = useEarthHistoryStore((s) => s.toggleLayer)
  const syncUrl = useEarthHistoryStore((s) => s.syncUrl)

  let hint = null
  if (enabled && status === 'loading') hint = 'Loading…'
  else if (enabled && status === 'ready' && count != null && count > 0) {
    hint = count.toLocaleString()
  } else if (enabled && (status === 'error' || status === 'unsupported')) {
    hint = message || 'Unavailable here'
  }

  return (
    <div className={`eh-layer${enabled ? ' eh-layer--on' : ''}`}>
      <div className="eh-layer__row">
        <span className="eh-layer__swatch" style={{ background: layer.swatch }} aria-hidden />
        <span className="eh-layer__label" title={layer.description}>
          {layer.label}
        </span>
        {hint && (
          <span
            className={`eh-layer__hint${
              status === 'error' || status === 'unsupported' ? ' eh-layer__hint--warn' : ''
            }`}
          >
            {hint}
          </span>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${layer.label} layer`}
          className={`eh-layer__switch${enabled ? ' eh-layer__switch--on' : ''}`}
          onClick={() => {
            toggleLayer(layer.id)
            syncUrl()
          }}
        >
          <span className="eh-layer__knob" />
        </button>
      </div>
      {enabled && children && <div className="eh-layer__sub">{children}</div>}
    </div>
  )
}
