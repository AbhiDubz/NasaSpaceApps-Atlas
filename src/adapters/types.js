/**
 * Source adapter contract — Collection plane (Phase 4).
 * Each adapter owns transport config, normalization, and health metadata.
 */

/** @typedef {'A' | 'B' | 'C'} SourceTier */

/**
 * @typedef {object} SourceHealth
 * @property {'ok' | 'degraded' | 'unavailable'} status
 * @property {string} [message]
 * @property {number} [lastFetchMs]
 */

/**
 * @typedef {object} SourceMetadata
 * @property {string} label
 * @property {string} module
 * @property {string} dimension
 * @property {SourceTier} tier
 * @property {'global' | 'regional' | 'approximate'} coverage
 * @property {boolean} authoritative
 * @property {boolean} requiresKey
 * @property {number} pollIntervalMs
 * @property {string} [sourceUrl]
 * @property {string} [apiKeyHelpUrl]
 */

/**
 * @typedef {object} PollConfig
 * @property {string} [url] — omitted when the adapter supplies `fetchRaw`
 * @property {'json' | 'text'} format
 * @property {number} pollInterval
 * @property {Record<string, string>} [headers]
 * @property {boolean} [custom] — true when transport runs through `fetchRaw`
 */

/**
 * Transport context passed to `fetchRaw`. Lets the same adapter run inside the
 * browser worker (relative proxy URLs) and on the server (absolute origin).
 * @typedef {object} FetchContext
 * @property {string} [baseUrl] — origin to prefix onto same-origin `/api/*` routes
 * @property {boolean} [serverSide] — true outside the browser; lets adapters skip CORS proxies
 * @property {(url: string, opts?: object) => Promise<any>} fetchJson
 * @property {(url: string, opts?: object) => Promise<string>} fetchText
 * @property {AbortSignal} [signal]
 */

/**
 * @typedef {object} SourceAdapter
 * @property {string} id
 * @property {SourceTier} tier
 * @property {number} pollIntervalMs
 * @property {string[]} [requiredEnv]
 * @property {() => SourceMetadata} metadata
 * @property {(envKeys: Record<string, string>) => PollConfig | null} buildPollConfig
 * @property {(raw: unknown, deps: NormalizeDeps) => object[]} normalize
 * @property {(ctx?: { lastError?: string | null }) => SourceHealth} health
 * @property {(config: PollConfig, ctx: FetchContext) => Promise<unknown>} [fetchRaw]
 *   Multi-leg or non-URL transport. When present, callers use this instead of
 *   fetching `config.url` directly.
 * @property {(raw: unknown) => object | null} [aggregate]
 *   Side-channel reduction over the full raw payload (e.g. GDELT country
 *   aggregates for the choropleth), computed before pin filtering.
 */

/**
 * @typedef {object} NormalizeDeps
 * @property {(lat: number, lng: number, timestamp: number, source: string, title: string) => string} createEventId
 * @property {(fields: Record<string, unknown>) => object} makeEvent
 */

export const SOURCE_TIERS = /** @type {const} */ ({
  A: 'A',
  B: 'B',
  C: 'C',
})
