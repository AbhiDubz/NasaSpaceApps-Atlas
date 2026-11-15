/**
 * Guided-tour persistence — decides whether to *offer* the in-app tour.
 *
 * Rules
 * - Signed-in users: the decision (completed / skipped) is saved on the account
 *   (Supabase `user_metadata.atlas_tour`), so it follows them across devices and
 *   re-logins. Once decided, they are never prompted automatically again.
 * - Anonymous users: the decision is saved on this device (localStorage).
 *   - Never decided → offer, unless they used ATLAS recently (they already know it).
 *   - Decided → don't offer again, unless they've been away a long time.
 * - Anyone can replay the tour from the header "More" menu.
 */
import { supabase } from '../services/supabase'

const STORAGE_KEY_TOUR = 'atlas_tour_v1'
const STORAGE_KEY_LAST_ACTIVE = 'atlas_last_active_at'

const DAY_MS = 24 * 60 * 60 * 1000
/** Undecided anonymous visitors active within this window aren't interrupted. */
export const RECENT_USE_WINDOW_MS = 14 * DAY_MS
/** Anonymous visitors who decided but have been away this long get offered again. */
export const ANON_REOFFER_AFTER_MS = 90 * DAY_MS
/** Throttle for last-active writes. */
const ACTIVE_WRITE_THROTTLE_MS = 60 * 1000

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full / disabled — tour may be offered again, acceptable */
  }
}

/** @returns {{ status: 'completed'|'skipped', at: string } | null} */
export function readLocalTourDecision() {
  const v = readJson(STORAGE_KEY_TOUR)
  return v && (v.status === 'completed' || v.status === 'skipped') ? v : null
}

/** @returns {{ status: 'completed'|'skipped', at: string } | null} */
export function readAccountTourDecision(user) {
  const v = user?.user_metadata?.atlas_tour
  return v && (v.status === 'completed' || v.status === 'skipped') ? v : null
}

export function readLastActiveAt() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY_LAST_ACTIVE))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

let lastActiveWrite = 0
export function markActive(now = Date.now()) {
  if (now - lastActiveWrite < ACTIVE_WRITE_THROTTLE_MS) return
  lastActiveWrite = now
  try {
    localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now))
  } catch {
    /* ignore */
  }
}

/**
 * Pure decision — exported for tests.
 * @param {{ user: object|null, local: object|null, lastActiveAt: number|null, now?: number }} p
 */
export function computeShouldOfferTour({ user, local, lastActiveAt, now = Date.now() }) {
  if (user) {
    // Account is the source of truth; a device-level decision or recent activity on
    // this device also suppresses the auto-prompt so returning users aren't interrupted.
    if (readAccountTourDecision(user) || local) return false
    if (lastActiveAt && now - lastActiveAt < RECENT_USE_WINDOW_MS) return false
    return true
  }
  if (local) {
    const decidedAt = Date.parse(local.at) || 0
    const lastSeen = Math.max(decidedAt, lastActiveAt || 0)
    return now - lastSeen > ANON_REOFFER_AFTER_MS
  }
  // Never decided on this device: don't interrupt someone who has been using ATLAS lately.
  if (lastActiveAt && now - lastActiveAt < RECENT_USE_WINDOW_MS) return false
  return true
}

/** Snapshot read — call once per session *before* `markActive` bumps the timestamp. */
export function shouldOfferTour(user, lastActiveAt = readLastActiveAt()) {
  return computeShouldOfferTour({ user, local: readLocalTourDecision(), lastActiveAt })
}

/**
 * Persist a decision locally and, when signed in, on the account.
 * @param {'completed'|'skipped'} status
 */
export async function saveTourDecision(status, user) {
  const decision = { status, at: new Date().toISOString() }
  writeJson(STORAGE_KEY_TOUR, decision)
  if (user && supabase) {
    try {
      await supabase.auth.updateUser({ data: { atlas_tour: decision } })
    } catch {
      /* offline — local copy still suppresses the prompt; synced on next sign-in */
    }
  }
  return decision
}

/**
 * Keep device and account in agreement after sign-in:
 * account → device (new device) and device → account (decided before signing up).
 */
export async function syncTourDecisionToAccount(user) {
  if (!user) return
  const account = readAccountTourDecision(user)
  const local = readLocalTourDecision()
  if (account && !local) {
    writeJson(STORAGE_KEY_TOUR, account)
  } else if (local && !account && supabase) {
    try {
      await supabase.auth.updateUser({ data: { atlas_tour: local } })
    } catch {
      /* ignore */
    }
  }
}
