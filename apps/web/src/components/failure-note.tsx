import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The recorder writes "What went wrong: its own message"; the message is technical. */
const splitReason = (error: string | null | undefined) => {
  if (!error) return { lead: "The recorder didn't say why", detail: undefined }
  const at = error.indexOf(': ')
  return at === -1
    ? { lead: error, detail: undefined }
    : { lead: error.slice(0, at), detail: error.slice(at + 2) }
}

/** The short part of a failed clip's reason, for a line that has no room for the rest. */
export const failureLead = (error: string | null | undefined) => splitReason(error).lead

/** Why a clip's recording failed: what happened in words, then the recorder's own message. */
export const FailureNote = ({
  error,
  className,
}: {
  error: string | null | undefined
  className?: string
}) => {
  const { lead, detail } = splitReason(error)
  return (
    <div className={cn('flex gap-3 bg-danger/5 px-5 py-3.5', className)}>
      <CircleAlert className="mt-px size-4 shrink-0 text-danger" />
      <div className="min-w-0 select-text">
        <p className="text-[13px] font-medium">Recording failed</p>
        <p className="mt-0.5 text-[13px] text-muted">{lead}.</p>
        {detail && (
          <p className="mt-2 line-clamp-4 font-mono text-[11px] leading-relaxed break-words text-muted/80">
            {detail}
          </p>
        )}
      </div>
    </div>
  )
}
