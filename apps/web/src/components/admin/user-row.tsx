import { useSuspenseQuery } from '@tanstack/react-query'
import { Ellipsis, Film, ShieldCheck, ShieldOff, Swords, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button, IconButton } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/menu'
import { Badge } from '@/components/ui/surface'
import type { AdminUser } from '@/lib/admin'
import { plural, timeAgo } from '@/lib/format'
import { meQuery } from '@/lib/queries'
import {
  type ConfirmedAction,
  confirmation,
  describeActionError,
  useUserAction,
} from './user-actions'

/** One account: who it is, what it holds, and what an admin can do to it. */
export const UserRow = ({ user }: { user: AdminUser }) => {
  const { data: me } = useSuspenseQuery(meQuery)
  const [asking, setAsking] = useState(false)
  // Kept while the dialog closes, so its copy doesn't vanish mid-animation.
  const [shown, setShown] = useState<ConfirmedAction>('delete')
  const action = useUserAction(user, () => setAsking(false))
  const isMe = user.id === me.user.id
  const admin = user.role === 'admin'
  const busy = action.isPending
  const dialog = confirmation(shown, user)
  const approving = busy && action.variables === 'approve'
  const holdings = [
    plural(user.steamAccounts, 'Steam account'),
    plural(user.matches, 'match'),
    plural(user.clips, 'clip'),
  ].join(' · ')

  const ask = (next: ConfirmedAction) => {
    action.reset()
    setShown(next)
    setAsking(true)
  }

  return (
    <div className="flex items-center gap-3 p-4">
      <Avatar src={user.image} name={user.name} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{user.name}</span>
          {admin && <Badge tone="accent">Admin</Badge>}
          {user.email && !user.emailVerified && <Badge>Email unconfirmed</Badge>}
          {isMe && <span className="text-label font-normal text-muted">you</span>}
        </p>
        <p className="truncate text-small text-muted select-text">
          {user.email ?? 'Steam sign-in'} · {user.pending ? 'asked' : 'joined'}{' '}
          {timeAgo(user.createdAt)}
        </p>
        {!user.pending && <p className="truncate text-small text-muted tabular-nums">{holdings}</p>}
        {action.variables === 'approve' && action.error && (
          <p className="text-small text-danger select-text">{describeActionError(action.error)}</p>
        )}
      </div>

      {user.pending ? (
        <div className="flex shrink-0 gap-2">
          <Button
            size="sm"
            variant="ghost"
            tone="danger"
            disabled={busy}
            onClick={() => ask('decline')}
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => action.mutate('approve')}
            loading={approving}
            disabled={busy}
          >
            Approve
          </Button>
        </div>
      ) : (
        <Menu
          title={`Manage ${user.name}`}
          trigger={
            <IconButton
              size="sm"
              variant="ghost"
              label={`Manage ${user.name}`}
              tooltip={false}
              disabled={busy}
            >
              <Ellipsis />
            </IconButton>
          }
        >
          <MenuLabel>{user.name}</MenuLabel>
          {!isMe && (
            <>
              <MenuItem onClick={() => ask(admin ? 'demote' : 'promote')}>
                {admin ? <ShieldOff /> : <ShieldCheck />}
                {admin ? 'Remove admin' : 'Make admin'}
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem tone="danger" disabled={user.clips === 0} onClick={() => ask('clips')}>
            <Film /> Delete clips
          </MenuItem>
          <MenuItem tone="danger" disabled={user.matches === 0} onClick={() => ask('matches')}>
            <Swords /> Delete matches
          </MenuItem>
          {!isMe && (
            <MenuItem tone="danger" onClick={() => ask('delete')}>
              <Trash2 /> Delete account
            </MenuItem>
          )}
        </Menu>
      )}

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={dialog.title}
        description={dialog.description}
        confirmLabel={dialog.confirmLabel}
        tone={dialog.tone}
        pending={busy}
        error={describeActionError(action.error)}
        onConfirm={() => action.mutate(shown)}
      />
    </div>
  )
}
