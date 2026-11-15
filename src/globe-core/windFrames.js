/**
 * Per-renderer camera snapshots ("frames") for WindParticleOverlay, so the same
 * particle loop can draw on Globe.GL and on Google Map3D.
 *
 * @typedef {{
 *   eye: { lat: number, lng: number },    // ground point directly under the camera
 *   horizon: number,                      // angle from `eye` to the visible limb, radians
 *   focus: { lat: number, lng: number },  // ground point at the centre of the screen
 *   reach: number,                        // radius around `focus` that can be on screen, radians
 *   project: (lat: number, lng: number) => { x: number, y: number } | null,
 * }} WindFrame
 */
import { createMap3dProjector } from './map3dProjection'

const RAD = Math.PI / 180
/** Height above the surface, in globe radii, so Globe.GL streaks clear the country tint. */
const GLOBE_GL_ALTITUDE = 0.012
/** Extra margin on the field-of-view reach so streaks do not thin out at the screen corners. */
const REACH_MARGIN = 1.15

/** How far from the screen centre the view extends, in radians of arc, limited by the horizon. */
function reachOf(heightAboveSurfaceRadii, tanHalfFov, aspect, horizon) {
  const diagonal = Math.hypot(1, Math.max(1, aspect))
  const fovReach = heightAboveSurfaceRadii * tanHalfFov * diagonal * REACH_MARGIN
  return Math.max(0.02, Math.min(horizon, fovReach))
}

/**
 * @param {any} globe — globe.gl instance
 * @returns {WindFrame | null}
 */
export function globeGlWindFrame(globe, width, height) {
  const camera = globe?.camera?.()
  if (!camera || !globe.getScreenCoords || !globe.pointOfView) return null
  const pov = globe.pointOfView()
  const altitude = Math.max(0.001, pov.altitude || 0)
  const horizon = Math.acos(Math.min(1, 1 / (1 + altitude)))
  const centre = { lat: pov.lat || 0, lng: pov.lng || 0 }
  const tanHalfFov = Math.tan(((camera.fov || 50) * RAD) / 2)
  return {
    eye: centre,
    horizon,
    focus: centre,
    reach: reachOf(altitude, tanHalfFov, width / Math.max(1, height), horizon),
    project: (lat, lng) => globe.getScreenCoords(lat, lng, GLOBE_GL_ALTITUDE),
  }
}

/**
 * @param {{ centerLat: number, centerLng: number, centerAltM?: number, rangeM: number, headingDeg?: number, tiltDeg?: number, fovDeg?: number }} cam
 * @returns {WindFrame | null}
 */
export function map3dWindFrame(cam, width, height) {
  const projector = createMap3dProjector({ ...cam, width, height })
  if (!projector) return null
  const horizon = Math.acos(Math.min(1, 1 / projector.eyeDistRadii))
  return {
    eye: projector.eye,
    horizon,
    focus: projector.focus,
    reach: reachOf(projector.focusDistRadii, projector.tanHalfFov, width / Math.max(1, height), Math.PI / 2),
    project: projector.project,
  }
}
