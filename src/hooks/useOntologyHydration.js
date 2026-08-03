/**
 * Hydrate the live event stream with persisted ontology objects, and write
 * corroborated live events back into the graph when the user is signed in.
 *
 * History then survives a tab close: the globe shows last-seen objects from
 * Postgres alongside whatever the worker is fetching right now.
 */
import { useEffect, useRef } from 'react'
import { useAtlasStore } from '../store/atlasStore'
import {
  fetchOntologyObjects,
  ontologyRowToGlobeEvent,
  persistEventsToOntology,
} from '../services/ontology'
import { shouldPersistEvent } from '../core/objectMapping'

const HYDRATE_INTERVAL_MS = 5 * 60_000
const WRITEBACK_INTERVAL_MS = 90_000
const SINCE_DAYS = 7

function sinceIso(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

/**
 * Merge persisted rows into the store without clobbering fresher live events.
 */
function mergePersistedIntoStore(rows) {
  if (!rows?.length) return
  const store = useAtlasStore.getState()
  const eventMap = { ...store.eventMap }
  const events = [...store.events]
  let added = 0

  for (const row of rows) {
    const evt = ontologyRowToGlobeEvent(row)
    if (!Number.isFinite(evt.lat) || !Number.isFinite(evt.lng)) continue
    if (eventMap[evt.id]) {
      // Keep the live copy; just stamp ontology provenance onto it.
      eventMap[evt.id] = {
        ...eventMap[evt.id],
        ontologyId: evt.ontologyId,
        ontologyKind: evt.ontologyKind,
        ontologyCanonicalId: evt.ontologyCanonicalId,
      }
      continue
    }
    eventMap[evt.id] = evt
    events.push(evt)
    added++
  }

  if (added > 0 || rows.length) {
    useAtlasStore.setState({ events, eventMap })
  }
}

export function useOntologyHydration(enabled = true) {
  const user = useAtlasStore((s) => s.user)
  const eventBusReady = useAtlasStore((s) => s.eventBusReady)
  const writebackRef = useRef(0)

  // Pull history onto the globe.
  useEffect(() => {
    if (!enabled || !eventBusReady) return undefined
    let cancelled = false

    const hydrate = async () => {
      try {
        const result = await fetchOntologyObjects({
          kind: 'event,vessel,asset,news_item,economic_indicator,energy_asset',
          since: sinceIso(SINCE_DAYS),
          limit: 800,
        })
        if (cancelled || !result?.ok) return
        mergePersistedIntoStore(result.objects || [])
      } catch {
        /* ontology API unavailable — live stream still works */
      }
    }

    hydrate()
    const timer = setInterval(hydrate, HYDRATE_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [enabled, eventBusReady])

  // Write corroborated live events into the graph (signed-in only).
  useEffect(() => {
    if (!enabled || !eventBusReady || !user) return undefined

    const flush = async () => {
      const { events } = useAtlasStore.getState()
      const candidates = events.filter(
        (e) => !e.persisted && shouldPersistEvent(e) && e.id !== writebackRef.current,
      )
      if (!candidates.length) return

      // Cap each flush so one burst cannot overwhelm the function.
      const batch = candidates.slice(0, 100)
      try {
        const result = await persistEventsToOntology(batch)
        if (result?.ok) {
          writebackRef.current = Date.now()
          // Mark written events so we do not re-POST them every interval.
          useAtlasStore.setState((s) => {
            const eventMap = { ...s.eventMap }
            for (const e of batch) {
              if (eventMap[e.id]) eventMap[e.id] = { ...eventMap[e.id], persisted: true }
            }
            return {
              eventMap,
              events: s.events.map((e) => (eventMap[e.id] ? eventMap[e.id] : e)),
            }
          })
        }
      } catch {
        /* ignore — next interval retries */
      }
    }

    const timer = setInterval(flush, WRITEBACK_INTERVAL_MS)
    // First flush after a short settle so the worker has something to send.
    const boot = setTimeout(flush, 15_000)
    return () => {
      clearInterval(timer)
      clearTimeout(boot)
    }
  }, [enabled, eventBusReady, user])
}
