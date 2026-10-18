import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { meQuery } from '@/lib/queries'

/** Search params shared by /login and /signup. */
export const authSearch = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
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
