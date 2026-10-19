import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="font-serif text-2xl">Nothing here</p>
        <a href="/" className="link mt-2 inline-block text-sm text-link">
          Back to highlights
        </a>
      </div>
    </div>
  ),
})
