import { Collapsible } from '@base-ui/react/collapsible'
import type { ReactNode } from 'react'

/**
 * Expands to its content's height when `open`, and collapses back before unmounting. Put spacing
 * inside `children` (padding), not on them as margin, so the height animates from zero.
 */
export const Reveal = ({ open, children }: { open: boolean; children: ReactNode }) => (
  <Collapsible.Root open={open}>
    <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-out-quart data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
      {children}
    </Collapsible.Panel>
  </Collapsible.Root>
)
