/**
 * POST /api/contact
 * Landing-page contact + feedback intake. Delivers to the ATLAS inbox via Resend.
 *
 * Body: { topic, name?, email, message, website?, startedAt?, diagnostics? }
 *   topic       — 'message' | 'bug' | 'feature'
 *   website     — honeypot; must be empty
 *   startedAt   — client epoch ms when the form opened; guards instant bot posts
 *   diagnostics — optional { userAgent, viewport, url, timezone } for bug reports
 */
import { z } from 'zod'

export const config = {
  maxDuration: 15,
}

const TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'shreyassunke005@gmail.com'
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || 'ATLAS <onboarding@resend.dev>'

const TOPIC_LABELS = {
  message: 'Message',
  bug: 'Bug report',
  feature: 'Feature request',
}

const ContactSchema = z.object({
  topic: z.enum(['message', 'bug', 'feature']).default('message'),
  name: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().email().max(200),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional().default(''),
  startedAt: z.number().int().positive().optional(),
  diagnostics: z
    .object({
      userAgent: z.string().max(400).optional(),
      viewport: z.string().max(40).optional(),
      url: z.string().max(500).optional(),
      timezone: z.string().max(80).optional(),
    })
    .optional(),
})

/**
 * Best-effort per-instance throttle. Serverless instances are ephemeral, so this
 * only blunts bursts from a single client rather than enforcing a global quota.
 */
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const hits = new Map()

function rateLimited(key) {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_LIMIT_WINDOW_MS)) hits.delete(k)
    }
  }
  return false
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmail(data) {
  const label = TOPIC_LABELS[data.topic]
  const from = data.name ? `${data.name} <${data.email}>` : data.email
  const meta = [
    ['From', from],
    ['Topic', label],
    ['Received', new Date().toISOString()],
  ]

  if (data.diagnostics) {
    const d = data.diagnostics
    if (d.url) meta.push(['Page', d.url])
    if (d.viewport) meta.push(['Viewport', d.viewport])
    if (d.timezone) meta.push(['Timezone', d.timezone])
    if (d.userAgent) meta.push(['Browser', d.userAgent])
  }

  const text = [
    `ATLAS — ${label}`,
    '',
    ...meta.map(([k, v]) => `${k}: ${v}`),
    '',
    '---',
    '',
    data.message,
  ].join('\n')

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;">ATLAS</div>
        <div style="font-size:18px;font-weight:600;margin-top:4px;">${escapeHtml(label)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${meta
          .map(
            ([k, v]) => `<tr>
          <td style="padding:8px 24px;color:#6b7280;width:110px;vertical-align:top;border-bottom:1px solid #f3f4f6;">${escapeHtml(k)}</td>
          <td style="padding:8px 24px;color:#111827;word-break:break-word;border-bottom:1px solid #f3f4f6;">${escapeHtml(v)}</td>
        </tr>`,
          )
          .join('')}
      </table>
      <div style="padding:20px 24px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
      <div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
        Reply directly to this email to respond to ${escapeHtml(data.email)}.
      </div>
    </div>
  </body>
</html>`

  return { text, html, subject: `[ATLAS · ${label}] ${from}` }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405)
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY is not configured')
    return json(
      { ok: false, error: 'Messaging is not configured on this server yet.' },
      503,
    )
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (rateLimited(ip)) {
    return json(
      { ok: false, error: 'Too many messages from this connection. Try again in a few minutes.' },
      429,
    )
  }

  let payload
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, error: 'Could not read the request.' }, 400)
  }

  const parsed = ContactSchema.safeParse(payload)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path?.[0]
    const messages = {
      email: 'Enter an email address we can reply to.',
      message: 'Your message needs at least 10 characters.',
      website: 'That submission looked automated.',
    }
    return json({ ok: false, error: messages[field] || 'Check the form and try again.' }, 400)
  }

  const data = parsed.data

  // A human cannot open the panel and submit a real message in under two seconds.
  if (data.startedAt && Date.now() - data.startedAt < 2000) {
    return json({ ok: false, error: 'That submission looked automated.' }, 400)
  }

  const { subject, text, html } = buildEmail(data)

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: data.email,
        subject,
        text,
        html,
      }),
    })

    if (!resp.ok) {
      const detail = await resp.text()
      console.error(`[contact] Resend ${resp.status}: ${detail}`)
      return json({ ok: false, error: 'We could not send that just now. Please try again.' }, 502)
    }

    const result = await resp.json().catch(() => ({}))
    return json({ ok: true, id: result?.id ?? null })
  } catch (err) {
    console.error('[contact] delivery failed:', err)
    return json({ ok: false, error: 'We could not send that just now. Please try again.' }, 502)
  }
}
