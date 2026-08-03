import { validateManifest } from '../../earth-history/core/keyframeIndex.js'

const MANIFEST_URL = '/geo/earth-history/manifest.json'
const ERAS_URL = '/geo/earth-history/eras.json'

export async function loadKeyframeManifest(url = MANIFEST_URL) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load manifest (${res.status})`)
  const data = await res.json()
  const v = validateManifest(data)
  if (!v.ok) throw new Error(v.error)
  return v.manifest
}

export async function loadErasJson(url = ERAS_URL) {
  const res = await fetch(url)
  if (!res.ok) return { blurbs: {} }
  return res.json()
}
