import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// `rounded-control` is our own radius token; without this, `rounded-control rounded-lg` keeps both.
const twMerge = extendTailwindMerge({ extend: { theme: { radius: ['control'] } } })

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
