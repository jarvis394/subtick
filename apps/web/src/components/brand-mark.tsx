import { useId } from 'react'
import { cn } from '@/lib/utils'

/** Black in both themes, like the favicon. `isolate` keeps the orange color blend inside the tile. */
export const BrandMark = ({ className }: { className?: string }) => {
  const id = useId()
  const top = `${id}-top`
  const bottom = `${id}-bottom`

  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-7 shrink-0 isolate overflow-hidden rounded-lg bg-black ring-1 ring-white/15 ring-inset',
        className,
      )}
    >
      <svg viewBox="0 0 100 100" fill="none" className="size-full">
        <path
          d="M54 66C54 59.3726 59.3726 54 66 54H94V46L66 46C54.9543 46 46 54.9543 46 66L46 94H54L54 66Z"
          fill={`url(#${bottom})`}
        />
        <path
          d="M46 66L46 93C46 95.2091 47.7909 97 50 97C52.2091 97 54 95.2091 54 93L54 66L46 66Z"
          fill="#FF5E00"
          className="mix-blend-color"
        />
        <path
          d="M46 34C46 40.6274 40.6274 46 34 46H6V54H34C45.0457 54 54 45.0457 54 34V6H46V34Z"
          fill={`url(#${top})`}
        />
        <path
          d="M46 34L46 7C46 4.79086 47.7909 3 50 3C52.2091 3 54 4.79086 54 7L54 34L46 34Z"
          fill="#FF5E00"
          className="mix-blend-color"
        />
        <defs>
          <linearGradient
            id={bottom}
            x1="69.2"
            y1="50"
            x2="69.2"
            y2="90"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="0.5" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <linearGradient
            id={top}
            x1="30.8"
            y1="50"
            x2="30.8"
            y2="10.5797"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset="0.5" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  )
}
