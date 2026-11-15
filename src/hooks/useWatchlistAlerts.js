import { useEffect, useRef } from 'react'
import { useAtlasStore } from '../store/atlasStore'
import { supabase } from '../services/supabase'
import { findWatchlistHits } from '../core/watchlistMatch'

/**
 * Load Supabase watchlists and toast when new events match.
 */
export function useWatchlistAlerts(enabled = true) {
  const user = useAtlasStore((s) => s.user)
  const seenRef = useRef(new Set())

  useEffect(() => {
    if (!enabled || !user) {
      useAtlasStore.getState().setWatchlists([])
      return undefined
    }

    let cancelled = false
    const cacheKey = `atlas_watchlists_${user.id}`
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (Array.isArray(cached) && cached.length) {
        useAtlasStore.getState().setWatchlists(cached)
      }
    } catch {
      /* ignore */
    }

    const load = async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (!cancelled && !error && Array.isArray(data)) {
        try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch { /* ignore */ }
        useAtlasStore.getState().setWatchlists(data)
      }
    }

    load().then(() => {
      for (const e of useAtlasStore.getState().events) {
        seenRef.current.add(e.id)
      }
    })

    return () => { cancelled = true }
  }, [enabled, user?.id])

  useEffect(() => {
    if (!enabled || !user) return undefined

    const checkEvents = (added) => {
      const { watchlists, pushToast, setSelectedEvent, flyToLocation } = useAtlasStore.getState()
      if (!watchlists?.length || !added?.length) return

      for (const evt of added) {
        const dedupeKey = `${evt.id}`
        if (seenRef.current.has(dedupeKey)) continue

        const hits = findWatchlistHits(evt, watchlists)
        if (hits.length === 0) continue

        seenRef.current.add(dedupeKey)

        for (const { item } of hits) {
          pushToast({
            label: `Watchlist · ${item.name}`,
            message: (evt.title || 'New match').slice(0, 120),
            onClick: () => {
              setSelectedEvent(evt)
              if (evt.lat != null && evt.lng != null) {
                flyToLocation({ lat: evt.lat, lng: evt.lng })
              }
            },
          })
        }
      }
    }

    return useAtlasStore.subscribe((state, prev) => {
      if (!state.eventBusReady) return
      const added = []
      if (state.events.length > prev.events.length) {
        const prevIds = new Set(prev.events.map((e) => e.id))
        for (const e of state.events) {
          if (!prevIds.has(e.id)) added.push(e)
        }
      }
      if (added.length) checkEvents(added)
    })
  }, [enabled, user?.id])
}

export default useWatchlistAlerts
