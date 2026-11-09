import type { ReactNode } from 'react'

/** Holds a title level with an xs button, so a card reads the same with or without one. */
export const CardHeader = ({
  title,
  level: Heading = 'h2',
  action,
}: {
  title: string
  level?: 'h2' | 'h3'
  action?: ReactNode
}) => (
  <div className="mb-3 flex h-7 items-center justify-between gap-3">
    <Heading className="text-lead font-medium">{title}</Heading>
    {action}
  </div>
)
