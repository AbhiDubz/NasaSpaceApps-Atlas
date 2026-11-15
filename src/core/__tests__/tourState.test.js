import { describe, it, expect } from 'vitest'
import {
  ANON_REOFFER_AFTER_MS,
  RECENT_USE_WINDOW_MS,
  computeShouldOfferTour,
} from '../tourState'

describe('computeShouldOfferTour', () => {
  const now = 1_700_000_000_000

  it('offers the tour to a brand-new anonymous visitor', () => {
    expect(computeShouldOfferTour({ user: null, local: null, lastActiveAt: null, now })).toBe(true)
  })

  it('does not offer the tour to an undecided anonymous visitor who used the app recently', () => {
    const recent = now - Math.floor(RECENT_USE_WINDOW_MS / 2)
    expect(computeShouldOfferTour({ user: null, local: null, lastActiveAt: recent, now })).toBe(false)
  })

  it('does not re-offer the tour to an anonymous visitor who already skipped or completed it', () => {
    const local = { status: 'skipped', at: new Date(now - 1000).toISOString() }
    expect(computeShouldOfferTour({ user: null, local, lastActiveAt: now - 1000, now })).toBe(false)
  })

  it('re-offers to an anonymous visitor only after extended inactivity', () => {
    const oldAt = now - ANON_REOFFER_AFTER_MS - 10_000
    const local = { status: 'completed', at: new Date(oldAt).toISOString() }
    expect(computeShouldOfferTour({ user: null, local, lastActiveAt: oldAt, now })).toBe(true)
  })

  it('never re-offers to a signed-in user whose account already recorded a decision', () => {
    const oldAt = now - ANON_REOFFER_AFTER_MS * 4
    const user = {
      id: 'u1',
      user_metadata: { atlas_tour: { status: 'skipped', at: new Date(oldAt).toISOString() } },
    }
    expect(computeShouldOfferTour({ user, local: null, lastActiveAt: null, now })).toBe(false)
  })

  it('does not offer to a signed-in user when the current device already recorded a decision', () => {
    const user = { id: 'u1', user_metadata: {} }
    const local = { status: 'completed', at: new Date(now - 5000).toISOString() }
    expect(computeShouldOfferTour({ user, local, lastActiveAt: null, now })).toBe(false)
  })

  it('offers to a brand-new signed-in user with no prior decision or recent activity', () => {
    const user = { id: 'u1', user_metadata: {} }
    expect(computeShouldOfferTour({ user, local: null, lastActiveAt: null, now })).toBe(true)
  })
})
