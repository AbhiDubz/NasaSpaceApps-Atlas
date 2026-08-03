/**
 * Pull raw SVG icons from Iconify into scripts/.icon-cache/
 *
 * Prefer Iconify CLI when available; fall back to the public Iconify API.
 *
 * Usage: node scripts/icons-pull.mjs
 */

import { spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const MANIFEST = join(__dirname, 'atlas-marker-icons.txt')
const CACHE_DIR = join(__dirname, '.icon-cache')

function parseManifest(text) {
  const entries = []
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [atlasId, iconifyId] = trimmed.split(/\s+/)
    if (!atlasId || !iconifyId || !iconifyId.includes(':')) {
      console.warn(`[icons:pull] skip malformed line: ${line}`)
      continue
    }
    entries.push({ atlasId, iconifyId })
  }
  return entries
}

function tryIconifyCli(iconifyIds) {
  // Package is `iconify-cli`; binary command is `iconify`.
  const localBin = join(ROOT, 'node_modules', '.bin', 'iconify')
  const attempts = [
    { cmd: localBin, args: ['download', ...iconifyIds, '-o', CACHE_DIR, '-t', 'svg', '-p', 'flat'] },
    { cmd: 'npx', args: ['--yes', 'iconify-cli', 'download', ...iconifyIds, '-o', CACHE_DIR, '-t', 'svg', '-p', 'flat'] },
  ]

  for (const attempt of attempts) {
    const result = spawnSync(attempt.cmd, attempt.args, {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    })
    if (result.status === 0) {
      console.log(`[icons:pull] Iconify CLI ok (${attempt.cmd})`)
      return true
    }
  }
  console.warn('[icons:pull] Iconify CLI unavailable or failed — using Iconify API fallback')
  return false
}

async function downloadViaApi(iconifyId, outPath) {
  const [prefix, name] = iconifyId.split(':')
  const url = `https://api.iconify.design/${prefix}/${name}.svg`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${iconifyId} → HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath))
}

async function main() {
  const text = await readFile(MANIFEST, 'utf8')
  const entries = parseManifest(text)
  if (!entries.length) {
    console.error('[icons:pull] manifest empty')
    process.exit(1)
  }

  await mkdir(CACHE_DIR, { recursive: true })

  const uniqueIds = [...new Set(entries.map((e) => e.iconifyId))]
  const usedCli = tryIconifyCli(uniqueIds)

  // Always ensure each iconify id exists as <prefix>--<name>.svg (CLI naming varies).
  // Normalize to a stable cache filename: <prefix>__<name>.svg
  for (const iconifyId of uniqueIds) {
    const [prefix, name] = iconifyId.split(':')
    const stable = join(CACHE_DIR, `${prefix}__${name}.svg`)
    try {
      // Prefer whatever CLI wrote; otherwise pull via API.
      const candidates = [
        join(CACHE_DIR, `${prefix}__${name}.svg`),
        join(CACHE_DIR, `${prefix}-${name}.svg`),
        join(CACHE_DIR, `${name}.svg`),
        join(CACHE_DIR, `${prefix}_${name}.svg`),
      ]
      let found = null
      for (const c of candidates) {
        try {
          const raw = await readFile(c, 'utf8')
          if (raw.includes('<svg')) {
            found = raw
            break
          }
        } catch {
          /* missing */
        }
      }
      if (!found) {
        if (usedCli) console.warn(`[icons:pull] CLI miss for ${iconifyId}, fetching API`)
        await downloadViaApi(iconifyId, stable)
      } else if (!found.includes('xmlns') && !found.startsWith('<svg')) {
        await downloadViaApi(iconifyId, stable)
      } else {
        await writeFile(stable, found, 'utf8')
      }
      console.log(`[icons:pull] ${iconifyId}`)
    } catch (err) {
      console.error(`[icons:pull] failed ${iconifyId}:`, err.message)
      process.exitCode = 1
    }
  }

  // Write role → iconify map for the build step
  const map = Object.fromEntries(entries.map((e) => [e.atlasId, e.iconifyId]))
  await writeFile(join(CACHE_DIR, 'manifest.json'), `${JSON.stringify(map, null, 2)}\n`, 'utf8')
  console.log(`[icons:pull] ${entries.length} roles → ${CACHE_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
