import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { meQuery } from '@/lib/queries'
import { isSetUp } from '@/lib/setup'

/**
 * A dashed placeholder for a page with nothing to show. Until setup is done, nothing can show up,
 * so it says so and links there instead of the usual description.
 */
export const EmptyState = ({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) => {
  const { data: me } = useSuspenseQuery(meQuery)
  const setUp = isSetUp(me)

  return (
    <div className="grid justify-items-center rounded-2xl border border-dashed px-6 py-16 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-xl border bg-surface text-muted [&_svg]:size-5">
        {icon}
      </span>
      <p className="font-serif text-xl">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-balance text-muted">
        {setUp ? description : 'Finish setup to start picking up your matches.'}
      </p>
      {!setUp && (
        <Button size="sm" className="mt-5" render={<Link to="/setup" />}>
          Finish setup
        </Button>
      )}
    </div>
  )
}
