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
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/menu'
import { MorphLabel } from '@/components/ui/morph-label'
import { cn } from '@/lib/utils'

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
    <MenuItem
      closeOnClick={false}
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setCopied(true)
        timer.current = setTimeout(onDone, COPIED_MS)
      }}
    >
      <span className="grid shrink-0 place-items-center *:col-start-1 *:row-start-1">
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
    </MenuItem>
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
  onOpenChange,
  side = 'bottom',
  align = 'end',
}: {
  match: MenuMatch
  triggerClassName?: string
  /** Called before the menu navigates (the mobile drawer closes on it). */
  onNavigate?: () => void
  onOpenChange?: (open: boolean) => void
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

  const changeOpen = (next: boolean) => {
    if (next) setOpenedAt(Date.now())
    setOpen(next)
    onOpenChange?.(next)
  }

  const close = () => changeOpen(false)

  return (
    <Menu
      title="Match actions"
      open={open}
      onOpenChange={changeOpen}
      side={side}
      align={align}
      trigger={
        <IconButton
          size="xs"
          label="Match actions"
          tooltip={false}
          raised
          className={triggerClassName}
        >
          <Ellipsis />
        </IconButton>
      }
    >
      <CopyItem
        icon={<Link2 />}
        label="Copy link"
        text={`${window.location.origin}/matches/${match.id}`}
        onDone={close}
      />
      {match.shareCode && (
        <CopyItem icon={<Copy />} label="Copy share code" text={match.shareCode} onDone={close} />
      )}
      {(match.shareCode || demoAvailable) && <MenuSeparator />}
      {match.shareCode && (
        <MenuItem render={<a href={watchUrl(match.shareCode)} />}>
          <Gamepad2 /> Watch in CS2
        </MenuItem>
      )}
      {demoAvailable && (
        <MenuItem render={<a href={match.demoUrl!} target="_blank" rel="noreferrer" />}>
          <Download /> Download demo
        </MenuItem>
      )}
      {match.status === 'ready' && (
        <MenuItem
          onClick={() => {
            onNavigate?.()
            void navigate({ to: '/matches/$id/create', params: { id: match.id } })
          }}
        >
          <Plus /> Create highlights
        </MenuItem>
      )}
      {(processing || canRetry) && (
        <>
          <MenuSeparator />
          {processing ? (
            <MenuItem
              tone="danger"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(match.id)}
            >
              <CircleStop /> Cancel processing
            </MenuItem>
          ) : (
            <MenuItem disabled={retry.isPending} onClick={() => retry.mutate(match.id)}>
              <RotateCw /> {match.cancelled ? 'Resume processing' : 'Retry'}
            </MenuItem>
          )}
        </>
      )}
    </Menu>
  )
}
