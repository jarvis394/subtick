import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { ApiError } from '@/lib/api'
import { meQuery } from '@/lib/queries'

/** Search params shared by /login and /signup. */
export const authSearch = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
})

/** The signed-in user, fresh if stale; signed out → /login, back to `from` after. */
export const requireMe = (queryClient: QueryClient, from?: string) =>
  queryClient.ensureQueryData({ ...meQuery, revalidateIfStale: true }).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({ to: '/login', search: { redirect: from } })
    }
    throw error
  })

/** Signed-in visitors go straight to the app. */
export const redirectIfSignedIn = async ({
  context,
}: {
  context: { queryClient: QueryClient }
}) => {
  const me = await context.queryClient.fetchQuery(meQuery).catch(() => null)
  if (me) throw redirect({ to: '/' })
}
