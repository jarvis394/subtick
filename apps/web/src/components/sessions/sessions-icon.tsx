import type { ComponentProps } from 'react'

/** A stack of sittings, newest on top; drawn on lucide's grid and stroke so it sits among them. */
export const SessionsIcon = (props: ComponentProps<'svg'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <rect x="3" y="3" width="18" height="10" rx="2.5" />
    <path d="M5 17h14" />
    <path d="M7.5 21h9" />
  </svg>
)
