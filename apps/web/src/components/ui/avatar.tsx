import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import { cn } from '@/lib/utils'

export const Avatar = ({
  src,
  name,
  className,
}: {
  src?: string | null
  name: string
  className?: string
}) => (
  <BaseAvatar.Root
    className={cn(
      'inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 text-label font-medium text-muted select-none',
      className,
    )}
  >
    {src && (
      <BaseAvatar.Image
        src={src}
        alt=""
        className="size-full object-cover transition-opacity duration-300 ease-out-quart data-starting-style:opacity-0 motion-reduce:transition-none"
      />
    )}
    {/* With a picture coming, the initial waits a beat, so a quick load doesn't flash it first. */}
    <BaseAvatar.Fallback delay={src ? 600 : undefined}>
      {name.slice(0, 1).toUpperCase()}
    </BaseAvatar.Fallback>
  </BaseAvatar.Root>
)
