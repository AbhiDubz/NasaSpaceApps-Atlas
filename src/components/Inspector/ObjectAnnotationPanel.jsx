/**
 * Writeback panel — flag an object and leave a note.
 * Enables "show me everything flagged watching with a linked event in 7 days."
 */
import { useCallback, useEffect, useState } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { useAtlasStore } from '../../store/atlasStore'
import {
  fetchAnnotations,
  fetchEntityGraph,
  upsertAnnotation,
} from '../../services/ontology'

const FLAG_OPTIONS = [
  { value: '', label: 'No flag' },
  { value: 'watching', label: 'Watching' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'resolved', label: 'Resolved' },
]

export default function ObjectAnnotationPanel({ event }) {
  const user = useAtlasStore((s) => s.user)
  const pushToast = useAtlasStore((s) => s.pushToast)
  const [annotation, setAnnotation] = useState(null)
  const [note, setNote] = useState('')
  const [flagStatus, setFlagStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(false)

  const entityId = event?.ontologyId || null

  const load = useCallback(async () => {
    if (!user || !entityId) return
    setLoading(true)
    try {
      const [ann, graph] = await Promise.all([
        fetchAnnotations({ entityId }),
        fetchEntityGraph(entityId, 1),
      ])
      const first = ann.annotations?.[0] || null
      setAnnotation(first)
      setNote(first?.note || '')
      setFlagStatus(first?.flag_status || '')
      setLinks(graph.links || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [user, entityId])

  useEffect(() => {
    load()
  }, [load])

  if (!user) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <p className="font-ui text-[10px] text-faint">
          Sign in to flag this object and leave notes that persist across sessions.
        </p>
      </div>
    )
  }

  if (!entityId) {
    return (
      <div className="mt-3 border-t border-line pt-3">
        <p className="font-ui text-[10px] text-faint">
          This signal is not yet in the object graph. It will be indexed on the next ingest cycle.
        </p>
      </div>
    )
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const result = await upsertAnnotation({
        entityId,
        note: note.trim() || null,
        flagStatus: flagStatus || null,
      })
      if (!result.ok) {
        pushToast({ label: 'Annotation', message: result.reason || 'Could not save' })
        return
      }
      setAnnotation(result.annotation)
      pushToast({ label: 'Annotation', message: flagStatus ? `Flagged ${flagStatus}` : 'Note saved' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3 space-y-2">
      <div className="flex items-center gap-1.5 font-ui text-[10px] uppercase tracking-wide text-faint">
        <Flag size={11} />
        Object writeback
        {loading && <Loader2 size={11} className="animate-spin" />}
      </div>

      <div className="flex gap-2 items-center">
        <select
          className="flex-1 rounded-sm border border-line bg-surface px-2 py-1 font-ui text-[11px] text-ink"
          value={flagStatus}
          onChange={(e) => setFlagStatus(e.target.value)}
          aria-label="Flag status"
        >
          {FLAG_OPTIONS.map((o) => (
            <option key={o.value || 'none'} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="event-source-link"
          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px' }}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : annotation ? 'Update' : 'Save'}
        </button>
      </div>

      <textarea
        className="w-full min-h-[56px] rounded-sm border border-line bg-surface px-2 py-1.5 font-ui text-[11px] text-ink resize-y"
        placeholder="Analyst note…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
      />

      {links.length > 0 && (
        <div>
          <div className="font-ui text-[10px] uppercase tracking-wide text-faint mb-1">
            Linked objects ({links.length})
          </div>
          <ul className="space-y-0.5 max-h-28 overflow-y-auto">
            {links.slice(0, 12).map((link) => (
              <li
                key={link.id || `${link.from_entity}-${link.to_entity}-${link.link_type}`}
                className="font-data text-[10px] text-muted truncate"
              >
                <span className="text-faint">{link.link_type}</span>
                {link.label ? ` · ${link.label}` : ''}
                {link.confidence != null ? ` · ${(link.confidence * 100).toFixed(0)}%` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
