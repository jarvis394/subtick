import { Menu as BaseMenu } from '@base-ui/react/menu'
import { useRender } from '@base-ui/react/use-render'
import {
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  createContext,
  use,
  useState,
} from 'react'
import { Sheet } from '@/components/ui/sheet'
import { useHandheld } from '@/hooks/use-handheld'
import { cn } from '@/lib/utils'

const MenuContext = createContext({ sheet: false, close: () => {} })

const popupClass =
  'min-w-52 origin-(--transform-origin) rounded-xl border bg-surface p-1 shadow-xl shadow-black/20 outline-none transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100'

const itemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body whitespace-nowrap outline-none select-none data-disabled:cursor-default data-disabled:opacity-50 data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted'

const sheetItemClass =
  'flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-lead outline-none select-none transition-colors duration-150 ease-out focus-visible:bg-surface-2 pointer-fine:hover:bg-surface-2 pointer-coarse:active:bg-surface-2 pointer-coarse:active:duration-0 disabled:cursor-default disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:text-muted'

const toneClass = { default: '', danger: 'text-danger [&_svg]:text-danger' }

type Tone = keyof typeof toneClass

/**
 * A menu that floats beside its trigger on desktop and rises as a bottom sheet on phones and
 * tablets. `trigger` is the element to render as the trigger, children included.
 */
export const Menu = ({
  trigger,
  title,
  children,
  open: controlledOpen,
  onOpenChange,
  side = 'bottom',
  align = 'end',
  sideOffset = 4,
  className,
}: {
  trigger: ReactElement
  /** Names the sheet for assistive tech. */
  title: string
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'bottom' | 'top' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** Layout for the desktop popup, such as its width. */
  className?: string
}) => {
  const sheet = useHandheld()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen

  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  const context = { sheet, close: () => setOpen(false) }

  if (sheet) {
    return (
      <MenuContext value={context}>
        <Sheet title={title} open={open} onOpenChange={setOpen} trigger={trigger}>
          {children}
        </Sheet>
      </MenuContext>
    )
  }

  return (
    <MenuContext value={context}>
      <BaseMenu.Root open={open} onOpenChange={setOpen}>
        <BaseMenu.Trigger render={trigger} />
        <BaseMenu.Portal>
          <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50">
            <BaseMenu.Popup aria-label={title} className={cn(popupClass, className)}>
              {children}
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      </BaseMenu.Root>
    </MenuContext>
  )
}

interface ItemProps {
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLElement>) => void
  /** Keep the menu open after the click; the item then closes it itself. */
  closeOnClick?: boolean
  disabled?: boolean
  tone?: Tone
  /** Renders the item as another element, such as a link. */
  render?: ReactElement
}

const SheetItem = ({
  children,
  onClick,
  closeOnClick = true,
  disabled,
  tone = 'default',
  render,
}: ItemProps) => {
  const { close } = use(MenuContext)

  return useRender({
    render,
    defaultTagName: 'button',
    props: {
      type: render ? undefined : 'button',
      disabled: render ? undefined : disabled,
      'aria-disabled': render && disabled ? true : undefined,
      className: cn(sheetItemClass, toneClass[tone]),
      children,
      onClick: (event: MouseEvent<HTMLElement>) => {
        onClick?.(event)
        if (closeOnClick) close()
      },
    },
  })
}

export const MenuItem = (props: ItemProps) => {
  const { sheet } = use(MenuContext)
  const { children, onClick, closeOnClick, disabled, tone = 'default', render } = props

  if (sheet) return <SheetItem {...props} />

  return (
    <BaseMenu.Item
      className={cn(itemClass, toneClass[tone])}
      closeOnClick={closeOnClick}
      disabled={disabled}
      render={render}
      onClick={onClick}
    >
      {children}
    </BaseMenu.Item>
  )
}

export const MenuSeparator = () => {
  const { sheet } = use(MenuContext)

  if (sheet) return <div role="separator" className="mx-3 my-1 h-px bg-border" />

  return <BaseMenu.Separator className="mx-1 my-1 h-px bg-border" />
}

/** Muted text above the items, such as who the menu belongs to. */
export const MenuLabel = ({ children }: { children: ReactNode }) => {
  const { sheet } = use(MenuContext)

  return (
    <p
      className={cn(
        'truncate pt-1 pb-1.5 text-muted',
        sheet ? 'px-3 text-body' : 'px-2 text-small',
      )}
    >
      {children}
    </p>
  )
}

/** A row that isn't an item, such as an inline control, lined up with the items' text. */
export const MenuRow = ({ children }: { children: ReactNode }) => {
  const { sheet } = use(MenuContext)

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 pr-1',
        sheet ? 'h-11 pl-3 text-lead' : 'h-9 pl-2 text-body',
      )}
    >
      {children}
    </div>
  )
}
