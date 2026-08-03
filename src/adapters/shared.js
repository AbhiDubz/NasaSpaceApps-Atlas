/**
 * Helpers shared across source adapters.
 * Kept dependency-free so adapters run in the browser worker and on the server.
 */

/**
 * Read a single RSS/XML tag, tolerating CDATA wrappers.
 * @param {string} xml
 * @param {string} tag
 * @returns {string}
 */
export function getXmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))
    || xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return m ? m[1].trim() : ''
}

/**
 * Iterate `<item>` blocks of an RSS document.
 * @param {string} xmlText
 * @returns {string[]}
 */
export function parseRssItems(xmlText) {
  if (!xmlText) return []
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xmlText)) !== null) {
    items.push(match[1])
  }
  return items
}

/**
 * Resolve a same-origin `/api/*` path against an optional origin so adapters
 * that proxy through Vercel routes work outside the browser.
 * @param {string} path
 * @param {string} [baseUrl]
 * @returns {string}
 */
export function resolveUrl(path, baseUrl) {
  if (!path.startsWith('/')) return path
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

/**
 * Standard health reporter — adapters only override when they track more state.
 * @param {string} label
 * @returns {(ctx?: { lastError?: string | null, lastWarning?: string | null }) => import('./types.js').SourceHealth}
 */
export function defaultHealth(label) {
  return (ctx = {}) => {
    if (ctx.lastError) return { status: 'degraded', message: ctx.lastError }
    if (ctx.lastWarning) return { status: 'degraded', message: ctx.lastWarning }
    return { status: 'ok', message: `${label} polling active` }
  }
}
