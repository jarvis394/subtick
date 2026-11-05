import { Check, Link2, Share2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/button'
import { MorphLabel } from '@/components/ui/morph-label'
import { useCopied } from '@/lib/use-copied'
import { cn } from '@/lib/utils'

/**
 * Share (the system share sheet where there is one, otherwise a copy) and a copy-link icon button
 * that confirms with a check. `quiet` mutes the share label for spots where it's secondary.
 */
export const ShareActions = ({
  url,
  title,
  quiet,
  className,
}: {
  url: string
  title: string
  quiet?: boolean
  className?: string
}) => {
  const shareCopy = useCopied()
  const linkCopy = useCopied()
  const canShare = typeof navigator.share === 'function'

  const share = async () => {
    if (!canShare) return shareCopy.copy(url)
    try {
      await navigator.share({ title, url })
    } catch (error) {
      // Dismissing the sheet rejects with AbortError; anything else falls back to copying.
      if (!(error instanceof DOMException && error.name === 'AbortError')) shareCopy.copy(url)
    }
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
      <Button size="sm" variant={quiet ? 'quiet' : 'secondary'} onClick={() => void share()}>
        <Share2 />
        <MorphLabel>{shareCopy.copied ? 'Copied' : 'Share'}</MorphLabel>
      </Button>
      <IconButton
        variant={quiet ? 'quiet' : 'secondary'}
        // Icon sizes run a step smaller: md (36px) matches the sm Share button beside it.
        size="md"
        label={linkCopy.copied ? 'Link copied' : 'Copy link'}
        onClick={() => linkCopy.copy(url)}
      >
        <span className="grid place-items-center *:col-start-1 *:row-start-1">
          <Link2
            className={cn(
              'transition-[opacity,scale] duration-150 ease-out',
              linkCopy.copied && 'scale-75 opacity-0',
            )}
          />
          <Check
            className={cn(
              'text-success transition-[opacity,scale] duration-150 ease-out',
              !linkCopy.copied && 'scale-75 opacity-0',
            )}
          />
        </span>
      </IconButton>
    </div>
  )
}
