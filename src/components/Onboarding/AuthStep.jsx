import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  supabase,
  isSupabaseConfigured,
  markOAuthPending,
  readOAuthCallbackError,
} from '../../services/supabase'
import { useAtlasStore } from '../../store/atlasStore'

/**
 * Sign-in / register form. Used from the header account menu and landing nav.
 * @param {{ onSuccess?: (user: object|null) => void, allowGuest?: boolean, initialMode?: 'idle' | 'signin' | 'register' }} props
 */
export default function AuthStep({ onSuccess, allowGuest = false, initialMode = 'idle' }) {
  const setUser = useAtlasStore((s) => s.setUser)
  const acknowledgeLanding = useAtlasStore((s) => s.acknowledgeLanding)
  const launchWithAllSources = useAtlasStore((s) => s.launchWithAllSources)

  const [mode, setMode] = useState(initialMode === 'idle' ? 'signin' : initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(() => readOAuthCallbackError())
  const [loading, setLoading] = useState(false)
  const [oauthRedirecting, setOauthRedirecting] = useState(false)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const proceed = (user) => {
    if (user) {
      setUser(user)
      acknowledgeLanding()
      launchWithAllSources()
    }
    onSuccess?.(user ?? null)
  }

  const getRedirectUrl = () => {
    if (typeof window === 'undefined') return undefined
    return `${window.location.origin}${window.location.pathname}`
  }

  const handleGoogle = async () => {
    if (!supabase) {
      setError(
        'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart the dev server.',
      )
      return
    }
    setLoading(true)
    setOauthRedirecting(true)
    setError(null)
    markOAuthPending('google')

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getRedirectUrl(),
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
      setOauthRedirecting(false)
    }
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    if (!supabase) {
      setError(
        'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart the dev server.',
      )
      return
    }
    setLoading(true)
    setError(null)

    const cleanEmail = email.trim()

    if (mode === 'register') {
      const { data, error: err } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: getRedirectUrl(),
        },
      })
      if (err) {
        setError(err.message)
      } else if (data?.user?.identities?.length === 0) {
        setError('An account with this email already exists. Try signing in instead.')
      } else if (data?.session && data?.user) {
        // Email confirmation is disabled in Supabase — user is signed in immediately.
        proceed(data.user)
      } else {
        setConfirmationSent(true)
      }
    } else {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })
      if (err) {
        setError(err.message)
      } else {
        proceed(data.user)
      }
    }
    setLoading(false)
  }

  if (confirmationSent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center gap-4"
      >
        <div className="text-[var(--accent)] text-2xl" aria-hidden>✓</div>
        <p className="text-sm text-white/90 leading-relaxed max-w-xs">
          We sent a confirmation link to{' '}
          <span className="text-white font-medium">{email}</span>.
        </p>
        <p className="text-xs text-white/55">Check your inbox, then sign in.</p>
        <button
          type="button"
          onClick={() => { setConfirmationSent(false); setMode('signin') }}
          className="auth-link auth-link-accent mt-2"
        >
          Back to sign in
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="w-full flex flex-col gap-6"
    >
      {!isSupabaseConfigured && (
        <div
          role="status"
          className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-200/90"
        >
          <span className="font-semibold text-amber-100">Auth env missing:</span> add{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[11px]">.env</code> to enable Google OAuth and cloud sync.
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading}
        className="auth-btn-google"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>{oauthRedirecting ? 'Redirecting to Google…' : 'Continue with Google'}</span>
      </button>

      <p className="auth-divider">or use your email</p>

      <form onSubmit={handleEmailAuth} className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="auth-field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="auth-field-input"
            />
          </label>
          <label className="block">
            <span className="auth-field-label">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="auth-field-input"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-xs text-red-400 text-center leading-relaxed">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="auth-btn-primary"
        >
          {loading ? '…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="flex flex-col items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            setError(null)
            setMode(mode === 'register' ? 'signin' : 'register')
          }}
          className="auth-link"
        >
          {mode === 'register' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>

        {(allowGuest || !isSupabaseConfigured) && (
          <button
            type="button"
            onClick={() => {
              acknowledgeLanding()
              launchWithAllSources()
              proceed(null)
            }}
            className="auth-link text-xs"
          >
            Continue without an account
          </button>
        )}
      </div>
    </motion.div>
  )
}
