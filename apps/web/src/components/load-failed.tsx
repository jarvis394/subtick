import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** In place of a list whose first load failed, so it never reads as an empty one. */
export const LoadFailed = ({
  title,
  onRetry,
  retrying,
}: {
  title: string
  onRetry: () => void
  retrying: boolean
}) => (
  <div className="grid justify-items-center rounded-2xl border border-dashed px-6 py-16 text-center">
    <span className="mb-4 grid size-11 place-items-center rounded-xl border bg-surface text-danger [&_svg]:size-5">
      <CircleAlert />
    </span>
    <p className="font-serif text-heading">{title}</p>
    <p className="mt-1.5 max-w-sm text-body text-balance text-muted">
      It’s on our side. Trying again usually works.
    </p>
    <Button size="sm" className="mt-5" onClick={onRetry} loading={retrying}>
      Try again
    </Button>
  </div>
)
