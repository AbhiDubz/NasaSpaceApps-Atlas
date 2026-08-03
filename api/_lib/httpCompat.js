/**
 * Bridge Node IncomingMessage ↔ Web Request/Response for Vercel + Vite.
 *
 * Vite/Hobby deploys often invoke /api handlers as classic Node (req, res).
 * Our route modules are written to the Web Handler shape (Request → Response).
 * Without this adapter, `req.headers.get` / `new URL(req.url)` throw and the
 * platform surfaces FUNCTION_INVOCATION_FAILED.
 */

/**
 * @param {import('http').IncomingMessage | Request} req
 * @returns {Promise<Request>}
 */
export async function toWebRequest(req) {
  if (typeof Request !== 'undefined' && req instanceof Request) return req
  if (typeof req?.headers?.get === 'function' && typeof req.url === 'string') {
    // Request-like (undici / whatwg) — ensure absolute URL
    try {
      // eslint-disable-next-line no-new
      new URL(req.url)
      return /** @type {Request} */ (req)
    } catch {
      const host = typeof req.headers.get === 'function'
        ? (req.headers.get('host') || 'localhost')
        : 'localhost'
      return new Request(new URL(req.url, `https://${host}`), req)
    }
  }

  // Node IncomingMessage
  const headers = /** @type {import('http').IncomingHttpHeaders} */ (req.headers || {})
  const host = String(headers.host || headers['x-forwarded-host'] || 'localhost')
  const proto = String(headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const path = req.url || '/'
  const absolute = path.startsWith('http') ? path : `${proto}://${host}${path}`

  /** @type {Record<string, string>} */
  const h = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue
    h[key] = Array.isArray(value) ? value.join(', ') : String(value)
  }

  const method = (req.method || 'GET').toUpperCase()
  /** @type {RequestInit} */
  const init = { method, headers: h }

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await readNodeBody(req)
    // Node fetch requires duplex when body is a stream; Buffer is fine.
  }

  return new Request(absolute, init)
}

/**
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<Buffer | undefined>}
 */
function readNodeBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
    req.on('error', reject)
  })
}

/**
 * @param {Response} response
 * @param {import('http').ServerResponse} res
 */
export async function sendWebResponse(response, res) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'transfer-encoding') return
    res.setHeader(key, value)
  })
  const buf = Buffer.from(await response.arrayBuffer())
  res.end(buf)
}

/**
 * Wrap a Web Handler so it works for both:
 *   - Web:  handler(Request) => Response
 *   - Node: handler(IncomingMessage, ServerResponse) => void
 *
 * @param {(req: Request) => Promise<Response> | Response} webHandler
 */
export function asVercelHandler(webHandler) {
  return async function vercelHandler(req, res) {
    try {
      // Web Handler invocation (single Request arg, no ServerResponse)
      if (
        res == null
        || (typeof Request !== 'undefined' && req instanceof Request)
        || typeof req?.headers?.get === 'function'
      ) {
        const webReq = await toWebRequest(req)
        return await webHandler(webReq)
      }

      // Classic Node (req, res)
      const webReq = await toWebRequest(req)
      const response = await webHandler(webReq)
      await sendWebResponse(response, res)
    } catch (err) {
      const message = err?.message || String(err)
      console.error('[atlas-api]', message, err?.stack)
      if (res && typeof res.end === 'function' && !res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: message }))
        return
      }
      return new Response(JSON.stringify({ ok: false, error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}
