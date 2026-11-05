import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Toaster as Sonner } from 'sonner'
import { Spinner } from '@/components/ui/surface'

const ICON = 'size-4'

/** Sonner positions and stacks the toasts; their look is the kit's floating surface. */
export const Toaster = () => (
  <Sonner
    position="bottom-right"
    icons={{
      error: <CircleAlert className={`${ICON} text-danger`} />,
      success: <CircleCheck className={`${ICON} text-success`} />,
      warning: <TriangleAlert className={`${ICON} text-danger`} />,
      info: <Info className={`${ICON} text-muted`} />,
      loading: <Spinner className="text-muted" />,
    }}
    toastOptions={{
      unstyled: true,
      classNames: {
        // Sonner's own phone rule sets the width under 600px and wins over w-(--width).
        toast:
          'flex w-(--width) items-start gap-3 rounded-xl border bg-surface py-3.5 pr-4 pl-3.5 text-foreground shadow-xl shadow-black/20',
        // On the title's first line rather than centred on the whole block.
        icon: 'mt-0.5 flex shrink-0',
        content: 'flex min-w-0 flex-1 flex-col gap-0.5',
        title: 'text-body font-medium',
        description: 'text-small text-pretty text-muted',
      },
    }}
  />
)
