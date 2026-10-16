import { Field as BaseField } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass = cn(
  'h-10 w-full rounded-[10px] border border-border-strong bg-surface px-3 text-[15px] text-foreground select-text',
  'placeholder:text-muted/70 outline-none transition-[border-color,box-shadow] duration-150',
  'focus:border-accent focus:ring-3 focus:ring-ring/40 data-invalid:border-danger',
)

export const Input = ({ className, ...props }: ComponentProps<typeof BaseInput>) => (
  <BaseInput className={cn(inputClass, typeof className === 'string' && className)} {...props} />
)

export const Field = ({
  label,
  description,
  error,
  children,
  className,
  ...props
}: ComponentProps<typeof BaseField.Root> & {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
}) => (
  <BaseField.Root
    className={cn('grid content-start gap-1.5', typeof className === 'string' && className)}
    invalid={Boolean(error)}
    {...props}
  >
    <BaseField.Label className="text-[13px] font-medium text-foreground">{label}</BaseField.Label>
    {children}
    {description && !error && (
      <BaseField.Description className="text-[13px] text-muted">
        {description}
      </BaseField.Description>
    )}
    {error && <p className="text-[13px] text-danger">{error}</p>}
  </BaseField.Root>
)

export const FieldControl = BaseField.Control
