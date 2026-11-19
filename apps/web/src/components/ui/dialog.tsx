import { Dialog } from '@base-ui/react/dialog'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

/**
 * A centered modal that asks before an action goes ahead. Controlled, so a menu item or any
 * button can open it; `children` goes between the description and the buttons.
 */
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'neutral',
  pending,
  error,
  disabled,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  /** `danger` for what can't be undone. */
  tone?: 'neutral' | 'danger'
  pending?: boolean
  error?: string | null
  disabled?: boolean
  onConfirm: () => void
  children?: ReactNode
}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onConfirm()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="vt-modal fixed inset-0 z-50 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="vt-modal fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-surface p-6 shadow-2xl outline-none transition-[opacity,scale] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100">
          <Dialog.Title className="text-title font-medium">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-body text-muted">
            {description}
          </Dialog.Description>
          <form className="mt-5 grid gap-4" onSubmit={submit}>
            {children}
            {error && <p className="text-small text-danger select-text">{error}</p>}
            <div className="flex justify-end gap-2">
              <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
              <Button
                type="submit"
                variant="primary"
                tone={tone}
                disabled={disabled}
                loading={pending}
              >
                {confirmLabel}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
