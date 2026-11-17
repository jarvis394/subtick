import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The sign-in and waiting screens: a narrow centered column, with an optional footer pinned below. */
export const AuthFrame = ({
  children,
  footer,
  className,
}: {
  children: ReactNode
  footer?: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'flex min-h-dvh flex-col items-center pt-[calc(--spacing(12)+var(--safe-top))] pr-[max(--spacing(4),var(--safe-right))] pb-[calc(--spacing(8)+var(--safe-bottom))] pl-[max(--spacing(4),var(--safe-left))]',
      className,
    )}
  >
    <div className="grid w-full max-w-[25rem] flex-1 content-center justify-items-center gap-8">
      {children}
    </div>
    {footer}
  </div>
)
