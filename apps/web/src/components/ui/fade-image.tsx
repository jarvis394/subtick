import { type ComponentProps, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * An image that stays transparent until it has fully loaded and decoded, then fades in, so the
 * placeholder behind it never gives way to a half-painted JPEG drawing in line by line.
 */
export const FadeImage = ({ className, onLoad, ...props }: ComponentProps<'img'>) => {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      // Already in the cache: `load` may have fired before React attached the handler.
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) setLoaded(true)
      }}
      decoding="async"
      // Thumbnails sit inside links and buttons; dragging one off is never what was meant.
      draggable={false}
      onLoad={(e) => {
        setLoaded(true)
        onLoad?.(e)
      }}
      className={cn(
        'transition-opacity duration-300 ease-out-quart motion-reduce:transition-none',
        loaded ? 'opacity-100' : 'opacity-0',
        className,
      )}
      {...props}
    />
  )
}
