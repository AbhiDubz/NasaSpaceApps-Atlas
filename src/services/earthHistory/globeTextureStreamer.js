/**
 * Streams paleogeography basemaps onto the deep-time globe.
 *
 * three-globe starts a fresh, uncancellable TextureLoader run on every
 * `globeImageUrl` change and applies whichever run resolves last, so scrubbing
 * re-decodes frames it already showed and can settle on the wrong age. This
 * owns the globe material's colour map instead and keeps two tiers:
 *
 *   - bytes: fetched Blobs, small enough to hold most of the timeline
 *   - GPU: decoded THREE textures, LRU-capped and disposed on eviction
 */
import { SRGBColorSpace, Texture } from 'three'

/**
 * Kept well below the six-connections-per-host limit so a foreground `ensure`
 * for the frame under the playhead is never queued behind background warming.
 */
const MAX_PARALLEL_FETCHES = 3
/** Beyond this the oldest pending uploads are stale; the playhead has moved on. */
const MAX_QUEUED_UPLOADS = 12
/** RGBA plus a full mip chain. */
const MIP_OVERHEAD = 4 / 3

function gpuBytes(image) {
  const w = image?.width || 0
  const h = image?.height || 0
  return Math.round(w * h * 4 * MIP_OVERHEAD)
}

function loadImageElement(src, { crossOrigin = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      // decode() keeps the rasterisation off the main thread where supported
      if (img.decode) {
        img.decode().then(
          () => resolve(img),
          () => resolve(img),
        )
      } else {
        resolve(img)
      }
    }
    img.onerror = () => reject(new Error(`Texture failed: ${src}`))
    img.src = src
  })
}

/**
 * @param {{ maxTextures?: number, maxTextureBytes?: number, maxBlobBytes?: number }} [opts]
 */
export function createGlobeTextureStreamer({
  maxTextures = 32,
  maxTextureBytes = 96 * 1024 * 1024,
  maxBlobBytes = 64 * 1024 * 1024,
} = {}) {
  /** @type {Map<string, Texture>} */
  const textures = new Map()
  /** @type {Map<string, Blob>} */
  const blobs = new Map()
  /** @type {Map<string, Promise<Texture | null>>} */
  const decoding = new Map()
  /** @type {Map<string, Promise<Blob | null>>} */
  const fetching = new Map()
  /** Never evict what the globe is currently showing. */
  const pinned = new Set()
  /** @type {Set<() => void>} */
  const listeners = new Set()

  /** @type {string[]} */
  let hotQueue = []
  /** @type {string[]} */
  let idleQueue = []
  /** @type {string[]} */
  const uploadQueue = []
  let uploadRaf = 0
  let activeFetches = 0
  /** Outstanding `ensure` calls, i.e. frames something is waiting to draw. */
  let foregroundFetches = 0
  let textureBytes = 0
  let blobBytes = 0
  let renderer = null
  let disposed = false

  function emit() {
    for (const fn of [...listeners]) {
      try {
        fn()
      } catch {
        /* a bad listener must not stall streaming */
      }
    }
  }

  function touch(map, key) {
    if (!map.has(key)) return null
    const v = map.get(key)
    map.delete(key)
    map.set(key, v)
    return v
  }

  function destroyTexture(tex) {
    if (!tex) return
    const objectUrl = tex.userData?.objectUrl
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    tex.dispose?.()
  }

  function putTexture(url, tex) {
    textures.set(url, tex)
    textureBytes += gpuBytes(tex.image)
    // Insertion order is LRU order; drop the coldest until back inside budget.
    for (const key of [...textures.keys()]) {
      if (textures.size <= maxTextures && textureBytes <= maxTextureBytes) break
      if (key === url || pinned.has(key)) continue
      const dead = textures.get(key)
      textures.delete(key)
      textureBytes -= gpuBytes(dead?.image)
      destroyTexture(dead)
    }
  }

  function putBlob(url, blob) {
    blobs.set(url, blob)
    blobBytes += blob.size
    for (const key of [...blobs.keys()]) {
      if (blobBytes <= maxBlobBytes) break
      if (key === url) continue
      blobBytes -= blobs.get(key)?.size || 0
      blobs.delete(key)
    }
  }

  function fetchBlob(url) {
    const hit = touch(blobs, url)
    if (hit) return Promise.resolve(hit)
    const pending = fetching.get(url)
    if (pending) return pending

    const p = fetch(url, { cache: 'force-cache', credentials: 'omit' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
        return res.blob()
      })
      .then((blob) => {
        if (!disposed) putBlob(url, blob)
        return blob
      })
    fetching.set(url, p)
    p.catch(() => {}).finally(() => {
      if (fetching.get(url) === p) fetching.delete(url)
    })
    return p
  }

  function pump() {
    while (!disposed && activeFetches < MAX_PARALLEL_FETCHES) {
      // The ladder is pure speculation, so it yields to the frame under the playhead.
      const url = hotQueue.shift() ?? (foregroundFetches > 0 ? null : idleQueue.shift())
      if (!url) return
      if (blobs.has(url) || fetching.has(url)) continue
      activeFetches += 1
      fetchBlob(url)
        .catch(() => {})
        .finally(() => {
          activeFetches -= 1
          pump()
        })
    }
  }

  async function decodeToTexture(url) {
    const blob = blobs.has(url) ? touch(blobs, url) : await fetchBlob(url).catch(() => null)
    let objectUrl = ''
    let img
    if (blob) {
      objectUrl = URL.createObjectURL(blob)
      try {
        img = await loadImageElement(objectUrl)
      } catch (err) {
        URL.revokeObjectURL(objectUrl)
        throw err
      }
    } else {
      img = await loadImageElement(url, { crossOrigin: true })
    }

    if (disposed) {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      return null
    }

    const tex = new Texture(img)
    tex.colorSpace = SRGBColorSpace
    tex.needsUpdate = true
    // Held until eviction so the browser can never need to re-fetch a revoked source.
    if (objectUrl) tex.userData.objectUrl = objectUrl
    putTexture(url, tex)
    scheduleUpload(url)
    emit()
    return tex
  }

  /**
   * Uploading to the GPU (and generating mipmaps) blocks the main thread, so a
   * burst of prefetched frames would stall the very swap it is meant to smooth.
   * One per animation frame keeps it off the critical path, newest first: while
   * scrubbing, the most recently decoded frame is the one about to be drawn.
   */
  function scheduleUpload(url) {
    if (!renderer) return
    uploadQueue.push(url)
    if (uploadQueue.length > MAX_QUEUED_UPLOADS) uploadQueue.shift()
    if (!uploadRaf) uploadRaf = requestAnimationFrame(drainUploads)
  }

  function drainUploads() {
    uploadRaf = 0
    if (disposed) return
    const url = uploadQueue.pop()
    const tex = url ? textures.get(url) : null
    if (tex) {
      try {
        renderer?.initTexture?.(tex)
      } catch {
        /* falls back to uploading on the next draw */
      }
    }
    if (uploadQueue.length) uploadRaf = requestAnimationFrame(drainUploads)
  }

  return {
    /** @param {unknown} r three.js WebGLRenderer, used to pre-upload decoded frames. */
    setRenderer(r) {
      renderer = r || null
    },

    /** @param {() => void} fn Called whenever a new frame becomes displayable. */
    onFrameReady(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    /** Resident texture for `url`, or null. Never triggers work. */
    peek(url) {
      if (!url) return null
      return touch(textures, url)
    },

    has(url) {
      return Boolean(url) && textures.has(url)
    },

    /** @returns {Promise<Texture | null>} */
    ensure(url) {
      if (!url || disposed) return Promise.resolve(null)
      const hit = touch(textures, url)
      if (hit) return Promise.resolve(hit)
      const pending = decoding.get(url)
      if (pending) return pending
      foregroundFetches += 1
      const p = decodeToTexture(url)
      decoding.set(url, p)
      p.catch(() => {}).finally(() => {
        if (decoding.get(url) === p) decoding.delete(url)
        foregroundFetches -= 1
        pump()
      })
      return p
    },

    /** Frames to fetch next, highest priority first. Replaces any previous window. */
    warm(urls) {
      hotQueue = urls.filter((u) => u && !blobs.has(u) && !fetching.has(u))
      pump()
    },

    /** Background fill, drained only once the hot window is satisfied. */
    warmIdle(urls) {
      idleQueue = urls.filter((u) => u && !blobs.has(u) && !fetching.has(u))
      pump()
    },

    /** Protect the displayed frames from LRU eviction. */
    pin(urls) {
      pinned.clear()
      for (const u of urls) if (u) pinned.add(u)
    },

    dispose() {
      disposed = true
      hotQueue = []
      idleQueue = []
      uploadQueue.length = 0
      if (uploadRaf) cancelAnimationFrame(uploadRaf)
      uploadRaf = 0
      listeners.clear()
      pinned.clear()
      for (const tex of textures.values()) destroyTexture(tex)
      textures.clear()
      blobs.clear()
      textureBytes = 0
      blobBytes = 0
    },

    get stats() {
      return { textures: textures.size, textureBytes, blobs: blobs.size, blobBytes }
    },
  }
}

/**
 * Swap the globe basemap without a shader recompile-worthy change.
 * Mirrors three-globe: a mapped globe drops `color` so the texture is unmodulated.
 * @returns {boolean} whether the material changed
 */
export function applyColorMap(material, texture) {
  if (!material || !texture || material.map === texture) return false
  material.map = texture
  material.color = null
  material.needsUpdate = true
  return true
}
