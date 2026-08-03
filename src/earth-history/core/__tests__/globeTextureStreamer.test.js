import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyColorMap,
  createGlobeTextureStreamer,
} from '../../../services/earthHistory/globeTextureStreamer.js'

/** width/height reported by the fake decoder, keyed by source url. */
const SIZES = new Map()
let fetchCount = 0

function frameUrl(n, { w = 1024, h = 512, bytes = 200_000 } = {}) {
  const url = `/geo/ma-${n}.png`
  SIZES.set(url, { w, h, bytes })
  return url
}

class FakeImage {
  set src(value) {
    this._src = value
    const key = String(value).replace(/^blob:/, '')
    const size = SIZES.get(key) || { w: 8, h: 8 }
    this.width = size.w
    this.height = size.h
    queueMicrotask(() => {
      if (SIZES.has(key)) this.onload?.()
      else this.onerror?.()
    })
  }

  get src() {
    return this._src
  }
}

beforeEach(() => {
  SIZES.clear()
  fetchCount = 0
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('URL', {
    createObjectURL: (blob) => `blob:${blob.__url}`,
    revokeObjectURL: () => {},
  })
  vi.stubGlobal('fetch', async (url) => {
    fetchCount += 1
    const size = SIZES.get(url)
    if (!size) return { ok: false, status: 404 }
    return { ok: true, status: 200, blob: async () => ({ size: size.bytes, __url: url }) }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createGlobeTextureStreamer', () => {
  it('decodes once and serves later requests from cache', async () => {
    const streamer = createGlobeTextureStreamer()
    const url = frameUrl(100)

    const first = await streamer.ensure(url)
    expect(first).toBeTruthy()
    expect(streamer.has(url)).toBe(true)
    expect(streamer.peek(url)).toBe(first)

    expect(await streamer.ensure(url)).toBe(first)
    expect(fetchCount).toBe(1)
  })

  it('dedupes concurrent requests for the same frame', async () => {
    const streamer = createGlobeTextureStreamer()
    const url = frameUrl(200)

    const [a, b] = await Promise.all([streamer.ensure(url), streamer.ensure(url)])
    expect(a).toBe(b)
    expect(fetchCount).toBe(1)
  })

  it('resolves to null for frames that cannot be fetched', async () => {
    const streamer = createGlobeTextureStreamer()
    await expect(streamer.ensure('/geo/missing.png')).rejects.toThrow()
    expect(streamer.has('/geo/missing.png')).toBe(false)
  })

  it('evicts and disposes the coldest texture once over budget', async () => {
    const bytesPerFrame = 1024 * 512 * 4 * (4 / 3)
    const streamer = createGlobeTextureStreamer({
      maxTextureBytes: Math.round(bytesPerFrame * 2.5),
    })
    const urls = [frameUrl(1), frameUrl(2), frameUrl(3)]
    const first = await streamer.ensure(urls[0])
    const disposed = vi.fn()
    first.addEventListener('dispose', disposed)

    await streamer.ensure(urls[1])
    await streamer.ensure(urls[2])

    expect(streamer.has(urls[0])).toBe(false)
    expect(streamer.has(urls[1])).toBe(true)
    expect(streamer.has(urls[2])).toBe(true)
    expect(disposed).toHaveBeenCalled()
    expect(streamer.stats.textureBytes).toBeLessThanOrEqual(Math.round(bytesPerFrame * 2.5))
  })

  it('never evicts the pinned frame the globe is showing', async () => {
    const bytesPerFrame = 1024 * 512 * 4 * (4 / 3)
    const streamer = createGlobeTextureStreamer({
      maxTextureBytes: Math.round(bytesPerFrame * 2.5),
    })
    const urls = [frameUrl(1), frameUrl(2), frameUrl(3), frameUrl(4)]
    await streamer.ensure(urls[0])
    streamer.pin([urls[0]])

    for (const url of urls.slice(1)) await streamer.ensure(url)

    expect(streamer.has(urls[0])).toBe(true)
  })

  it('warms bytes so a later decode needs no network', async () => {
    const streamer = createGlobeTextureStreamer()
    const url = frameUrl(300)

    streamer.warm([url])
    await vi.waitFor(() => expect(fetchCount).toBe(1))

    await streamer.ensure(url)
    expect(fetchCount).toBe(1)
  })

  it('notifies listeners when a frame becomes displayable', async () => {
    const streamer = createGlobeTextureStreamer()
    const ready = vi.fn()
    streamer.onFrameReady(ready)

    await streamer.ensure(frameUrl(400))
    expect(ready).toHaveBeenCalled()
  })

  it('releases everything on dispose', async () => {
    const streamer = createGlobeTextureStreamer()
    const url = frameUrl(500)
    await streamer.ensure(url)

    streamer.dispose()
    expect(streamer.has(url)).toBe(false)
    expect(streamer.stats).toEqual({ textures: 0, textureBytes: 0, blobs: 0, blobBytes: 0 })
  })
})

describe('applyColorMap', () => {
  it('swaps the basemap and drops the modulating colour', () => {
    const material = { map: null, color: { r: 0 }, needsUpdate: false }
    const texture = { isTexture: true }

    expect(applyColorMap(material, texture)).toBe(true)
    expect(material.map).toBe(texture)
    expect(material.color).toBeNull()
    expect(material.needsUpdate).toBe(true)
  })

  it('is a no-op when the texture is already applied', () => {
    const texture = { isTexture: true }
    const material = { map: texture, color: null, needsUpdate: false }

    expect(applyColorMap(material, texture)).toBe(false)
    expect(material.needsUpdate).toBe(false)
  })
})
