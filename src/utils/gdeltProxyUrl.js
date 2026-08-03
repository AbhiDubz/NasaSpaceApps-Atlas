/**
 * Rewrite GDELT REST URLs to same-origin proxy (avoids CORS in browser/worker).
 */

const GDELT_API_ORIGIN = 'https://api.gdeltproject.org'

export function gdeltApiProxyUrl(absoluteUrl) {
  try {
    const u = new URL(absoluteUrl)
    if (u.origin !== GDELT_API_ORIGIN) return absoluteUrl
    const path = u.pathname.replace(/^\/api\/v2\//, '')
    if (!path) return absoluteUrl
    const params = new URLSearchParams(u.searchParams)
    params.set('path', path)
    return `/api/gdelt-api?${params}`
  } catch {
    return absoluteUrl
  }
}

const GDELT_DATA_ORIGIN = 'https://data.gdeltproject.org'

/**
 * Rewrite data.gdeltproject.org URLs (HTTP mixed-content safe).
 * Pass `direct: true` off the browser, where the proxy hop buys nothing.
 * @param {string} absoluteUrl
 * @param {{ direct?: boolean }} [opts]
 */
export function gdeltDataProxyUrl(absoluteUrl, { direct = false } = {}) {
  try {
    const u = new URL(absoluteUrl)
    if (u.hostname !== 'data.gdeltproject.org') return absoluteUrl
    if (direct) return `${GDELT_DATA_ORIGIN}${u.pathname}${u.search}`
    const file = u.pathname.replace(/^\/+/, '')
    if (!file) return absoluteUrl
    return `/api/gdelt-data?file=${encodeURIComponent(file)}`
  } catch {
    return absoluteUrl
  }
}

/**
 * @param {string} relativePath
 * @param {{ direct?: boolean }} [opts]
 */
export function gdeltDataProxyFile(relativePath, { direct = false } = {}) {
  const file = String(relativePath || '').replace(/^\/+/, '')
  if (direct) return `${GDELT_DATA_ORIGIN}/${file}`
  return `/api/gdelt-data?file=${encodeURIComponent(file)}`
}
