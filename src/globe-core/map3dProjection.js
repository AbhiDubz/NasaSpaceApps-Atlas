/**
 * Lat/lng → screen projection for Google Map3D, which has no public project API.
 * Uses the same synthetic camera as screenToLatLng.js (its inverse), so overlays
 * drawn on a 2D canvas line up with the pointer picks.
 */
import { APPROX_FOV_DEG, EARTH_RADIUS_M, ecefToLatLng, enuToEcef, latLngToEcef } from './screenToLatLng'

const RAD = Math.PI / 180

/**
 * @param {{
 *   centerLat: number, centerLng: number, centerAltM?: number, rangeM: number,
 *   headingDeg?: number, tiltDeg?: number, fovDeg?: number,
 *   width: number, height: number,
 * }} cam
 * @returns {{
 *   eye: { lat: number, lng: number },
 *   eyeDistRadii: number,
 *   focus: { lat: number, lng: number },
 *   focusDistRadii: number,
 *   tanHalfFov: number,
 *   project: (lat: number, lng: number) => { x: number, y: number } | null,
 * } | null} — `eye` is the ground point directly under the camera; `eyeDistRadii` its distance from Earth's centre;
 *   `focus` is the ground point at the centre of the screen and `focusDistRadii` the camera's distance to it.
 */
export function createMap3dProjector(cam) {
  const { centerLat, centerLng, rangeM, width, height } = cam
  if (![centerLat, centerLng, rangeM].every(Number.isFinite) || !(width > 0) || !(height > 0)) return null

  // Map3D reports the same view either as a ground centre + range, or (zoomed out)
  // as a centre lifted to the camera's height with range 0 — handle both.
  const range = Math.max(0, rangeM)
  const centerAltM = Math.max(0, Number(cam.centerAltM) || 0)
  if (range + centerAltM < 1) return null
  const tilt = (Number(cam.tiltDeg) || 0) * RAD
  const heading = (Number(cam.headingDeg) || 0) * RAD
  const sinT = Math.sin(tilt)
  const cosT = Math.cos(tilt)
  const sinH = Math.sin(heading)
  const cosH = Math.cos(heading)

  // Camera sits `range` from the look-at point, swung back by the tilt.
  const centre = latLngToEcef(centerLat, centerLng, centerAltM)
  const off = enuToEcef(-range * sinT * sinH, -range * sinT * cosH, range * cosT, centerLat, centerLng)
  const eye = { x: centre.x + off.x, y: centre.y + off.y, z: centre.z + off.z }

  // Camera basis in ECEF: forward to the look-at point, up along the heading.
  const f = enuToEcef(sinT * sinH, sinT * cosH, -cosT, centerLat, centerLng)
  const u = enuToEcef(cosT * sinH, cosT * cosH, sinT, centerLat, centerLng)
  const r = {
    x: f.y * u.z - f.z * u.y,
    y: f.z * u.x - f.x * u.z,
    z: f.x * u.y - f.y * u.x,
  }

  const fovDeg = Number.isFinite(cam.fovDeg) && cam.fovDeg > 0 ? cam.fovDeg : APPROX_FOV_DEG
  const tanHalfFov = Math.tan((fovDeg * RAD) / 2)
  const aspect = width / height
  const eyeLatLng = ecefToLatLng(eye)
  if (!eyeLatLng) return null

  // Where the centre of the screen meets the ground (ray–sphere); the eye's own ground point if it looks past the limb.
  const b = eye.x * f.x + eye.y * f.y + eye.z * f.z
  const disc = b * b - (eye.x * eye.x + eye.y * eye.y + eye.z * eye.z - EARTH_RADIUS_M * EARTH_RADIUS_M)
  const hitDist = disc >= 0 ? -b - Math.sqrt(disc) : -1
  const focus = hitDist > 0
    ? ecefToLatLng({ x: eye.x + f.x * hitDist, y: eye.y + f.y * hitDist, z: eye.z + f.z * hitDist })
    : null
  const eyeDist = Math.hypot(eye.x, eye.y, eye.z)

  return {
    eye: eyeLatLng,
    eyeDistRadii: eyeDist / EARTH_RADIUS_M,
    focus: focus || eyeLatLng,
    focusDistRadii: (focus ? hitDist : Math.max(1, eyeDist - EARTH_RADIUS_M)) / EARTH_RADIUS_M,
    tanHalfFov,
    project(lat, lng) {
      const p = latLngToEcef(lat, lng, 0)
      const vx = p.x - eye.x
      const vy = p.y - eye.y
      const vz = p.z - eye.z
      const depth = vx * f.x + vy * f.y + vz * f.z
      if (depth <= 0) return null
      const nx = (vx * r.x + vy * r.y + vz * r.z) / (depth * tanHalfFov * aspect)
      const ny = (vx * u.x + vy * u.y + vz * u.z) / (depth * tanHalfFov)
      return { x: (nx * 0.5 + 0.5) * width, y: (0.5 - ny * 0.5) * height }
    },
  }
}
