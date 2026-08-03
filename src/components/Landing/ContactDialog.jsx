import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const TOPICS = [
  { id: 'message', label: 'Message' },
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature' },
]

const TOPIC_COPY = {
  message: {
    title: 'Send a message',
    hint: 'Questions, partnerships, or press — this reaches a person, not a queue.',
    placeholder: 'What would you like to talk about?',
  },
  bug: {
    title: 'Report a bug',
    hint: 'Tell us what happened and what you expected instead.',
    placeholder: 'Steps to reproduce, what you saw, what you expected…',
  },
  feature: {
    title: 'Request a feature',
    hint: 'Describe the analytic problem — we design from the problem, not the feature.',
    placeholder: 'What are you trying to do that ATLAS makes hard today?',
  },
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function collectDiagnostics() {
  if (typeof window === 'undefined') return undefined
  return {
    userAgent: navigator.userAgent.slice(0, 400),
    viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    url: window.location.href.slice(0, 500),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

export default function ContactDialog({ initialTopic = 'message', onClose }) {
  const reduceMotion = useReducedMotion()
  const panelRef = useRef(null)
  const emailRef = useRef(null)
  const messageRef = useRef(null)
  const openedAt = useRef(Date.now())
  const restoreFocusTo = useRef(null)

  const uid = useId()
  const emailId = `${uid}-email`
  const nameId = `${uid}-name`
  const messageId = `${uid}-message`
  const titleId = `${uid}-title`
  const errorId = `${uid}-error`

  const [topic, setTopic] = useState(initialTopic)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)

  const copy = TOPIC_COPY[topic]
  const sending = status === 'sending'

  useEffect(() => {
    restoreFocusTo.current = document.activeElement
    emailRef.current?.focus()

    // The landing page is its own scroll container; freeze it so the globe
    // does not drift behind the dialog.
    const scroller = document.querySelector('.landing-page')
    const previousOverflow = scroller?.style.overflow
    if (scroller) scroller.style.overflow = 'hidden'

    return () => {
      if (scroller) scroller.style.overflow = previousOverflow ?? ''
      const el = restoreFocusTo.current
      if (el && typeof el.focus === 'function') el.focus()
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE)
      if (!nodes?.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()), [email])

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setError(null)

      if (!emailValid) {
        setFieldError('email')
        setError('Enter an email address we can reply to.')
        emailRef.current?.focus()
        return
      }
      if (message.trim().length < 10) {
        setFieldError('message')
        setError('Add a little more detail — at least 10 characters.')
        messageRef.current?.focus()
        return
      }

      setFieldError(null)
      setStatus('sending')

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            name: name.trim(),
            email: email.trim(),
            message: message.trim(),
            website,
            startedAt: openedAt.current,
            diagnostics: topic === 'bug' ? collectDiagnostics() : undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.ok) {
          setStatus('idle')
          setError(data.error || 'We could not send that just now. Please try again.')
          return
        }
        setStatus('sent')
      } catch {
        setStatus('idle')
        setError('Network problem — check your connection and try again.')
      }
    },
    [emailValid, message, name, email, topic, website],
  )

  const resetForNewMessage = useCallback(() => {
    setMessage('')
    setStatus('idle')
    setError(null)
    openedAt.current = Date.now()
    window.setTimeout(() => messageRef.current?.focus(), 0)
  }, [])

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 14, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.99 },
      }

  return (
    <motion.div
      className="atlas-contact-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="atlas-contact"
        {...panelMotion}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="atlas-contact__head">
          <h2 id={titleId} className="atlas-contact__title">
            {status === 'sent' ? 'Message sent' : copy.title}
          </h2>
          <button
            type="button"
            className="atlas-contact__close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {status === 'sent' ? (
          <div className="atlas-contact__done">
            <p className="atlas-contact__done-body">
              Thanks — this landed in the ATLAS inbox. We reply to{' '}
              <span className="atlas-contact__done-email">{email.trim()}</span>, usually within a
              couple of days.
            </p>
            <div className="atlas-contact__done-actions">
              <button type="button" className="atlas-btn atlas-btn--primary" onClick={onClose}>
                Done
              </button>
              <button type="button" className="atlas-btn atlas-btn--ghost" onClick={resetForNewMessage}>
                Send another
              </button>
            </div>
          </div>
        ) : (
          <form className="atlas-contact__form" onSubmit={handleSubmit} noValidate>
            <div className="atlas-contact__topics" role="group" aria-label="What is this about?">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`atlas-contact__topic${topic === t.id ? ' is-active' : ''}`}
                  aria-pressed={topic === t.id}
                  disabled={sending}
                  onClick={() => setTopic(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <p className="atlas-contact__hint">{copy.hint}</p>

            <div className="atlas-contact__row">
              <div className="atlas-contact__field">
                <label className="atlas-contact__label" htmlFor={emailId}>
                  Email
                </label>
                <input
                  ref={emailRef}
                  id={emailId}
                  type="email"
                  className={`atlas-contact__input${fieldError === 'email' ? ' is-invalid' : ''}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldError === 'email') setFieldError(null)
                  }}
                  placeholder="you@domain.com"
                  autoComplete="email"
                  required
                  disabled={sending}
                  aria-invalid={fieldError === 'email'}
                  aria-describedby={error ? errorId : undefined}
                />
              </div>
              <div className="atlas-contact__field">
                <label className="atlas-contact__label" htmlFor={nameId}>
                  Name <span className="atlas-contact__optional">optional</span>
                </label>
                <input
                  id={nameId}
                  type="text"
                  className="atlas-contact__input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should we address you?"
                  autoComplete="name"
                  disabled={sending}
                />
              </div>
            </div>

            <div className="atlas-contact__field">
              <label className="atlas-contact__label" htmlFor={messageId}>
                {topic === 'message' ? 'Message' : 'Details'}
              </label>
              <textarea
                ref={messageRef}
                id={messageId}
                rows={5}
                className={`atlas-contact__input atlas-contact__textarea${fieldError === 'message' ? ' is-invalid' : ''}`}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  if (fieldError === 'message') setFieldError(null)
                }}
                placeholder={copy.placeholder}
                required
                disabled={sending}
                aria-invalid={fieldError === 'message'}
                aria-describedby={error ? errorId : undefined}
              />
            </div>

            {/* Honeypot — hidden from people, irresistible to bots. */}
            <div className="atlas-contact__honeypot" aria-hidden>
              <label htmlFor={`${uid}-website`}>Website</label>
              <input
                id={`${uid}-website`}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {topic === 'bug' && (
              <p className="atlas-contact__meta">
                Attaches your browser, screen size, and page URL so we can reproduce it.
              </p>
            )}

            <div className="atlas-contact__status" role="status" aria-live="polite">
              {error && (
                <p id={errorId} className="atlas-contact__error">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="atlas-btn atlas-btn--primary atlas-contact__submit"
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
