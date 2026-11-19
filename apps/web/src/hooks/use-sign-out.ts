import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { clearStoredMe } from '@/lib/stored-me'

/** Forgets everything cached for this user and goes to the sign-in page, once the session is gone. */
export const useLeave = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return async () => {
    clearStoredMe()
    queryClient.clear()
    await navigate({ to: '/login' })
  }
}
