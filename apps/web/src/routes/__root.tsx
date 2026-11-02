import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { ErrorPage } from '@/components/error-page'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({ meta: [{ title: 'subtick' }] }),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
  notFoundComponent: () => <ErrorPage />,
})
