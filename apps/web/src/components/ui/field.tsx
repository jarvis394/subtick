import { Field as BaseField } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import { Eye, EyeOff } from 'lucide-react'
import { type ComponentProps, type ReactNode, useState } from 'react'
import { IconButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const inputClass = cn(
  'h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-[15px] text-foreground select-text',
  'placeholder:text-muted/70 outline-none transition-[border-color,box-shadow] duration-150',
  'focus:border-accent focus:ring-3 focus:ring-ring/40 data-invalid:border-danger',
  // Invalid stays red while focused, ring included.
  'data-invalid:focus:border-danger data-invalid:focus:ring-danger/30',
)

export const Input = ({ className, ...props }: ComponentProps<typeof BaseInput>) => (
  <BaseInput className={cn(inputClass, typeof className === 'string' && className)} {...props} />
)

/** A password field with an eye button that shows or hides what was typed. */
export const PasswordInput = ({ className, ...props }: ComponentProps<typeof Input>) => {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', typeof className === 'string' && className)}
      />
      <IconButton
        label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
        className="absolute top-1/2 right-1 -translate-y-1/2"
      >
        {visible ? <EyeOff /> : <Eye />}
      </IconButton>
    </div>
  )
}

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
    {error && <p className="text-[13px] text-danger select-text">{error}</p>}
  </BaseField.Root>
)

export const FieldControl = BaseField.Control
