/**
 * Single rAF loop that spins / pulses Map3D hazard Model3D elements.
 */
import { useEffect, useRef } from 'react'

/**
 * @typedef {{ el: HTMLElement, spinDegPerSec: number, pulseHz: number, baseScale: number }} HazardAnimEntry
 */

/**
 * @returns {{
 *   register: (id: string, entry: HazardAnimEntry) => void,
 *   unregister: (id: string) => void,
 * }}
 */
export function useHazardModelAnimator(enabled = true) {
  const mapRef = useRef(new Map())
  const rafRef = useRef(0)
  const t0Ref = useRef(0)
  const apiRef = useRef(null)

  if (!apiRef.current) {
    apiRef.current = {
      register(id, entry) {
        if (!id || !entry?.el) return
        mapRef.current.set(id, entry)
      },
      unregister(id) {
        mapRef.current.delete(id)
      },
    }
  }

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return undefined
    }

    t0Ref.current = performance.now()

    const tick = (now) => {
      const elapsed = (now - t0Ref.current) / 1000
      for (const entry of mapRef.current.values()) {
        const el = entry.el
        if (!el) continue
        const heading = (entry.spinDegPerSec * elapsed) % 360
        const pulse =
          entry.pulseHz > 0
            ? 1 + 0.08 * Math.sin(elapsed * entry.pulseHz * Math.PI * 2)
            : 1
        const scale = entry.baseScale * pulse
        try {
          el.orientation = { heading, tilt: 0, roll: 0 }
          el.scale = scale
        } catch {
          /* element may be disconnected */
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [enabled])

  return apiRef.current
}
