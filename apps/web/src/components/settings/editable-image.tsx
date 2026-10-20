import { Camera } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, IconButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type ImageKind, useImageUpload } from './use-image-upload'

/**
 * Hidden until the picture is hovered (or the button focused). Touch screens have no hover, so
 * there it always shows.
 */
const reveal = cn(
  'transition-[color,opacity] duration-150 ease-out motion-reduce:transition-none',
  'pointer-fine:opacity-0 pointer-fine:group-hover/edit:opacity-100 focus-visible:opacity-100',
)

/**
 * A picture its owner changes in place: a click anywhere on it picks a new file, and hovering
 * shows the button that says so (a camera icon on avatars, "Change banner" on banners). The
 * button has no handler of its own; its click bubbles to the picture's.
 */
export const EditableImage = ({
  kind,
  enabled = true,
  size = 'sm',
  className,
  children,
}: {
  kind: ImageKind
  enabled?: boolean
  /** Of the avatar's icon button; `xs` for small avatars. */
  size?: 'xs' | 'sm'
  className?: string
  children: ReactNode
}) => {
  const upload = useImageUpload(kind)
  if (!enabled) return <div className={className}>{children}</div>

  return (
    <div className={cn('group/edit relative cursor-pointer', className)} onClick={upload.pick}>
      {children}
      {kind === 'avatar' ? (
        <IconButton
          variant="secondary"
          size={size}
          label="Change avatar"
          className={cn(
            'absolute rounded-full shadow-md',
            // Inside the avatar's box, so it never pokes past it and skews the spacing around it.
            size === 'xs' ? 'right-0 bottom-0 size-5 [&_svg]:size-3' : 'right-0.5 bottom-0.5',
            reveal,
          )}
        >
          <Camera />
        </IconButton>
      ) : (
        <Button size="sm" className={cn('absolute top-3 right-3 shadow-md', reveal)}>
          <Camera /> Change banner
        </Button>
      )}
      {/* Kept out of the picture's click: the input's own programmatic click would bubble back and
        pick again, and React bubbles clicks inside the (portaled) dialog here too. */}
      <div onClick={(event) => event.stopPropagation()} className="contents">
        {upload.picker}
        {upload.dialog}
      </div>
    </div>
  )
}
