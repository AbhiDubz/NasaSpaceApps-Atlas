/**
 * Animated wind particle overlay for the 3D globes (Globe.GL and Google Map3D).
 * Uses Open-Meteo wind grid ($0) — inspired by WeatherLayers particle layer.
 *
 * Particles live in lat/lng and are projected through the globe's camera
 * every frame, so they sit on the surface, turn with the globe, and vanish
 * behind the horizon. The camera comes from `getFrame` (see globe-core/windFrames.js).
 */
import { useEffect, useRef } from 'react'
import { fetchWindGrid, makeWindSampler } from '../../core/windGrid'

const PARTICLE_COUNT = 1800
/** Degrees of travel per frame for each m/s of wind. */
const DEG_PER_MS_PER_FRAME = 0.012
/** Tail length, in frames of travel. */
const TAIL_FRAMES = 22
/** Winds slower than this (m/s) get proportionally longer tails. */
const SHORT_TAIL_BELOW_MS = 7
const MAX_AGE = 140
const FADE_FRAMES = 20
const MAX_LAT = 80

const RAD = Math.PI / 180

/**
 * Place a particle at a random spot inside the part of the globe the camera
 * can see (a spherical cap around the view centre), so the streaks stay
 * equally dense at every zoom level.
 * @param {object} p
 * @param {{ lat: number, lng: number }} centre — degrees
 * @param {number} radius — cap radius in radians
 * @param {number} [inner=0] — when set, spawn only in the ring between `inner` and `radius`
 */
function spawn(p, centre, radius, inner = 0) {
  const cosInner = Math.cos(inner)
  const dist = Math.acos(cosInner - Math.random() * (cosInner - Math.cos(radius)))
  const bearing = Math.random() * 2 * Math.PI
  const lat0 = centre.lat * RAD
  const sinLat = Math.sin(lat0) * Math.cos(dist) + Math.cos(lat0) * Math.sin(dist) * Math.cos(bearing)
  const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)))
  const lng = centre.lng * RAD + Math.atan2(
    Math.sin(bearing) * Math.sin(dist) * Math.cos(lat0),
    Math.cos(dist) - Math.sin(lat0) * sinLat,
  )
  p.lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat / RAD))
  p.lng = ((((lng / RAD + 180) % 360) + 360) % 360) - 180
  p.age = 0
  p.life = MAX_AGE * (0.5 + Math.random() * 0.5)
  return p
}

/** Cosine of the angle between two lat/lng points, seen from the globe's centre. */
function cosBetween(lat, lng, sinLat0, cosLat0, lng0) {
  const φ = lat * RAD
  return Math.sin(φ) * sinLat0 + Math.cos(φ) * cosLat0 * Math.cos((lng - lng0) * RAD)
}

function speedColor(speed) {
  // calm = soft blue, breezy = cyan, strong = white
  const t = Math.min(1, speed / 14)
  const r = Math.round(110 + 145 * t)
  const g = Math.round(200 + 55 * t)
  return `${r}, ${g}, 255`
}

/**
 * @param {{
 *   enabled?: boolean,
 *   getFrame: (width: number, height: number) => import('../../globe-core/windFrames').WindFrame | null,
 * }} props — `getFrame` is called every animation frame; keep it referentially stable.
 */
export default function WindParticleOverlay({ enabled = false, getFrame }) {
  const canvasRef = useRef(null)
  const samplerRef = useRef(null)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    fetchWindGrid()
      .then((grid) => {
        if (!cancelled) samplerRef.current = makeWindSampler(grid)
      })
      .catch(() => { /* overlay stays empty */ })
    return () => { cancelled = true }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return undefined

    /** @type {{ lat: number, lng: number, age: number, life: number }[]} */
    const particles = []
    /** Radius (radians) of the visible cap the particles are currently spread over. */
    let spawnReach = 0

    let width = 0
    let height = 0
    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, width, height)

      const sample = samplerRef.current
      const frame = sample && width > 0 && height > 0 ? getFrame?.(width, height) : null
      if (!frame) return

      const { eye, focus, horizon, reach } = frame
      const sinEye = Math.sin(eye.lat * RAD)
      const cosEye = Math.cos(eye.lat * RAD)
      const sinFocus = Math.sin(focus.lat * RAD)
      const cosFocus = Math.cos(focus.lat * RAD)
      const cosReach = Math.cos(Math.min(Math.PI, reach * 1.15))
      const cosHorizon = Math.cos(horizon)
      // Slow the drift when zoomed in so streaks do not race across the screen.
      const step = DEG_PER_MS_PER_FRAME * Math.max(0.12, Math.min(1, reach / 1.2))
      ctx.lineCap = 'round'

      if (!particles.length) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = spawn({}, focus, reach)
          p.age = Math.random() * p.life
          particles.push(p)
        }
      } else if (reach > spawnReach) {
        // Zooming out: particles spread over the old, smaller cap are all still in view, so
        // nothing would respawn and they'd stay bunched in a circle. Move the share that
        // belongs in the newly visible ring out there, keeping the density even.
        const outer = Math.min(Math.PI, reach)
        const inner = Math.min(outer, spawnReach)
        const keep = (1 - Math.cos(inner)) / (1 - Math.cos(outer))
        for (const p of particles) {
          if (Math.random() >= keep) spawn(p, focus, outer, inner)
        }
      }
      // Zooming in needs no help: particles outside the smaller cap respawn inside it below.
      spawnReach = reach

      for (const p of particles) {
        const { u, v } = sample(p.lat, p.lng)
        const speed = Math.hypot(u, v)
        const cosLat = Math.max(0.17, Math.cos(p.lat * RAD))
        const dLat = v * step
        const dLng = (u * step) / cosLat

        p.lat += dLat
        p.lng += dLng
        p.age += 1
        if (p.lng > 180) p.lng -= 360
        else if (p.lng < -180) p.lng += 360
        if (p.age > p.life || Math.abs(p.lat) > MAX_LAT || speed < 0.3) {
          spawn(p, focus, reach)
          continue
        }

        // Drifted (or the globe turned) out of view: bring it back into the visible part.
        const cosFromEye = cosBetween(p.lat, p.lng, sinEye, cosEye, eye.lng)
        if (cosFromEye < cosHorizon || cosBetween(p.lat, p.lng, sinFocus, cosFocus, focus.lng) < cosReach) {
          spawn(p, focus, reach)
          continue
        }
        // Fade out towards the globe's edge, where the surface turns away from the camera.
        // Squared, because streaks bunch up there as the surface foreshortens.
        const edge = Math.min(1, (cosFromEye - cosHorizon) / ((1 - cosHorizon) * 0.55))
        if (edge <= 0.1) continue
        const facing = edge * edge

        const head = frame.project(p.lat, p.lng)
        if (!head || head.x < -20 || head.x > width + 20 || head.y < -20 || head.y > height + 20) continue
        // Light winds would otherwise leave tails only a few pixels long; stretch them (colour still shows speed).
        const tailFrames = TAIL_FRAMES * Math.max(1, Math.sqrt(SHORT_TAIL_BELOW_MS / speed))
        const tail = frame.project(p.lat - dLat * tailFrames, p.lng - dLng * tailFrames)
        if (!tail) continue

        const fade = Math.min(1, facing, p.age / FADE_FRAMES, (p.life - p.age) / FADE_FRAMES)
        const alpha = fade * Math.min(0.95, 0.4 + speed * 0.05)
        ctx.beginPath()
        ctx.moveTo(tail.x, tail.y)
        ctx.lineTo(head.x, head.y)
        // Dark halo first, so the streak still reads over bright land and cloud imagery.
        ctx.lineWidth = 3.4
        ctx.strokeStyle = `rgba(4, 18, 38, ${(alpha * 0.5).toFixed(3)})`
        ctx.stroke()
        ctx.lineWidth = 1.4
        ctx.strokeStyle = `rgba(${speedColor(speed)}, ${alpha.toFixed(3)})`
        ctx.stroke()
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [enabled, getFrame])

  if (!enabled) return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
      aria-hidden
    />
  )
}
