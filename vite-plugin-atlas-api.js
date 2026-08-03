/**
 * Vite dev middleware — serves /api/* handlers without requiring `vercel dev`.
 * Loads `.env` / `.env.local` so server-only keys work in `npm run dev`.
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'

const pluginRoot = path.dirname(fileURLToPath(import.meta.url))
const routesRoot = path.join(pluginRoot, 'api/_lib/routes')

/** @param {import('http').IncomingMessage} req */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** @param {import('http').IncomingMessage} req @param {import('http').ServerResponse} res @param {Response} response */
async function sendWebResponse(req, res, response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    res.setHeader(key, value)
  })
  const buf = Buffer.from(await response.arrayBuffer())
  res.end(buf)
}

/** @param {import('http').IncomingMessage} req */
async function toWebRequest(req, url) {
  const method = req.method || 'GET'
  /** @type {Record<string, string>} */
  const headers = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null) headers[k] = Array.isArray(v) ? v.join(', ') : v
  }
  let body
  if (method !== 'GET' && method !== 'HEAD') {
    body = await readBody(req)
  }
  return new Request(url, { method, headers, body })
}

function route(name, opts = {}) {
  return {
    methods: opts.methods || [opts.method || 'GET'],
    match: new RegExp(`^\\/api\\/${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/?$`),
    module: path.join(routesRoot, `${name}.js`),
    style: opts.style || 'web',
  }
}

// Handlers live under api/_lib/routes/ (same modules production catch-all uses).
const DEV_API_ROUTES = [
  route('opensky-states'),
  route('celestrak-tle'),
  route('aisstream-ships'),
  route('cameras'),
  route('nhc-storms'),
  route('gdacs-rss'),
  route('feed-proxy', { methods: ['GET', 'OPTIONS'] }),
  route('gdelt-api', { methods: ['GET', 'OPTIONS'] }),
  route('gdelt-data', { methods: ['GET', 'OPTIONS'] }),
  route('news-proxy', { methods: ['GET', 'OPTIONS'] }),
  route('feed-snapshots', { methods: ['GET', 'POST', 'OPTIONS'] }),
  route('overpass-landmarks', { methods: ['POST'] }),
  route('gdelt-query', { methods: ['GET', 'POST', 'OPTIONS'], style: 'node' }),
  route('indicators', { methods: ['GET', 'OPTIONS'] }),
  route('bluesky-posts', { methods: ['GET', 'OPTIONS'] }),
  route('fact-check-claims', { methods: ['GET', 'OPTIONS'] }),
  route('sentinel2-scene', { methods: ['GET', 'OPTIONS'] }),
  route('entities', { methods: ['GET', 'POST', 'OPTIONS'] }),
  route('ingest', { methods: ['GET', 'POST', 'OPTIONS'] }),
  route('seed-ontology', { methods: ['POST', 'OPTIONS'] }),
  route('ontology', { methods: ['GET', 'POST', 'OPTIONS'] }),
  route('annotations', { methods: ['GET', 'POST', 'DELETE', 'OPTIONS'] }),
  route('investigations', { methods: ['GET', 'PUT', 'OPTIONS'] }),
  route('contact', { methods: ['POST', 'OPTIONS'] }),
  route('export-report', { methods: ['POST', 'OPTIONS'], style: 'node' }),
  route('export-report-status', { methods: ['GET', 'OPTIONS'], style: 'node' }),
]

/** @type {Map<string, { default: Function }>} */
const handlerCache = new Map()

async function loadHandler(modulePath) {
  if (handlerCache.has(modulePath)) return handlerCache.get(modulePath)
  const mod = await import(pathToFileURL(modulePath).href)
  handlerCache.set(modulePath, mod)
  return mod
}

export default function atlasApiDevPlugin() {
  return {
    name: 'atlas-api-dev',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root || process.cwd(), '')
      for (const [key, val] of Object.entries(env)) {
        if (val) process.env[key] = val
      }

      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (!pathname.startsWith('/api/')) return next()

        const method = (req.method || 'GET').toUpperCase()
        const hit = DEV_API_ROUTES.find((r) => {
          const methods = r.methods || [r.method]
          return methods.map((m) => m.toUpperCase()).includes(method) && r.match.test(pathname)
        })
        if (!hit) return next()

        try {
          const mod = await loadHandler(hit.module)
          const handler = mod.default
          if (hit.style === 'node') {
            await handler(req, res)
            return
          }
          const host = req.headers.host || 'localhost'
          const url = `http://${host}${req.url}`
          const webReq = await toWebRequest(req, url)
          const response = await handler(webReq)
          await sendWebResponse(req, res, response)
        } catch (err) {
          console.error('[atlas-api]', pathname, err)
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message || 'API handler failed' }))
          }
        }
      })
    },
  }
}
