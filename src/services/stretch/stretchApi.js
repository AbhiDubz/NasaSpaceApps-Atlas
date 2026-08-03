/**
 * Client-side fetch helpers for Phase 6 stretch features.
 * Uses same-origin `/api/*` so Vite's atlas-api-dev plugin serves them in
 * `npm run dev` (no separate vercel/dev:api process required).
 */

/**
 * Search Google Fact Check Tools for claims matching event text.
 * @param {string} query
 * @returns {Promise<{ claims: object[], warning?: string, error?: string }>}
 */
export async function fetchFactCheckClaims(query) {
  if (!query?.trim()) return { claims: [] }
  const params = new URLSearchParams({ query: query.trim().slice(0, 200) })
  const res = await fetch(`/api/fact-check-claims?${params}`)
  if (!res.ok) throw new Error(`Fact check lookup failed (${res.status})`)
  return res.json()
}

/**
 * On-demand Sentinel-2 L2A scene for an AOI.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [days]
 * @returns {Promise<{ scene: object | null, message?: string, error?: string }>}
 */
export async function fetchSentinel2Scene(lat, lng, days = 30) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    days: String(days),
  })
  const res = await fetch(`/api/sentinel2-scene?${params}`)
  if (!res.ok) throw new Error(`Sentinel-2 lookup failed (${res.status})`)
  return res.json()
}
