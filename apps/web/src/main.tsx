import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiError } from './lib/api'
import { isSessionError } from './lib/queries'
import { routeTree } from './routeTree.gen'
import './styles.css'

const queryClient = new QueryClient({
  // The app opens on the stored user before /me answers; if the session turns out to be dead,
  // sign out here (the router's beforeLoad only runs on navigation).
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.queryKey[0] !== 'me' || !isSessionError(error)) return
      queryClient.clear()
      if (router.state.location.pathname === '/login') return
      void router.navigate({ to: '/login', search: { redirect: router.state.location.href } })
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
