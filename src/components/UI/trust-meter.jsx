/**
 * TrustMeter — only surfaces non-obvious trust signals.
 * Skips authoritative/single-source noise; shows multi-source corroboration,
 * approximate geo, and source disagreement.
 */
import { cn } from '../../lib/utils'
import { Tooltip } from './tooltip.jsx'

function corroborationCount(event) {
  return Math.max(
    event.corroborationCount || 0,
    (event.corroborationSources || []).length,
    (event.sourceReports || []).length,
    1,
  )
}

export function TrustMeter({ event, className }) {
  if (!event) return null

  const count = Math.min(corroborationCount(event), 5)
  const multi = count >= 2
  const approximate = Boolean(event.latApproximate)
  const disagreement = Boolean(event.toneDisagreement || event.disputed)

  if (!multi && !approximate && !disagreement) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2.5 font-data text-[10px] leading-normal', className)}>
      {disagreement && (
        <span className="uppercase tracking-[0.06em] text-p2">Sources disagree</span>
      )}

      {multi && (
        <Tooltip label={`${count} corroborating source${count === 1 ? '' : 's'}`}>
          <span className="inline-flex items-center gap-1.5 text-muted" aria-label={`${count} sources`}>
            <span className="inline-flex items-center gap-[3px]">
              {[1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'inline-block h-2.5 w-[3px] rounded-[1px]',
                    i <= count ? 'bg-accent' : 'bg-line',
                  )}
                />
              ))}
            </span>
            <span>{count} sources</span>
          </span>
        </Tooltip>
      )}

      {approximate && (
        <Tooltip label="Approximate location — centroid or placeholder, not the incident site">
          <span className="uppercase tracking-[0.06em] text-p2">≈ approx</span>
        </Tooltip>
      )}
    </div>
  )
}
