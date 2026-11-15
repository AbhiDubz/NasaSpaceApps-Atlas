/**
 * Ask Atlas conversation state. Lives outside the panel so closing and
 * reopening the panel keeps the conversation for the rest of the visit.
 */
import { create } from 'zustand'
import { readNdjson } from '../../services/chat/chatContext.js'

/** Turns sent back to the model; older ones are dropped. */
const HISTORY_TURNS = 16

let nextId = 1
let controller = null

/**
 * @typedef {{ id: number, role: 'user' | 'model', text: string, status: 'streaming' | 'done' | 'error', error?: string, activity?: string | null }} ChatMessage
 *   `activity` is what the server is looking up right now ("Reading snow depth at …").
 */

export const useChatStore = create((set, get) => ({
  /** @type {ChatMessage[]} */
  messages: [],
  sending: false,

  /** Ask a question. `context` is buildChatContext()'s snapshot of what is open. */
  send: async (question, context) => {
    const text = question.trim()
    if (!text || get().sending) return

    const history = get()
      .messages.filter((m) => m.status === 'done' && m.text)
      .slice(-HISTORY_TURNS)
      .map(({ role, text: t }) => ({ role, text: t }))
    const userMsg = { id: nextId++, role: 'user', text, status: 'done' }
    const reply = { id: nextId++, role: 'model', text: '', status: 'streaming' }
    set((s) => ({ messages: [...s.messages, userMsg, reply], sending: true }))

    const patchReply = (patch) =>
      set((s) => ({ messages: s.messages.map((m) => (m.id === reply.id ? { ...m, ...patch(m) } : m)) }))

    const mine = new AbortController()
    controller = mine
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', text }], context }),
        signal: mine.signal,
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `The chatbot is unavailable (${res.status}).`)
      }
      let failed = null
      await readNdjson(res.body, (event) => {
        if (typeof event.t === 'string') patchReply((m) => ({ text: m.text + event.t, activity: null }))
        else if (typeof event.status === 'string') patchReply(() => ({ activity: event.status }))
        else if (event.error) failed = event.error
      })
      patchReply((m) =>
        failed ? { status: 'error', error: failed } : { status: m.text ? 'done' : 'error', error: m.text ? undefined : 'No answer came back.' },
      )
    } catch (err) {
      if (err?.name === 'AbortError') {
        patchReply((m) => (m.text ? { status: 'done' } : { status: 'error', error: 'Stopped.' }))
      } else {
        patchReply(() => ({ status: 'error', error: err?.message || 'Could not reach the chatbot.' }))
      }
    } finally {
      // A reset may already have started a newer request; leave that one alone.
      if (controller === mine) {
        controller = null
        set({ sending: false })
      }
    }
  },

  /** Stop the reply that is streaming in, keeping what has arrived. */
  stop: () => controller?.abort(),

  reset: () => {
    controller?.abort()
    controller = null
    set({ messages: [], sending: false })
  },
}))
