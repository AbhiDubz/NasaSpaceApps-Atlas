import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:5176'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
].find((p) => existsSync(p))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1376, height: 768 })
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await page.goto(`${BASE}/earth-history`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForSelector('.eh-timeline__panel', { timeout: 45000 })
await new Promise((r) => setTimeout(r, 2000))

const play = await page.$('.eh-timeline__play')
console.log(play ? 'FAIL  play button visible under reduced motion' : 'PASS  autoplay hidden under reduced motion')

const anim = await page.evaluate(() => {
  const el = document.querySelector('.eh-context__body')
  return el ? getComputedStyle(el).animationDuration : null
})
const animSeconds = anim == null ? 0 : parseFloat(anim)
console.log(
  animSeconds < 0.001
    ? `PASS  context crossfade suppressed (${anim})`
    : `FAIL  context animation still ${anim}`,
)

await browser.close()
process.exit(play ? 1 : 0)
