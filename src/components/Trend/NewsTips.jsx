/**
 * Trend Detective — news tips.
 *
 * Searches recent GDELT coverage of Washington State to suggest which NASA
 * variable to test. GDELT only suggests where to look; the trend test never
 * uses news data.
 */
import { useEffect, useState } from 'react'
import { Newspaper } from 'lucide-react'
import { fetchDocArticles } from '../../services/gdelt/analyticsService'
import { POWER_VARIABLES } from '../../services/nasaPower/variables.js'
import { newsTipQuery, tipsFromHeadlines } from '../../services/nasaPower/newsTips.js'
import { TIP_PLACES } from '../../services/nasaPower/demos.js'
import { REGION_NAME } from '../../services/nasaPower/region.js'
import { cn } from '../../lib/utils'

const BTN =
  'inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3! py-1.5! text-sm transition-colors'
const BTN_IDLE = 'border-line bg-surface text-muted hover:text-text'
const BTN_ACTIVE = 'border-accent-border bg-accent-dim text-accent'
const CARD = 'flex flex-col gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3! py-3!'

const GDELT_NOTE = 'News tips: the GDELT Project. Tips only suggest where to look; every verdict uses NASA data alone.'
const REGION_QUERY = newsTipQuery('Washington state')

function TipHeader() {
  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
      <Newspaper className="h-4 w-4" aria-hidden="true" />
      Tip from the news
    </p>
  )
}

/** One shared search per session: both tip cards read the same Washington headlines. */
let regionSearch = null

function loadRegionHeadlines() {
  if (regionSearch) return regionSearch
  const attempt = () =>
    fetchDocArticles(REGION_QUERY, '7d', { maxrecords: 50, priority: 'interactive' }).then((articles) =>
      (articles || []).map((a) => a?.title).filter(Boolean),
    )
  // GDELT allows one request every 5 seconds and ATLAS polls it too: try once more after a pause.
  regionSearch = attempt()
    .catch(() => new Promise((resolve) => setTimeout(resolve, 15_000)).then(attempt))
    .catch(() => {
      regionSearch = null
      return []
    })
  return regionSearch
}

/** Weather-themed tips from recent Washington State headlines. */
function useRegionTips() {
  const [tips, setTips] = useState([])
  useEffect(() => {
    let alive = true
    loadRegionHeadlines().then((titles) => alive && setTips(tipsFromHeadlines(titles)))
    return () => {
      alive = false
    }
  }, [])
  return tips
}

/** Tips for the open case: which variable the Washington news points at. */
export function PlaceNewsTips({ variable, onPickVariable }) {
  const tips = useRegionTips()
  if (tips.length === 0) return null

  return (
    <div className="flex flex-col gap-2" aria-label="News tips">
      {tips.map((tip) => (
        <div key={tip.theme} className={CARD}>
          <TipHeader />
          <p className="text-sm leading-normal text-text">
            {tip.count} recent headlines about {REGION_NAME} mention {tip.label}. Does the long-term record agree? Try testing:
          </p>
          <div className="flex flex-wrap gap-2">
            {tip.variables.map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={variable === code}
                className={cn(BTN, variable === code ? BTN_ACTIVE : BTN_IDLE)}
                onClick={() => onPickVariable(code)}
              >
                {POWER_VARIABLES[code].label}
              </button>
            ))}
          </div>
          {tip.headline ? <p className="text-sm leading-normal text-muted">For example: “{tip.headline}”</p> : null}
        </div>
      ))}
      <p className="text-sm leading-normal text-muted">{GDELT_NOTE}</p>
    </div>
  )
}

/** Washington tips shown before a place is chosen; each opens at a typical place for that story. */
export function RegionNewsTips({ onOpen }) {
  const tips = useRegionTips().filter((t) => TIP_PLACES[t.theme]).slice(0, 3)
  if (tips.length === 0) return null

  return (
    <div className={CARD} aria-label="News tips">
      <TipHeader />
      {tips.map((tip) => {
        const code = tip.variables[0]
        const place = TIP_PLACES[tip.theme]
        return (
          <button
            key={tip.theme}
            type="button"
            className={cn(BTN, BTN_IDLE, 'h-auto w-full flex-col items-start gap-0 whitespace-normal py-2! text-left')}
            onClick={() => onOpen({ ...place, variable: code })}
          >
            <span className="text-base text-text">
              {tip.count} Washington headlines mention {tip.label}
            </span>
            <span className="text-sm text-muted">
              Test {POWER_VARIABLES[code].label.toLowerCase()} at {place.label.replace(/, Washington$/, '')}
            </span>
          </button>
        )
      })}
      <p className="text-sm leading-normal text-muted">{GDELT_NOTE}</p>
    </div>
  )
}
