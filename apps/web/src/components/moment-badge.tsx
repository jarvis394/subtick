import type { HighlightClutch, HighlightKind, KillTag } from '@subtick/domain'
import { Crown, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/surface'
import { DEFUSE_ICON, HEADSHOT_ICON } from '@/lib/killfeed'
import { cn } from '@/lib/utils'

/** A killfeed icon, tinted with the current text color. */
const Icon = ({ src, className }: { src: string; className?: string }) => (
  <span
    aria-hidden
    className={cn('size-3 bg-current', className)}
    style={{
      WebkitMask: `url("${src}") center / contain no-repeat`,
      mask: `url("${src}") center / contain no-repeat`,
    }}
  />
)

/**
 * What a moment is at a glance: a crown for an ace, "1vN" for a clutch, the defuse kit for a
 * defuse, one headshot icon per kill otherwise, plus sparkles when a knife was involved.
 */
export const MomentBadge = ({
  moment,
  className,
}: {
  moment: { kind: HighlightKind; kills: { tags: KillTag[] }[]; clutch: HighlightClutch | null }
  className?: string
}) => {
  const n = moment.kills.length
  const knife = moment.kills.some((k) => k.tags.includes('knife'))
  const label =
    moment.kind === 'ace'
      ? 'Ace'
      : moment.kind === 'clutch'
        ? `1v${moment.clutch?.opponents ?? '?'}`
        : n === 0
          ? 'Defuse'
          : `${n} kills`

  return (
    <Badge
      tone={moment.kind === 'ace' || knife ? 'accent' : 'neutral'}
      aria-label={knife ? `${label}, knife` : label}
      title={knife ? `${label} · knife` : label}
      className={cn('w-[4.5rem] justify-center gap-0.5', className)}
    >
      {moment.kind === 'ace' ? (
        <>
          <Crown className="size-3.5" /> Ace
        </>
      ) : moment.kind === 'clutch' ? (
        label
      ) : n === 0 ? (
        <Icon src={DEFUSE_ICON} className="size-4" />
      ) : (
        Array.from({ length: n }, (_, i) => (
          <Icon key={i} src={HEADSHOT_ICON} className="size-3.5" />
        ))
      )}
      {knife && <Sparkles className="ml-0.5 size-3" />}
    </Badge>
  )
}
