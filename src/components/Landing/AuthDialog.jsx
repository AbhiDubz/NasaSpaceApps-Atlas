import { useEffect, useId, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import AuthStep from '../Onboarding/AuthStep'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Login / sign-up modal for the landing nav. Mirrors ContactDialog's focus
 * contract: trapped Tab cycle, Escape to close, focus restored on unmount.
 * @param {{ mode: 'signin' | 'register', onClose: () => void, onSuccess: () => void }} props
 */
export default function AuthDialog({ mode, onClose, onSuccess }) {
  const reduceMotion = useReducedMotion()
  const panelRef = useRef(null)
  const restoreFocusTo = useRef(null)

  const titleId = `${useId()}-auth-title`
  const isRegister = mode === 'register'

  useEffect(() => {
    restoreFocusTo.current = document.activeElement
    panelRef.current?.querySelector(FOCUSABLE)?.focus()

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

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12, scale: 0.985 },
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
        className="atlas-contact atlas-auth-dialog"
        {...panelMotion}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="atlas-contact__head">
          <h2 id={titleId} className="atlas-contact__title">
            {isRegister ? 'Sign up' : 'Login'}
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

        <div className="atlas-auth-dialog__body auth-panel">
          <AuthStep key={mode} initialMode={mode} onSuccess={onSuccess} />
        </div>
      </motion.div>
    </motion.div>
  )
}
