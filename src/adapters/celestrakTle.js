/**
 * CelesTrak TLE catalogs adapter — Tier B, no key.
 * Fetches several catalog groups sequentially and merges by NORAD ID.
 * https://celestrak.org
 */
import { SOURCE_TIERS } from './types.js'
import { defaultHealth, resolveUrl } from './shared.js'
import { parseTleCatalog } from '../core/satellitePropagation.js'
import { classifySatellitePurpose } from '../core/satellitePurpose.js'

const POLL_MS = 3_600_000
const TLE_GROUPS = ['active', 'stations', 'starlink', 'gps-ops', 'military']
/** CelesTrak asks for spaced requests; keep a gap between catalog groups. */
const GROUP_GAP_MS = 600

/** @type {import('./types.js').SourceAdapter} */
export const celestrakTleAdapter = {
  id: 'celestrak-tle',
  tier: SOURCE_TIERS.B,
  pollIntervalMs: POLL_MS,

  metadata() {
    return {
      label: 'CelesTrak TLE',
      module: 'space',
      dimension: 'environment',
      tier: SOURCE_TIERS.B,
      coverage: 'global',
      authoritative: true,
      requiresKey: false,
      pollIntervalMs: POLL_MS,
      sourceUrl: 'https://celestrak.org',
    }
  },

  buildPollConfig() {
    return {
      format: 'text',
      pollInterval: POLL_MS,
      custom: true,
      tleGroups: TLE_GROUPS,
    }
  },

  async fetchRaw(config, ctx) {
    const groups = config?.tleGroups || TLE_GROUPS
    const merged = []
    const seen = new Set()
    const groupErrors = []

    for (const group of groups) {
      try {
        // Browser: CORS proxy. Server: upstream direct (no CORS; avoids
        // relative `/api/*` + self-HTTP through the Hobby function budget).
        const urls = ctx.serverSide
          ? [
            `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=tle`,
            `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=3le`,
          ]
          : [resolveUrl(`/api/celestrak-tle?group=${encodeURIComponent(group)}`, ctx.baseUrl)]

        let text = null
        let lastErr = null
        for (const url of urls) {
          try {
            text = await ctx.fetchText(url)
            if (text && text.includes('1 ')) break
            lastErr = new Error('Invalid TLE response')
            text = null
          } catch (err) {
            lastErr = err
          }
        }
        if (!text) throw lastErr || new Error('CelesTrak fetch failed')

        for (const entry of parseTleCatalog(text)) {
          const id = entry.noradId
          if (!id || seen.has(id)) continue
          seen.add(id)
          merged.push({ ...entry, _atlasGroup: group })
        }
      } catch (err) {
        groupErrors.push(`${group}: ${err.message || err}`)
      }
      await new Promise((r) => setTimeout(r, GROUP_GAP_MS))
    }

    if (!merged.length) {
      throw new Error(groupErrors.join(' · ') || 'All CelesTrak TLE groups failed')
    }
    merged._warning = groupErrors.length ? groupErrors.join(' · ') : null
    return merged
  },

  normalize(entries, { createEventId, makeEvent }) {
    if (!Array.isArray(entries) || entries.length === 0) return []
    return entries.slice(0, 600).map((entry) => {
      const name = entry.name || 'Satellite'
      const noradId = entry.noradId ?? 0
      const group = entry._atlasGroup || 'active'
      const mil = group === 'military'
      const purposeInfo = classifySatellitePurpose({ name, satelliteGroup: group, isMilitary: mil })
      const opSuffix = purposeInfo.operator ? ` · ${purposeInfo.operator}` : ''
      return makeEvent({
        id: createEventId(0, 0, 0, 'celestrak-tle', String(noradId)),
        dimension: 'environment',
        lat: 0,
        lng: 0,
        latApproximate: false,
        severity: group === 'stations' ? 2 : 1,
        corroborationSources: ['celestrak-tle'],
        ttl: 7200,
        title: name,
        detail: `${purposeInfo.label}${opSuffix} · NORAD ${noradId} · ${group} catalog`,
        source: 'CelesTrak TLE',
        sourceUrl: 'https://celestrak.org',
        tags: ['space', 'satellite', group, purposeInfo.purpose].filter(Boolean),
        trackKind: 'satellite',
        noradId,
        satelliteGroup: group,
        isMilitary: mil,
        satellitePurpose: purposeInfo.purpose,
        satellitePurposeLabel: purposeInfo.label,
        satellitePurposeDetail: purposeInfo.detail,
        satelliteOperator: purposeInfo.operator,
        tleLine1: entry.line1,
        tleLine2: entry.line2,
      })
    })
  },

  health: defaultHealth('CelesTrak TLE'),
}
