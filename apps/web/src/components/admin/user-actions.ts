import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AdminUser } from '@/lib/admin'
import { ApiError, api, unwrap } from '@/lib/api'
import { describeError } from '@/lib/notify'
import { plural } from '@/lib/format'

export type UserAction =
  | 'approve'
  | 'decline'
  | 'promote'
  | 'demote'
  | 'clips'
  | 'matches'
  | 'delete'

/** Actions that ask first; approving doesn't. */
export type ConfirmedAction = Exclude<UserAction, 'approve'>

export const confirmation = (action: ConfirmedAction, user: AdminUser) => {
  const name = user.name

  return (
    {
      decline: {
        title: `Decline ${name}?`,
        description: 'Their sign-up is deleted. They can ask again by signing up once more.',
        confirmLabel: 'Decline',
        tone: 'danger',
      },
      promote: {
        title: `Make ${name} an admin?`,
        description:
          'Admins manage recorders, storage and every user, including removing other admins.',
        confirmLabel: 'Make admin',
        tone: 'neutral',
      },
      demote: {
        title: `Remove ${name}’s admin role?`,
        description: 'They keep their account and highlights, but lose access to Manage instance.',
        confirmLabel: 'Remove admin',
        tone: 'neutral',
      },
      clips: {
        title: `Delete ${name}’s clips?`,
        description: `${plural(user.clips, 'recorded clip')} and their videos are deleted. The moments stay, so they can be recorded again.`,
        confirmLabel: 'Delete clips',
        tone: 'danger',
      },
      matches: {
        title: `Delete ${name}’s matches?`,
        description: `Matches only ${name} played are deleted for good, with their demos and clips. Matches other users also played stay for them and only leave ${name}’s history.`,
        confirmLabel: 'Delete matches',
        tone: 'danger',
      },
      delete: {
        title: `Delete ${name}’s account?`,
        description:
          'Their account, linked Steam accounts and profile pictures are removed for good. Matches and clips stay for the other players in them, so delete their matches first to remove those too.',
        confirmLabel: 'Delete account',
        tone: 'danger',
      },
    } as const
  )[action]
}

const ERRORS: Record<string, string> = {
  not_found: 'That user no longer exists. Reload the page',
  cannot_change_own_role: 'You can’t change your own role. Ask another admin',
  cannot_delete_self: 'Delete your own account from Settings',
}

export const describeActionError = (error: Error | null) =>
  error && ((error instanceof ApiError && ERRORS[error.message]) || describeError(error))

const sentence = (parts: (string | false)[]) => parts.filter(Boolean).join(' · ') || undefined

/** Runs the action and says what it did, for the toast. */
const run = async (user: AdminUser, action: UserAction) => {
  const target = api.admin.users({ id: user.id })

  switch (action) {
    case 'approve':
      await unwrap(target.approve.post())
      return { title: `${user.name} can use subtick now` }
    case 'promote':
      await unwrap(target.patch({ role: 'admin' }))
      return { title: `${user.name} is an admin` }
    case 'demote':
      await unwrap(target.patch({ role: 'user' }))
      return { title: `${user.name} is no longer an admin` }
    case 'decline':
      await unwrap(target.delete())
      return { title: `Declined ${user.name}` }
    case 'delete':
      await unwrap(target.delete())
      return { title: `Deleted ${user.name}’s account` }
    case 'clips': {
      const { deleted, skipped } = await unwrap(target.clips.delete())

      return {
        title: deleted ? `Deleted ${plural(deleted, 'clip')}` : 'No clips deleted',
        description: skipped ? `${skipped} recording now, skipped` : undefined,
      }
    }
    case 'matches': {
      const { deleted, unlinked, skipped } = await unwrap(target.matches.delete())

      return {
        title: deleted ? `Deleted ${plural(deleted, 'match')}` : 'No matches deleted',
        description: sentence([
          unlinked > 0 && `${plural(unlinked, 'shared match')} left ${user.name}’s history`,
          skipped > 0 && `${skipped} still processing, skipped`,
        ]),
      }
    }
  }
}

/** Account changes only touch the user list; removed data shows up on most pages. */
const ACCOUNT_ONLY = new Set<UserAction>(['approve', 'decline', 'promote', 'demote'])

/** Runs one action on a user, toasts what it did, then refreshes the pages it could have changed. */
export const useUserAction = (user: AdminUser, onDone: () => void) => {
  const queryClient = useQueryClient()

  return useMutation({
    meta: { inlineError: true },
    mutationFn: (action: UserAction) => run(user, action),
    onSuccess: async ({ title, description }, action) => {
      toast.success(title, { description })
      onDone()
      await queryClient.invalidateQueries(
        ACCOUNT_ONLY.has(action) ? { queryKey: ['admin', 'users'] } : undefined,
      )
    },
  })
}
