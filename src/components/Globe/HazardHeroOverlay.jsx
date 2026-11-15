/**
 * Local canvas accents for top cyclone markers on Globe.GL.
 * Screen-projected swirls — capped hero sites only.
 */
import { useEffect, useRef } from 'react'

const MAX_HEROES = 5
const REDUCE_MQ = '(prefers-reduced-motion: reduce)'

/**
 * @param {{
 *   enabled?: boolean
 *   heroes?: Array<{ id: string, lat: number, lng: number, family: string, severity?: number }>
 *   project?: (lat: number, lng: number) => { x: number, y: number, visible: boolean } | null
 * }} props
 */
export default function HazardHeroOverlay({ enabled = false, heroes = [], project = null }) {
  const canvasRef = useRef(null)
  const animRef = useRef(0)
  const t0Ref = useRef(0)

  useEffect(() => {
    if (!enabled || !project) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return undefined
    }
    if (typeof matchMedia !== 'undefined' && matchMedia(REDUCE_MQ).matches) {
      return undefined
    }

    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.clientWidth
      canvas.height = parent.clientHeight
    }
    resize()
    window.addEventListener('resize', resize)
    t0Ref.current = performance.now()

    const sites = heroes.slice(0, MAX_HEROES)

    const tick = (now) => {
      const elapsed = (now - t0Ref.current) / 1000
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'lighter'

      for (const h of sites) {
        const scr = project(h.lat, h.lng)
        if (!scr?.visible) continue
        const { x, y } = scr
        const sev = h.severity || 3
        const r = 18 + sev * 6

        if (h.family === 'vortex') {
          ctx.strokeStyle = `rgba(120, 180, 255, ${0.35 + 0.15 * Math.sin(elapsed * 3)})`
          ctx.lineWidth = 1.4
          for (let i = 0; i < 3; i += 1) {
            const a0 = elapsed * (1.8 + i * 0.4) + i
            ctx.beginPath()
            for (let t = 0; t < Math.PI * 2; t += 0.15) {
              const rr = r * (0.25 + t / (Math.PI * 2)) * (0.7 + i * 0.15)
              const px = x + Math.cos(t + a0) * rr
              const py = y + Math.sin(t + a0) * rr * 0.72
              if (t === 0) ctx.moveTo(px, py)
              else ctx.lineTo(px, py)
            }
            ctx.stroke()
          }
        }
      }

      ctx.globalCompositeOperation = 'source-over'
      animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [enabled, heroes, project])

  if (!enabled || !heroes.length) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[2]"
      aria-hidden
    />
  )
}
