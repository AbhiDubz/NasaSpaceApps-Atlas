/**
 * Ask Atlas — a Gemini chatbot that answers questions about the Trend
 * Detective case on screen.
 *
 * Each question is sent with a snapshot of the open case (place, variable,
 * season and the trend results already loaded), so answers quote the same
 * numbers the panel shows. The key and the model call stay on the server
 * (/api/chat).
 *
 * Note: index.css has an unlayered `* { margin: 0; padding: 0 }` reset that
 * outranks Tailwind's layered utilities, so spacing classes here carry `!`.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, RotateCcw, Sparkles, Square, X } from 'lucide-react'
import { useAtlasStore } from '../../store/atlasStore'
import { useTrend, useTrendScan } from '../../hooks/useNasaPower'
import { buildChatContext, suggestedQuestions } from '../../services/chat/chatContext.js'
import { plainMath } from '../../services/chat/plainMath.js'
import { POWER_VARIABLES } from '../../services/nasaPower/variables.js'
import { seasonById } from '../../services/nasaPower/trendStats.js'
import { demoPlaceLabel } from '../../services/nasaPower/demos.js'
import { cn } from '../../lib/utils'
import { useChatStore } from './chatStore'

const BTN =
  'inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3! py-1.5! text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'
const BTN_IDLE = 'border-line bg-surface text-muted hover:text-text'
const PANEL_BG = 'bg-[rgba(3,7,18,0.94)]'

/** `**bold**` inside a line. */
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-text">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

/** Paragraphs and "- " lists: all the formatting the model is asked to use. Stray LaTeX math becomes plain text. */
function RichText({ text }) {
  const blocks = []
  let list = null
  for (const raw of plainMath(text).split('\n')) {
    const line = raw.trimEnd()
    const item = line.match(/^\s*[-*•]\s+(.*)$/)
    if (item) {
      if (!list) {
        list = []
        blocks.push({ type: 'list', items: list })
      }
      list.push(item[1])
      continue
    }
    list = null
    if (!line.trim()) blocks.push({ type: 'gap' })
    else {
      const prev = blocks[blocks.length - 1]
      if (prev?.type === 'p') prev.lines.push(line)
      else blocks.push({ type: 'p', lines: [line] })
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) =>
        b.type === 'list' ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5!">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        ) : b.type === 'p' ? (
          <p key={i}>{inline(b.lines.join(' '))}</p>
        ) : null,
      )}
    </div>
  )
}

function Message({ message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm border border-accent-border bg-accent-dim px-3! py-2! text-sm leading-normal text-text">
          {message.text}
        </p>
      </div>
    )
  }
  const streaming = message.status === 'streaming'
  const busyLine = streaming && (message.activity || (!message.text ? 'Thinking…' : null))
  return (
    <div className="flex flex-col gap-1">
      {message.text ? (
        <div className="text-sm leading-normal text-slate-200">
          <RichText text={message.text} />
        </div>
      ) : null}
      {busyLine ? (
        <p className="flex items-center gap-2 text-sm text-muted" role="status">
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse text-accent" aria-hidden="true" />
          {busyLine}
        </p>
      ) : null}
      {message.status === 'error' ? (
        <p className="rounded-md border border-red-400/40 bg-red-500/10 px-3! py-2! text-sm leading-normal text-red-200" role="alert">
          {message.error}
        </p>
      ) : null}
    </div>
  )
}

/** One-line description of what the bot can see, used as the input's label. */
function contextLabel(trendCase) {
  if (!trendCase) return 'Ask about NASA data on the globe'
  const meta = POWER_VARIABLES[trendCase.variable] || POWER_VARIABLES.T2M
  const season = seasonById(trendCase.season)
  const where = trendCase.places?.length
    ? trendCase.places.map((p) => (p.label || demoPlaceLabel(p.lat, p.lng) || 'this spot').split(',')[0]).join(' vs ')
    : 'Washington'
  return `Ask about ${meta.label.toLowerCase()}${season ? ` in ${season.label.toLowerCase()}` : ''} · ${where}`
}

export function AskAtlasLauncher() {
  const open = useAtlasStore((s) => s.askAtlasOpen)
  const caseOpen = useAtlasStore((s) => Boolean(s.trendCase))
  const openAskAtlas = useAtlasStore((s) => s.openAskAtlas)
  // With the case file open, its own "Ask" button takes over.
  if (open || caseOpen) return null
  return (
    <button
      type="button"
      onClick={openAskAtlas}
      data-tour="ask-atlas"
      className={cn(BTN, PANEL_BG, 'border-line-strong px-5! py-2.5! text-base text-text shadow-xl hover:border-accent-border')}
    >
      <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" />
      Ask Atlas
    </button>
  )
}

export default function AskAtlasPanel() {
  const open = useAtlasStore((s) => s.askAtlasOpen)
  if (!open) return null
  return <Panel />
}

function Panel() {
  const close = useAtlasStore((s) => s.closeAskAtlas)
  const trendCase = useAtlasStore((s) => s.trendCase)
  const messages = useChatStore((s) => s.messages)
  const sending = useChatStore((s) => s.sending)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const reset = useChatStore((s) => s.reset)
  const [draft, setDraft] = useState('')
  const logRef = useRef(null)
  const inputRef = useRef(null)
  const stickToBottom = useRef(true)

  // The same requests the case file makes; they are memoized, so nothing is fetched twice.
  const places = trendCase?.places || []
  const variable = trendCase?.variable
  const season = trendCase?.season || 'all'
  const first = useTrend({ lat: places[0]?.lat, lng: places[0]?.lng, variable, season })
  const second = useTrend({ lat: places[1]?.lat, lng: places[1]?.lng, variable, season })
  const single = places.length === 1 ? places[0] : null
  const scan = useTrendScan({ lat: single?.lat, lng: single?.lng })

  const suggestions = useMemo(() => suggestedQuestions(trendCase, first.data), [trendCase, first.data])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Follow the reply as it streams in, unless the user has scrolled up to reread.
  useEffect(() => {
    const el = logRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages])

  const submit = (text) => {
    if (!text.trim() || sending) return
    stickToBottom.current = true
    // Snapshot of the case as it is right now, numbers included.
    send(text, buildChatContext({ trendCase, results: [first, second], scan: single ? scan : undefined }))
    setDraft('')
  }

  const caseOpen = Boolean(trendCase)

  return (
    <aside
      className={cn(
        'pointer-events-auto fixed right-3 bottom-14 z-50 flex h-[min(36rem,calc(100vh-7.5rem))] w-[min(25rem,calc(100vw-1.5rem))] flex-col rounded-xl border border-line-strong shadow-2xl backdrop-blur-md',
        PANEL_BG,
        // Sit beside the case file when there is room for both.
        caseOpen && 'lg:right-[calc(min(27.5rem,100vw-1.5rem)+1.5rem)]',
      )}
      aria-label="Ask Atlas chatbot"
    >
      <header className="flex items-center gap-2 border-b border-line px-4! py-2!">
        <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-normal text-text">Ask Atlas</h2>
          <p className="truncate text-sm text-muted">{caseOpen ? 'Sees the Trend Detective case you have open' : 'AI answers about NASA Earth data'}</p>
        </div>
        {messages.length ? (
          <button type="button" className={cn(BTN, BTN_IDLE)} onClick={reset} aria-label="Start a new conversation">
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : null}
        <button type="button" className={cn(BTN, BTN_IDLE)} onClick={close} aria-label="Close Ask Atlas">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-4! py-4!"
        onScroll={(e) => {
          const el = e.currentTarget
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-normal text-muted">
              {caseOpen
                ? 'Ask what the trend means, how sure it is, what else is changing here, or for any month or year in the record. Answers come from the NASA data.'
                : 'Ask for any measure at any place in Washington, 1981–2025: a month, a year, a trend, or what is changing there. Answers come from the NASA data.'}
            </p>
            <div className="flex flex-col gap-2" role="group" aria-label="Suggested questions">
              {suggestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={cn(BTN, BTN_IDLE, 'h-auto w-full justify-start whitespace-normal py-2! text-left text-text hover:border-accent-border')}
                  onClick={() => submit(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Message key={m.id} message={m} />)
        )}
      </div>

      <form
        className="flex flex-col gap-1 border-t border-line px-4! py-3!"
        onSubmit={(e) => {
          e.preventDefault()
          submit(draft)
        }}
      >
        <label htmlFor="ask-atlas-input" className="truncate text-sm text-muted">
          {contextLabel(trendCase)}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="ask-atlas-input"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={2000}
            placeholder="Type a question…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit(draft)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
            className="max-h-32 min-h-[44px] w-full resize-none rounded-md border border-line bg-surface px-3.5! py-2.5! text-sm leading-normal text-text placeholder:text-muted focus:border-accent-border focus:outline-none"
            style={{ fieldSizing: 'content' }}
          />
          {sending ? (
            <button type="button" className={cn(BTN, BTN_IDLE, 'text-text')} onClick={stop} aria-label="Stop the answer">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className={cn(BTN, 'border-accent-border bg-accent-dim text-accent hover:bg-accent/20')}
              aria-label="Send question"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
    </aside>
  )
}
