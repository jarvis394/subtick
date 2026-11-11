import type { ReactNode } from 'react'

/** Holds a title level with an xs button, so a card reads the same with or without one. */
export const CardHeader = ({
  title,
  icon,
  level: Heading = 'h2',
  action,
}: {
  title: string
  icon?: ReactNode
  level?: 'h2' | 'h3'
  action?: ReactNode
}) => (
  <div className="mb-3 flex h-7 items-center justify-between gap-3">
    <Heading className="flex items-center gap-2 text-lead font-medium">
      {icon}
      {title}
    </Heading>
    {action}
  </div>
)
