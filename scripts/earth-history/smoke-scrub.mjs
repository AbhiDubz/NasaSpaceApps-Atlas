/**
 * Headless smoke check for the deep-time scrubber.
 *
 * Drags the timeline across the Phanerozoic and records how many distinct
 * basemap textures the globe actually swapped to, which is the thing that was
 * broken: the picture used to sit frozen until the pointer was released.
 *
 * Usage: node scripts/earth-history/smoke-scrub.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] || 'http://localhost:5173'
const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
// Outside the project so the Vite watcher does not reload the page under test.
const OUT = `${process.env.TEMP || '/tmp'}/eh-smoke-scrub.png`

// Headless Chrome falls back to SwiftShader, where a single 2048x1024 upload can
// cost ~1s and swamps the measurement. HEADED=1 uses the real GPU.
const headed = process.env.HEADED === '1'
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: !headed,
  args: headed
    ? ['--window-size=1440,900']
    : ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
const errors = []
const inflight = new Set()
const failedRequests = new Set()
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
const isTexture = (url) => url.includes('/textures/') || url.includes('earth-blue-marble')
const timings = new Map()
page.on('request', (r) => {
  if (!isTexture(r.url())) return
  inflight.add(r.url())
  timings.set(r.url(), { start: Date.now() })
})
page.on('response', (r) => {
  inflight.delete(r.url())
  const t = timings.get(r.url())
  if (t) t.end = Date.now()
  if (r.status() >= 400) failedRequests.add(`${r.status()} ${r.url()}`)
})
page.on('requestfailed', (r) => {
  inflight.delete(r.url())
  if (isTexture(r.url())) failedRequests.add(`${r.url()} ${r.failure()?.errorText}`)
})

await page.goto(`${BASE}/earth-history`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
await page.waitForSelector('.eh-slider__track', { timeout: 60_000 })
await new Promise((r) => setTimeout(r, 8000))

const track = await page.$('.eh-slider__track')
const box = await track.boundingBox()
const y = box.y + box.height / 2

// A crop of the globe itself. Hashing these tells us whether the rendered Earth
// actually moved with the pointer, which is the behaviour that was broken.
const globeCrop = { x: 620, y: 180, width: 320, height: 320 }
const hash = (buf) => {
  let h = 2166136261
  for (let i = 0; i < buf.length; i += 7) h = Math.imul(h ^ buf[i], 16777619)
  return (h >>> 0).toString(16)
}

const samples = []
const globeHashes = []
await page.mouse.move(box.x + box.width * 0.15, y)
await page.mouse.down()
const DRAG_TO = Number(process.env.DRAG_TO || 0.9)
for (let i = 1; i <= 40; i += 1) {
  const t = 0.15 + ((DRAG_TO - 0.15) * i) / 40
  await page.mouse.move(box.x + box.width * t, y)
  await new Promise((r) => setTimeout(r, 45))
  samples.push(
    await page.evaluate(() => document.querySelector('.eh-slider__bubble-age')?.textContent || ''),
  )
  if (i % 4 === 0) globeHashes.push(hash(await page.screenshot({ clip: globeCrop })))
}
await page.mouse.up()

// How long the sharpen-on-settle pass takes to clear the pending indicator.
const settleStart = Date.now()
timings.clear()
let settleMs = -1
for (let i = 0; i < 60; i += 1) {
  await new Promise((r) => setTimeout(r, 250))
  const pending = await page.evaluate(() =>
    document.body.innerText.includes('Loading map texture'),
  )
  if (!pending) {
    settleMs = Date.now() - settleStart
    break
  }
}

const distinctAges = new Set(samples.filter(Boolean)).size
const unfinished = [...inflight].slice(0, 10)
const failed = [...failedRequests].slice(0, 10)

await page.screenshot({ path: OUT })
console.log(
  JSON.stringify(
    {
      distinctAgesDuringDrag: distinctAges,
      globeSamplesDuringDrag: globeHashes.length,
      distinctGlobeImages: new Set(globeHashes).size,
      settleMs: settleMs < 0 ? 'never cleared within 15s' : settleMs,
      requestsAfterMouseUp: [...timings.entries()].map(([url, t]) => ({
        file: url.split('/').pop(),
        startedAfterMouseUpMs: t.start - settleStart,
        durationMs: t.end ? t.end - t.start : null,
      })),
      requestsStillInFlight: unfinished,
      failedRequests: failed,
      finalAge: samples.at(-1),
      screenshot: OUT,
      errors: errors.slice(0, 10),
    },
    null,
    2,
  ),
)

await browser.close()
