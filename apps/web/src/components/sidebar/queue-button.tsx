import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { QueueRing, remainingWork, useQueueSummary } from '@/components/queue-ring'
import { IconButton } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { queueQuery } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { usePendingPath } from './rows'

/** Opens the Queue page; the badge counts matches with pipeline work across the instance. */
export const QueueButton = ({
  onNavigate,
  viewTransition,
  className,
}: {
  onNavigate?: () => void
  viewTransition?: boolean
  className?: string
}) => {
  const { data } = useQuery(queueQuery)
  const items = data?.items ?? []
  const pending = usePendingPath() === '/queue'
  const left = remainingWork(items)
  const label = left ? `Queue, ${left} left to process` : 'Queue'
  const summary = useQueueSummary(items)
  const empty = items.length === 0

  return (
    <Tooltip
      side="top"
      content={
        summary.running.length || summary.waiting ? (
          <div className="grid gap-1.5">
            {summary.running.map((task) => (
              <div key={task.id} className="min-w-0">
                <p className="font-medium">{task.map}</p>
                {task.title && <p className="truncate">{task.title}</p>}
                <p className="text-muted tabular-nums">{task.detail}</p>
              </div>
            ))}
            {summary.waiting > 0 && (
              <p className="text-muted">
                {summary.waiting} {summary.running.length ? 'more ' : ''}waiting
              </p>
            )}
          </div>
        ) : (
          <span className="text-muted">Queue is empty</span>
        )
      }
      trigger={
        // The tooltip is the queue's summary, so the button's own label tooltip is off.
        <IconButton
          size="lg"
          label={label}
          tooltip={false}
          render={<Link to="/queue" onClick={onNavigate} viewTransition={viewTransition} />}
          className={cn(
            pending && 'shimmer',
            className,
            // Fades out with the last job; `invisible` lands after the fade and takes it out of
            // the tab order.
            'transition-[color,translate,opacity,scale,visibility]',
            empty && 'invisible scale-90 opacity-0 motion-reduce:scale-100',
          )}
        >
          <QueueRing items={items} />
        </IconButton>
      }
    />
  )
}
