import { ScrollArea } from '@base-ui/react/scroll-area'
import { ChevronDown, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { COLUMNS, type Column } from './columns'

const ratingTone = (rating: number) =>
  rating >= 1.3
    ? 'bg-success/20 text-success'
    : rating >= 1
      ? 'bg-surface-3 text-foreground'
      : rating >= 0.85
        ? 'bg-surface-3 text-muted'
        : 'bg-danger/20 text-danger'

/**
 * Cell layout. The <td> stays transparent and only provides the gap (transparent left padding);
 * an inner block carries the background and rounding. Groups per row: [avatar + name] [rank]
 * [rating] [all stats as one band]. Using padding instead of table border-spacing keeps pinned
 * columns at exact offsets with nothing between them for scrolled cells to show through.
 */
interface Shape {
  /** Gap before this cell: starts a new island. */
  gap?: boolean
  /** Corner rounding of the cell's block (Tailwind classes, may be responsive). */
  round?: string
  /** Extra classes on the <td>/<th> (pinning). */
  pin?: string
}

export const shell = ({ gap, pin }: Shape) => cn('p-0', gap && 'pl-0.75', pin)

export const block = ({ round = 'rounded-md' }: Shape, head: boolean, className?: string) =>
  cn('flex items-center', head ? 'h-9 bg-surface-2' : 'h-11 bg-background', round, className)

/**
 * Pinned while the table scrolls sideways: avatar and party symbol on phones, the name too from md up.
 * An opaque backing hides scrolled cells behind its rounded corners, and a page-colored shadow keeps the 3px
 * gap on its right, sitting exactly on the next cell's gap so nothing shifts when scrolling starts.
 */
// Written out in full (also below with md:): Tailwind only sees literal class names.
const PIN_GAP = 'shadow-[3px_0_0_var(--color-surface)]'

/**
 * Scrolled cells are cut by a straight line at the pinned island's edge. These caps paint concave
 * 6px corners (page color outside a quarter circle) just past the gap, so cut cells look rounded
 * too. Unscrolled, they sit exactly on the next island's own rounded corners.
 * Class names are written out in full because Tailwind only sees literal strings.
 */
const CORNER_CAPS = cn(
  "before:pointer-events-none before:absolute before:bottom-0 before:-right-2.25 before:size-1.5 before:content-['']",
  'before:bg-[radial-gradient(circle_at_100%_0,transparent_5.5px,var(--color-surface)_6px)]',
  "after:pointer-events-none after:absolute after:top-0 after:-right-2.25 after:size-1.5 after:content-['']",
  'after:bg-[radial-gradient(circle_at_100%_100%,transparent_5.5px,var(--color-surface)_6px)]',
)

const MD_CORNER_CAPS = cn(
  "md:before:pointer-events-none md:before:absolute md:before:bottom-0 md:before:-right-2.25 md:before:size-1.5 md:before:content-['']",
  'md:before:bg-[radial-gradient(circle_at_100%_0,transparent_5.5px,var(--color-surface)_6px)]',
  "md:after:pointer-events-none md:after:absolute md:after:top-0 md:after:-right-2.25 md:after:size-1.5 md:after:content-['']",
  'md:after:bg-[radial-gradient(circle_at_100%_100%,transparent_5.5px,var(--color-surface)_6px)]',
)

/**
 * Right end of the scroll area (md+; phones run edge to edge). A zero-width cell pinned to the
 * right edge whose corner caps round the row where scrolled cells are cut by a straight line. At
 * the true end of the table they sit exactly on the last cell's own rounded corners.
 */
const END_CAPS = cn(
  'max-md:before:hidden max-md:after:hidden',
  "before:pointer-events-none before:absolute before:top-0 before:right-0 before:size-1.5 before:content-['']",
  'before:bg-[radial-gradient(circle_at_0_100%,transparent_5.5px,var(--color-surface)_6px)]',
  "after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:size-1.5 after:content-['']",
  'after:bg-[radial-gradient(circle_at_0_0,transparent_5.5px,var(--color-surface)_6px)]',
)

export const EndCap = () => (
  <td aria-hidden className={cn('sticky right-(--e) z-10 w-0 p-0', END_CAPS)} />
)

export const EndCapHead = () => (
  <th aria-hidden className={cn('sticky right-(--e) z-10 w-0 p-0', END_CAPS)} />
)

export const IDENTITY: Shape = {
  // Phones: square on the screen edge, rounded on the right. md+: left end of the avatar+name island.
  round: 'rounded-r-md md:rounded-l-md md:rounded-r-none',
  pin: cn(
    'sticky left-(--e) z-10 bg-surface',
    PIN_GAP,
    CORNER_CAPS,
    'md:shadow-none md:before:hidden md:after:hidden',
  ),
}

export const NAME: Shape = {
  // Phones: its own island after the pinned avatar. md+: joined to the avatar, pinned with it.
  round: 'rounded-md md:rounded-l-none',
  pin: cn(
    'pl-0.75 md:sticky md:left-[calc(var(--e)+4.25rem)] md:z-10 md:bg-surface md:pl-0',
    'md:shadow-[3px_0_0_var(--color-surface)]',
    MD_CORNER_CAPS,
  ),
}

export const RANK: Shape = { gap: true }
export const RATING_SHAPE: Shape = { gap: true }

export const statShape = (index: number): Shape => ({
  gap: index === 0,
  round:
    index === 0
      ? 'rounded-l-md'
      : // The row's right end: square on phones, where the table runs edge to edge.
        index === COLUMNS.length - 1
        ? 'md:rounded-r-md'
        : 'rounded-none',
})

/**
 * Rating with a faint, uncolored fill behind it: full width for the match's best rating,
 * shrinking proportionally for everyone else.
 */
export const RatingCell = ({
  rating,
  best,
  mvp,
}: {
  rating: number
  best: number
  mvp: boolean
}) => (
  <td className={shell(RATING_SHAPE)}>
    <div className={block(RATING_SHAPE, false, 'relative overflow-hidden px-2.5')}>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-foreground/[0.05]"
        style={{ width: `${best > 0 ? Math.max(rating / best, 0) * 100 : 0}%` }}
      />
      <span className="relative flex items-center gap-1.5">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 font-mono text-small font-semibold',
            ratingTone(rating),
          )}
        >
          {rating.toFixed(2)}
        </span>
        {mvp && <Star className="size-3.5 fill-brand text-brand" aria-label="Match MVP" />}
      </span>
    </div>
  </td>
)

/**
 * Horizontal scroller whose Base UI scrollbar sits in padding below the table, so it never covers a row.
 * On md+ the table bleeds past the content width by `--bleed` (≤ 2rem, 16px clear of the edges); the scroller
 * reaches `--e` further so overscroll doesn't crop it, and pinned cells sit `--e` in. Negative margins, not
 * a width: a wider grid item would stretch its auto track and push the table off-center.
 */
export const ScrollTable = ({ children }: { children: ReactNode }) => (
  <ScrollArea.Root
    className={cn(
      '[--pad:1rem] md:[--pad:2rem]',
      '[--p:calc(min(100cqw,72rem)_-_2*var(--pad))]',
      '[--bleed:1rem] md:[--bleed:clamp(0px,calc((100cqw_-_var(--p)_-_32px)/2),2rem)]',
      '[--e:calc((100cqw_-_var(--p))/2_-_var(--bleed))]',
      '-mx-[calc((100cqw_-_var(--p))/2)]',
      'data-has-overflow-x:pb-2',
    )}
  >
    <ScrollArea.Viewport className="select-text">
      <ScrollArea.Content className="flex">
        <div aria-hidden className="sticky left-0 z-20 w-(--e) shrink-0 bg-surface" />
        {children}
        <div aria-hidden className="sticky right-0 z-20 w-(--e) shrink-0 bg-surface" />
      </ScrollArea.Content>
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar
      orientation="horizontal"
      className={cn(
        // Spans the table: the content width on phones, the table's own on md+. Margins, as Base UI
        // sets the insets inline.
        'absolute bottom-0 mx-[calc(var(--e)+1rem)] flex h-1.5 items-center rounded-full bg-foreground/[0.04] md:mx-(--e)',
        // Shown while the pointer is over the table or it's scrolling (touch has no hover).
        'opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100',
        'motion-reduce:transition-none',
      )}
    >
      <ScrollArea.Thumb className="h-full rounded-full bg-foreground/20 transition-colors hover:bg-foreground/30 active:bg-foreground/40" />
    </ScrollArea.Scrollbar>
  </ScrollArea.Root>
)

export const HeaderCell = ({
  column,
  shape,
  sortKey,
  onSort,
  className,
}: {
  column: Column
  shape: Shape
  sortKey: string
  onSort: (id: string) => void
  className?: string
}) => (
  <Tooltip
    content={column.title}
    trigger={
      <th className={shell(shape)}>
        <div className={block(shape, true, className)}>
          <button
            type="button"
            onClick={() => onSort(column.id)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-0.5 font-medium outline-none hover:text-foreground focus-visible:text-foreground',
              sortKey === column.id && 'text-foreground',
            )}
          >
            {column.label}
            {sortKey === column.id && <ChevronDown className="size-3" />}
          </button>
        </div>
      </th>
    }
  />
)
