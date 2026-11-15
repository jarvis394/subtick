import { Link } from '@tanstack/react-router'
import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FleetHealth {
  registered: number
  healthy: number
  failing: number
}

const reason = ({ registered, failing }: FleetHealth) =>
  failing === registered
    ? `${registered === 1 ? 'The recorder keeps' : 'Every recorder keeps'} failing clips.`
    : failing
      ? 'Some keep failing clips; the others are paused or offline.'
      : `${registered === 1 ? 'The recorder is' : 'Every recorder is'} paused or offline.`

/** Nothing can record: every registered recorder is failing, paused or offline. */
export const RecorderHealthBanner = ({
  fleet,
  manageLink,
  className,
}: {
  fleet: FleetHealth | undefined
  /** Admins get a way to the Recorders page. */
  manageLink?: boolean
  className?: string
}) => {
  if (!fleet || fleet.registered === 0 || fleet.healthy > 0) return null

  return (
    <div role="status" className={cn('flex gap-3 rounded-xl bg-danger/5 px-4 py-3', className)}>
      <CircleAlert className="mt-px size-4 shrink-0 text-danger" />
      <div className="min-w-0">
        <p className="text-small font-medium">No healthy recorders at the moment</p>
        <p className="mt-0.5 text-small text-muted">
          {reason(fleet)} Clips wait in the queue until one is back.
          {manageLink && (
            <>
              {' '}
              <Link to="/admin/recorders" className="link text-link">
                Check recorders
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
