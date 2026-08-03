/**
 * One-shot browser verification for the Earth History HUD redesign.
 * Usage: node scripts/earth-history/verify-hud.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'http://localhost:5173'
const OUT = path.resolve('screenshots-verify')
mkdirSync(OUT, { recursive: true })

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!executablePath) {
  console.error('FAIL: no Chrome/Edge executable found')
  process.exit(1)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1376, height: 768 })
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message))

  await page.goto(`${BASE}/earth-history`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.eh-app', { timeout: 45000 })
  await page.waitForSelector('.eh-chrome--ready', { timeout: 60000 }).catch(() => null)
  await new Promise((r) => setTimeout(r, 2500))

  const chromeReady = await page.$('.eh-chrome--ready')
  check('chrome fades in when globe ready', Boolean(chromeReady))

  await page.screenshot({ path: path.join(OUT, '01-default.png') })

  // --- Scrubber geometry ---
  const rail = await page.$('.eh-scrub__rail')
  check('drag rail present', Boolean(rail))
  const box = await rail.boundingBox()

  const playheadAt = () =>
    page.evaluate(() => {
      const el = document.querySelector('.eh-scrub__rail')
      return Number(el?.getAttribute('aria-valuenow'))
    })

  const thumbX = () =>
    page.evaluate(() => {
      const t = document.querySelector('.eh-scrub__thumb')
      return t ? t.getBoundingClientRect().x : null
    })

  // 1. Drag starting from the dead CENTRE of the rail (the old dead zone)
  const before = await playheadAt()
  const cy = box.y + box.height / 2
  await page.mouse.move(box.x + box.width * 0.5, cy)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.3, cy, { steps: 12 })
  const during = await playheadAt()
  check('centre-of-rail drag scrubs', during !== before, `ybp ${before} → ${during}`)

  // Thumb tracks the cursor while the button is still down
  const tx = await thumbX()
  const cursorX = box.x + box.width * 0.3
  check(
    'thumb does not trail the cursor',
    tx != null && Math.abs(tx + 7 - cursorX) < 12,
    `thumb@${(tx + 7).toFixed(1)} cursor@${cursorX.toFixed(1)}`,
  )
  await page.mouse.up()

  // 2. Both extremes reachable (pointerup commits exact position)
  await page.mouse.move(box.x + box.width * 0.5, cy)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width + 40, cy, { steps: 8 })
  await page.mouse.up()
  const atEnd = await playheadAt()
  const range = await page.evaluate(() => {
    const el = document.querySelector('.eh-scrub__rail')
    return {
      min: Number(el.getAttribute('aria-valuemin')),
      max: Number(el.getAttribute('aria-valuemax')),
    }
  })
  check('right extreme (Present) reachable', atEnd === range.min, `ybp=${atEnd}`)

  await page.mouse.move(box.x + box.width * 0.5, cy)
  await page.mouse.down()
  await page.mouse.move(box.x - 40, cy, { steps: 8 })
  await page.mouse.up()
  const atStart = await playheadAt()
  check('left extreme (range start) reachable', atStart === range.max, `ybp=${atStart}`)

  // 3. Keyboard on the rail
  await rail.focus()
  const kbBefore = await playheadAt()
  await page.keyboard.press('ArrowRight')
  await new Promise((r) => setTimeout(r, 120))
  const kbAfter = await playheadAt()
  check('arrow key steps the playhead', kbAfter !== kbBefore, `${kbBefore} → ${kbAfter}`)
  await page.keyboard.press('Home')
  await new Promise((r) => setTimeout(r, 120))
  check('Home returns to range start', (await playheadAt()) === range.max)

  // --- Panels: only one open at a time ---
  await page.click('.eh-header__layers')
  await new Promise((r) => setTimeout(r, 300))
  const drawerOpen1 = await page.$('.eh-drawer')
  check('Layers button opens drawer', Boolean(drawerOpen1))
  await page.screenshot({ path: path.join(OUT, '02-drawer.png') })

  await page.click('.eh-timeline__settings')
  await new Promise((r) => setTimeout(r, 300))
  const drawerAfterPop = await page.$('.eh-drawer')
  const popOpen = await page.$('.eh-pop')
  check('settings popover opens', Boolean(popOpen))
  check('opening popover closes drawer (one panel at a time)', !drawerAfterPop)
  await page.screenshot({ path: path.join(OUT, '03-popover.png') })

  // Escape closes the popover
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 200))
  check('Escape closes popover', !(await page.$('.eh-pop')))

  // World tab
  await page.click('.eh-header__layers')
  await new Promise((r) => setTimeout(r, 200))
  const tabs = await page.$$('.eh-drawer__tab')
  await tabs[1].click()
  await new Promise((r) => setTimeout(r, 400))
  const almanac = await page.$('.eh-almanac')
  check('WORLD tab shows almanac', Boolean(almanac))
  await page.screenshot({ path: path.join(OUT, '04-world.png') })
  await page.keyboard.press('Escape')

  // --- Fonts + numerics ---
  const readout = await page.evaluate(() => {
    const el = document.querySelector('.eh-timeline__readout-age')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { font: cs.fontFamily, variant: cs.fontVariantNumeric, color: cs.color }
  })
  check(
    'readout is mono + tabular-nums',
    Boolean(readout && /JetBrains|mono/i.test(readout.font) && /tabular-nums/.test(readout.variant)),
    JSON.stringify(readout),
  )
  const uiFont = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.eh-context__label')).fontFamily,
  )
  check('UI font is Source Sans 3 (not Inter)', /Source Sans 3/i.test(uiFont), uiFont)

  await page.screenshot({ path: path.join(OUT, '05-final.png') })

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
} finally {
  await browser.close()
}
