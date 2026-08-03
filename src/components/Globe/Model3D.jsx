/**
 * Thin wrapper for Google Maps 3D Model3D web components.
 * Same pattern as local Polyline3D / Polygon3D in GoogleGlobe.jsx.
 * Properties are assigned on the element — React attribute mapping is unreliable for gmp-*.
 */
import { createElement, useEffect, useRef } from 'react'
import { AltitudeMode } from '@vis.gl/react-google-maps'

function toAbsoluteUrl(src) {
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src
  if (typeof window === 'undefined') return src
  try {
    return new URL(src, window.location.origin).href
  } catch {
    return src
  }
}

/**
 * @param {object} props
 * @param {string} props.src
 * @param {{ lat: number, lng: number, altitude?: number }} props.position
 * @param {number} [props.scale]
 * @param {{ heading?: number, tilt?: number, roll?: number }} [props.orientation]
 * @param {string} [props.altitudeMode]
 * @param {(e: Event) => void} [props.onClick]
 * @param {string} [props.animId]
 * @param {number} [props.spinDegPerSec]
 * @param {number} [props.pulseHz]
 * @param {number} [props.baseScale]
 * @param {{ register: Function, unregister: Function }} [props.animator]
 */
export default function Model3D({
  src,
  position,
  scale = 1,
  orientation,
  altitudeMode = AltitudeMode.RELATIVE_TO_GROUND,
  onClick,
  animId,
  spinDegPerSec = 0,
  pulseHz = 0,
  baseScale = 1,
  animator,
}) {
  const ref = useRef(null)
  const interactive = typeof onClick === 'function'
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const abs = toAbsoluteUrl(src)
    try {
      el.src = abs
      if (position) el.position = position
      if (scale != null) el.scale = scale
      if (orientation) el.orientation = orientation
      if (altitudeMode) el.altitudeMode = altitudeMode
    } catch {
      /* custom element may not be upgraded yet */
    }

    if (animId && animator) {
      animator.register(animId, {
        el,
        spinDegPerSec,
        pulseHz,
        baseScale,
      })
    }
    return () => {
      if (animId && animator) animator.unregister(animId)
    }
  }, [
    src,
    position?.lat,
    position?.lng,
    position?.altitude,
    scale,
    orientation?.heading,
    altitudeMode,
    animId,
    spinDegPerSec,
    pulseHz,
    baseScale,
    animator,
  ])

  useEffect(() => {
    const el = ref.current
    if (!el || !onClick) return undefined
    const handler = (e) => {
      e.stopPropagation?.()
      onClickRef.current?.(e)
    }
    el.addEventListener('gmp-click', handler)
    return () => el.removeEventListener('gmp-click', handler)
  }, [onClick])

  return createElement(interactive ? 'gmp-model-3d-interactive' : 'gmp-model-3d', {
    ref,
    // Also set attributes for first paint before effect runs
    src: toAbsoluteUrl(src),
  })
}
