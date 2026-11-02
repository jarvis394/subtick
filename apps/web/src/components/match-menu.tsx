import { Menu } from '@base-ui/react/menu'
import type { MatchStatus } from '@subtick/domain'
import { useNavigate } from '@tanstack/react-router'
import {
  Check,
  CircleStop,
  Copy,
  Download,
  Ellipsis,
  Gamepad2,
  Link2,
  Plus,
  RotateCw,
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { isProcessing } from '@/components/match-status'
import { useCancelMatch, useRetryMatch } from '@/hooks/use-match-actions'
import { IconButton } from '@/components/ui/button'
import { MorphLabel } from '@/components/ui/morph-label'
import { cn } from '@/lib/utils'

export const menuPopupClass =
  'min-w-52 origin-(--transform-origin) rounded-xl border bg-surface p-1 shadow-xl shadow-black/20 outline-none transition-[scale,opacity] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0'

export const menuItemClass =
  'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-body whitespace-nowrap outline-none select-none data-disabled:cursor-default data-disabled:opacity-50 data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted'

/** Valve's replay-server link that makes CS2 download the demo and open it. */
const watchUrl = (shareCode: string) =>
  `steam://rungame/730/76561202255233023/+csgo_download_match%20${shareCode}`

export interface MenuMatch {
  id: string
  status: MatchStatus
  cancelled: boolean
  shareCode: string | null
  demoUrl: string | null
  demoExpiresAt: Date | string | null
}

/** How long a copy item shows "Copied" before the menu closes. */
const COPIED_MS = 900

/**
 * A copy action that confirms in place: its label turns into "Copied" with a check, then the menu
 * closes. Closing straight away would leave no sign the copy happened.
 */
const CopyItem = ({
  icon,
  label,
  text,
  onDone,
}: {
  icon: ReactNode
  label: string
  text: string
  onDone: () => void
}) => {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // oxlint-disable-next-line subtick/no-unreasoned-state-sync -- clears the pending "copied" timer on unmount
  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <Menu.Item
      className={menuItemClass}
      closeOnClick={false}
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        timer.current = setTimeout(onDone, COPIED_MS)
      }}
    >
      <span className="grid size-4 place-items-center *:col-start-1 *:row-start-1">
        <span
          className={cn(
            'grid place-items-center transition-[opacity,scale] duration-150 ease-out',
            copied && 'scale-75 opacity-0',
          )}
        >
          {icon}
        </span>
        <Check
          className={cn(
            'text-success! transition-[opacity,scale] duration-150 ease-out',
            !copied && 'scale-75 opacity-0',
          )}
        />
      </span>
      <MorphLabel align="start">{copied ? 'Copied' : label}</MorphLabel>
    </Menu.Item>
  )
}

/**
 * A match's actions, Leetify-style: share it, watch or download its demo, make clips, and stop or
 * restart its processing.
 */
export const MatchMenu = ({
  match,
  triggerClassName,
  onNavigate,
  side = 'bottom',
  align = 'end',
}: {
  match: MenuMatch
  triggerClassName?: string
  /** Called before the menu navigates (the mobile drawer closes on it). */
  onNavigate?: () => void
  side?: 'bottom' | 'top' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}) => {
  const [open, setOpen] = useState(false)
  // Read when the menu opens: render can't call Date.now().
  const [openedAt, setOpenedAt] = useState(0)
  const navigate = useNavigate()
  const cancel = useCancelMatch()
  const retry = useRetryMatch()
  const processing = isProcessing(match.status)
  const canRetry = match.status === 'failed' || match.status === 'expired'
  const demoAvailable =
    match.demoUrl !== null &&
    (match.demoExpiresAt === null || new Date(match.demoExpiresAt).getTime() > openedAt)

  const close = () => setOpen(false)

  return (
    <Menu.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setOpenedAt(Date.now())
        setOpen(next)
      }}
    >
      <Menu.Trigger
        render={
          <IconButton
            size="xs"
            label="Match actions"
            tooltip={false}
            className={cn('[--bg-hover:var(--color-surface-3)]', triggerClassName)}
          />
        }
      >
        <Ellipsis />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side={side} align={align} sideOffset={4} className="z-50">
          <Menu.Popup className={menuPopupClass}>
            <CopyItem
              icon={<Link2 />}
              label="Copy link"
              text={`${window.location.origin}/matches/${match.id}`}
              onDone={close}
            />
            {match.shareCode && (
              <CopyItem
                icon={<Copy />}
                label="Copy share code"
                text={match.shareCode}
                onDone={close}
              />
            )}
            {(match.shareCode || demoAvailable) && (
              <Menu.Separator className="mx-1 my-1 h-px bg-border" />
            )}
            {match.shareCode && (
              <Menu.Item className={menuItemClass} render={<a href={watchUrl(match.shareCode)} />}>
                <Gamepad2 /> Watch in CS2
              </Menu.Item>
            )}
            {demoAvailable && (
              <Menu.Item
                className={menuItemClass}
                render={<a href={match.demoUrl!} target="_blank" rel="noreferrer" />}
              >
                <Download /> Download demo
              </Menu.Item>
            )}
            {match.status === 'ready' && (
              <Menu.Item
                className={menuItemClass}
                onClick={() => {
                  onNavigate?.()
                  void navigate({ to: '/matches/$id/create', params: { id: match.id } })
                }}
              >
                <Plus /> Create highlights
              </Menu.Item>
            )}
            {(processing || canRetry) && (
              <>
                <Menu.Separator className="mx-1 my-1 h-px bg-border" />
                {processing ? (
                  <Menu.Item
                    className={cn(menuItemClass, 'text-danger [&_svg]:text-danger')}
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(match.id)}
                  >
                    <CircleStop /> Cancel processing
                  </Menu.Item>
                ) : (
                  <Menu.Item
                    className={menuItemClass}
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(match.id)}
                  >
                    <RotateCw /> {match.cancelled ? 'Resume processing' : 'Retry'}
                  </Menu.Item>
                )}
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
