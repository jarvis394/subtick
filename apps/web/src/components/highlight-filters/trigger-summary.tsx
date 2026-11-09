import { Component, User, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/surface'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { observeResize } from '@/lib/resizeObserve'

/** One mark before the trigger's label: a picked player, a group, the rest as "+n", or a bare icon. */
export type SummaryToken = { key: string } & (
  | { avatar: { src: string | null; name: string } }
  | { group: true }
  | { more: number }
  | { icon: 'user' | 'users' | 'group' }
)

// Expo ease-out throughout: each change starts at once and lands softly.
const morph = { duration: 0.35, ease: EASE_OUT_EXPO }
const enter = { duration: 0.3, ease: EASE_OUT_EXPO }
/** Leaving is quicker than arriving, so the old and new overlap only briefly. */
const leave = { duration: 0.15, ease: EASE_OUT_EXPO }

// A light blur blends the overlap of a crossfade into one change instead of two things swapping.
// New marks fly in from the right; leaving ones shrink away where they are; flying right would
// carry them into the label as it slides left.
const markMotion = {
  in: { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', transition: enter },
  from: (swap: boolean) => ({
    opacity: 0,
    x: swap ? 0 : 8,
    scale: swap ? 1 : 0.9,
    filter: 'blur(2px)',
  }),
  out: (swap: boolean) => ({
    opacity: 0,
    scale: swap ? 1 : 0.9,
    filter: 'blur(2px)',
    transition: leave,
  }),
}

const labelMotion = {
  in: { opacity: 1, filter: 'blur(0px)', transition: enter },
  out: { opacity: 0, filter: 'blur(2px)', transition: leave },
}

/**
 * What the player picker's trigger says it has picked. As the stack grows, marks fly in from the
 * right; as it shrinks, they shrink away; when its size holds, marks and the label only crossfade.
 */
export const TriggerSummary = ({
  tokens,
  label,
  me,
}: {
  tokens: SummaryToken[]
  label: string
  /** The pick is the viewer alone: the label gets the Me badge. */
  me: boolean
}) => {
  const content = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number | 'auto'>('auto')
  // A change that keeps the stack's size swaps marks rather than adding or removing one, so
  // nothing flies.
  const keys = tokens.map((token) => token.key)
  const [marks, setMarks] = useState({ keys, swap: true })
  if (marks.keys.join() !== keys.join()) setMarks({ keys, swap: keys.length === marks.keys.length })

  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- observes the content's width so the trigger eases to it
  useLayoutEffect(() => {
    const el = content.current
    if (!el) return

    return observeResize(el, ([entry]) => setWidth(entry!.borderBoxSize[0]!.inlineSize))
  }, [])

  return (
    // Eases to the content's width, so the trigger grows and shrinks instead of jumping. Unclipped:
    // while it catches up, new content runs past the edge under its fade rather than being cut off.
    // Pulled left so the first avatar's disc lines up with the padding.
    <motion.span
      className="mr-auto -ml-1.5 flex min-w-0"
      initial={false}
      animate={{ width }}
      transition={morph}
    >
      {/* The trigger's max-w-60 less its border, padding, gap and chevron, plus the pull. */}
      <span ref={content} className="flex w-max max-w-49 items-center gap-2 text-left">
        {/* Each mark overlaps the next by its own margin, padded back after the last. Not space-x: that
          keys off the last child, which is still a leaving mark mid-exit, so the stack jumps. */}
        <span className="flex shrink-0 items-center pr-1.5">
          {/* `custom` reaches marks already leaving, so they exit the way this change goes. */}
          <AnimatePresence initial={false} mode="popLayout" custom={marks.swap}>
            {tokens.map((token) => (
              <motion.span
                key={token.key}
                layout="position"
                custom={marks.swap}
                variants={markMotion}
                initial="from"
                animate="in"
                exit="out"
                transition={{ layout: morph }}
                className="-mr-1.5 flex shrink-0"
              >
                <Mark token={token} />
              </motion.span>
            ))}
          </AnimatePresence>
        </span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={`${label}:${me}`}
            layout="position"
            variants={labelMotion}
            initial="out"
            animate="in"
            exit="out"
            transition={{ layout: morph }}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="truncate">{label}</span>
            {me && (
              <Badge tone="accent" className="shrink-0">
                Me
              </Badge>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.span>
  )
}

const Mark = ({ token }: { token: SummaryToken }) => {
  if ('icon' in token) {
    const Icon = { user: User, users: Users, group: Component }[token.icon]

    // Undoes the summary's pull to the left: a bare glyph lines up with the padding.
    return <Icon className="ml-1.5 size-4 text-muted" />
  }

  return (
    // A disc in the trigger's own fill behind each mark, so overlapping ones read apart. A ring
    // would leave an anti-aliased seam between it and the image.
    <span className="flex rounded-full bg-surface p-0.5 transition-colors duration-150 ease-out pointer-fine:group-hover/trigger:bg-surface-2 pointer-coarse:group-active/trigger:bg-surface-2 pointer-coarse:group-active/trigger:duration-0 group-data-popup-open/trigger:bg-surface-2">
      {'avatar' in token ? (
        <Avatar src={token.avatar.src} name={token.avatar.name} className="size-5 text-micro" />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-surface-3 text-micro font-medium text-muted tabular-nums">
          {'more' in token ? `+${token.more}` : <Component className="size-3" />}
        </span>
      )}
    </span>
  )
}
