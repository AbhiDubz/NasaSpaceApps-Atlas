/**
 * Catch-all API router — keeps the Hobby plan under the 12-function limit.
 * Individual handlers live in api/_lib/routes/ (not counted as functions).
 *
 * Node-runtime routes (BigQuery, Puppeteer PDF) stay as separate entry files.
 * ingest + seed-ontology also have dedicated entries for clearer timeouts.
 */
import { asVercelHandler } from './_lib/httpCompat.js'

const WEB_ROUTES = {
  'opensky-states': () => import('./_lib/routes/opensky-states.js'),
  'celestrak-tle': () => import('./_lib/routes/celestrak-tle.js'),
  'aisstream-ships': () => import('./_lib/routes/aisstream-ships.js'),
  cameras: () => import('./_lib/routes/cameras.js'),
  'nhc-storms': () => import('./_lib/routes/nhc-storms.js'),
  'gdacs-rss': () => import('./_lib/routes/gdacs-rss.js'),
  'feed-proxy': () => import('./_lib/routes/feed-proxy.js'),
  'gdelt-api': () => import('./_lib/routes/gdelt-api.js'),
  'gdelt-data': () => import('./_lib/routes/gdelt-data.js'),
  'news-proxy': () => import('./_lib/routes/news-proxy.js'),
  'feed-snapshots': () => import('./_lib/routes/feed-snapshots.js'),
  'overpass-landmarks': () => import('./_lib/routes/overpass-landmarks.js'),
  indicators: () => import('./_lib/routes/indicators.js'),
  'bluesky-posts': () => import('./_lib/routes/bluesky-posts.js'),
  'fact-check-claims': () => import('./_lib/routes/fact-check-claims.js'),
  'sentinel2-scene': () => import('./_lib/routes/sentinel2-scene.js'),
  entities: () => import('./_lib/routes/entities.js'),
  ingest: () => import('./_lib/routes/ingest.js'),
  'seed-ontology': () => import('./_lib/routes/seed-ontology.js'),
  ontology: () => import('./_lib/routes/ontology.js'),
  annotations: () => import('./_lib/routes/annotations.js'),
  investigations: () => import('./_lib/routes/investigations.js'),
  contact: () => import('./_lib/routes/contact.js'),
  'nasa-power': () => import('./_lib/routes/nasa-power.js'),
  trend: () => import('./_lib/routes/trend.js'),
}

export const config = {
  maxDuration: 60,
}

async function dispatch(req) {
  const url = new URL(req.url)
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
  const route = parts[0] || ''

  const loader = WEB_ROUTES[route]
  if (!loader) {
    return new Response(JSON.stringify({ error: 'Not found', route }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const mod = await loader()
  return mod.default(req)
}

export default asVercelHandler(dispatch)
