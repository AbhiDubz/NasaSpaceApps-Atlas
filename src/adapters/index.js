/**
 * Source adapter registry — Collection plane entry point.
 *
 * Adapters own transport config, normalization, and health metadata so the
 * browser worker and the server ingest route share one implementation.
 * No source-specific branching may live outside this directory.
 */
import { acledAdapter } from './acled.js'
import { usgsAdapter } from './usgs.js'
import { gdacsAdapter } from './gdacs.js'
import { eonetAdapter } from './eonet.js'
import { firmsAdapter } from './firms.js'
import { noaaNhcAdapter } from './noaaNhc.js'
import { celestrakTleAdapter } from './celestrakTle.js'
import { gdeltCameoAdapter } from './gdeltCameo.js'

/** @type {import('./types.js').SourceAdapter[]} */
export const ADAPTER_REGISTRY = [
  usgsAdapter,
  gdacsAdapter,
  eonetAdapter,
  firmsAdapter,
  noaaNhcAdapter,
  celestrakTleAdapter,
  gdeltCameoAdapter,
  acledAdapter,
]

/** @type {Record<string, import('./types.js').SourceAdapter>} */
export const ADAPTERS_BY_ID = Object.fromEntries(
  ADAPTER_REGISTRY.map((a) => [a.id, a]),
)

/**
 * @param {string} id
 * @returns {import('./types.js').SourceAdapter | null}
 */
export function getAdapter(id) {
  return ADAPTERS_BY_ID[id] || null
}

/**
 * Build poll configs for every adapter whose key requirements are satisfied.
 * @param {Record<string, string>} envKeys
 * @returns {Record<string, import('./types.js').PollConfig>}
 */
export function buildAdapterPollConfigs(envKeys) {
  /** @type {Record<string, import('./types.js').PollConfig>} */
  const out = {}
  for (const adapter of ADAPTER_REGISTRY) {
    const cfg = adapter.buildPollConfig(envKeys)
    if (cfg) out[adapter.id] = cfg
  }
  return out
}

/**
 * Wrap every adapter's `normalize` with shared event-factory deps, producing
 * the `sourceId -> (raw) => events` shape the worker's dispatch table expects.
 * @param {import('./types.js').NormalizeDeps} deps
 * @returns {Record<string, (raw: unknown) => object[]>}
 */
export function buildAdapterNormalizers(deps) {
  /** @type {Record<string, (raw: unknown) => object[]>} */
  const out = {}
  for (const adapter of ADAPTER_REGISTRY) {
    out[adapter.id] = (raw) => adapter.normalize(raw, deps)
  }
  return out
}

export { acledAdapter } from './acled.js'
export { usgsAdapter } from './usgs.js'
export { gdacsAdapter } from './gdacs.js'
export { eonetAdapter } from './eonet.js'
export { firmsAdapter } from './firms.js'
export { noaaNhcAdapter } from './noaaNhc.js'
export { celestrakTleAdapter } from './celestrakTle.js'
export { gdeltCameoAdapter } from './gdeltCameo.js'
export * from './types.js'
