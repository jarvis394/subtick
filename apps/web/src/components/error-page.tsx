import { Link, useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

const COPY = {
  notFound: {
    title: 'Nothing here',
    description: 'This page doesn’t exist, or it was deleted.',
  },
  forbidden: {
    title: 'You can’t see this',
    description: 'It belongs to someone else, or your account doesn’t have access.',
  },
  failed: {
    title: 'Something went wrong',
    description: 'It’s on our side. Trying again usually works.',
  },
} as const

const kindOf = (error: unknown) =>
  error === undefined || (error instanceof ApiError && error.status === 404)
    ? 'notFound'
    : error instanceof ApiError && error.status === 403
      ? 'forbidden'
      : 'failed'

/**
 * What a route shows instead of its page when it can't: a missing page (or no `error` at all,
 * for a URL no route matches), no access, or a failure, with the way back and, for a failure, a
 * retry. The router's default for both, so no page falls back to a raw error.
 */
export const ErrorPage = ({
  error,
  reset,
  title: customTitle,
  description: customDescription,
  className,
  onBack,
}: {
  error?: unknown
  reset?: () => void
  /** Say what is missing in the page's own words, e.g. "Clip not found". */
  title?: string
  description?: string
  className?: string
  /** Called when "Back to highlights" is clicked, e.g. to close the dialog it sits in. */
  onBack?: () => void
}) => {
  const router = useRouter()
  const kind = kindOf(error)
  const title = customTitle ?? COPY[kind].title
  const description = customDescription ?? COPY[kind].description

  return (
    <div className={cn('grid min-h-[60dvh] place-items-center p-6 text-center', className)}>
      <div className="grid justify-items-center">
        <p className="font-serif text-2xl">{title}</p>
        <p className="mt-2 max-w-sm text-sm text-balance text-muted">{description}</p>
        {/* The message is for whoever is developing: users get the sentence above. */}
        {import.meta.env.DEV && error instanceof Error && kind === 'failed' && (
          <p className="mt-3 max-w-md font-mono text-[12px] break-words text-danger select-text">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex items-center gap-2">
          {kind === 'failed' && (
            <Button
              size="sm"
              onClick={() => {
                reset?.()
                void router.invalidate()
              }}
            >
              Try again
            </Button>
          )}
          <Button
            size="sm"
            variant={kind === 'failed' ? 'ghost' : 'secondary'}
            render={<Link to="/" onClick={onBack} />}
          >
            Back to highlights
          </Button>
        </div>
      </div>
    </div>
  )
}
