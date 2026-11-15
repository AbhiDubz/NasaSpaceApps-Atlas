import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

export const AUTH_STORAGE_KEY = 'atlas_auth_session'
export const OAUTH_PENDING_KEY = 'atlas_oauth_pending'

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: AUTH_STORAGE_KEY,
        },
      })
    : null

export const isSupabaseConfigured = Boolean(supabase)

/** Record that the browser is leaving for an OAuth redirect so return skips the landing page. */
export function markOAuthPending(context = 'app') {
  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify({ context, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

export function consumeOAuthPending() {
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY)
    if (!raw) return null
    sessionStorage.removeItem(OAUTH_PENDING_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** True when the current URL carries OAuth return parameters (implicit hash or PKCE code). */
export function hasOAuthCallbackParams(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return false
  const hash = loc.hash || ''
  const search = loc.search || ''
  if (/(?:^|[#&])(access_token|refresh_token|error|error_description)=/.test(hash)) return true
  const params = new URLSearchParams(search)
  return params.has('code') || params.has('error') || params.has('error_description')
}

/** Read an OAuth error message from the callback URL, if any. */
export function readOAuthCallbackError(loc = typeof window !== 'undefined' ? window.location : null) {
  if (!loc) return null
  const searchParams = new URLSearchParams(loc.search || '')
  const hashParams = new URLSearchParams((loc.hash || '').replace(/^#/, ''))
  const desc =
    searchParams.get('error_description') ||
    hashParams.get('error_description') ||
    searchParams.get('error') ||
    hashParams.get('error')
  return desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : null
}

/** Remove OAuth tokens / codes from the address bar once Supabase has processed them. */
export function scrubOAuthCallbackUrl() {
  if (typeof window === 'undefined') return
  try {
    const url = new URL(window.location.href)
    let dirty = false
    for (const k of ['code', 'error', 'error_code', 'error_description', 'provider_token', 'state']) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k)
        dirty = true
      }
    }
    if (/(?:^|[#&])(access_token|refresh_token|error|error_description)=/.test(url.hash)) {
      url.hash = ''
      dirty = true
    }
    if (dirty) {
      window.history.replaceState({}, '', url.toString())
    }
  } catch {
    /* ignore */
  }
}

/** Synchronous check used at store boot so signed-in reloads skip the marketing landing screen. */
export function hasStoredAuthSession() {
  if (typeof window === 'undefined') return false
  try {
    const direct = localStorage.getItem(AUTH_STORAGE_KEY)
    if (direct) {
      const parsed = JSON.parse(direct)
      if (parsed?.access_token || parsed?.currentSession?.access_token) return true
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && /^sb-.*-auth-token$/.test(k)) {
        const parsed = JSON.parse(localStorage.getItem(k) || 'null')
        if (parsed?.access_token || parsed?.currentSession?.access_token) return true
      }
    }
  } catch {
    /* ignore */
  }
  return false
}
