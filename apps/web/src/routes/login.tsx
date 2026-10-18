import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '@/components/auth-page'
import { authSearch, redirectIfSignedIn } from '@/lib/auth-route'

export const Route = createFileRoute('/login')({
  validateSearch: authSearch,
  beforeLoad: redirectIfSignedIn,
  component: () => <AuthPage mode="sign-in" />,
})
