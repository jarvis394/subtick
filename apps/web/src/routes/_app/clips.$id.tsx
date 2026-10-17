import { createFileRoute } from '@tanstack/react-router'
import { ClipViewer } from '@/components/clip-viewer'

/**
 * A clip opened from its URL. From a page that lists clips, the same URL is a mask over that page
 * with the viewer in a dialog; loading it directly (reload, a shared link) lands here instead.
 */
export const Route = createFileRoute('/_app/clips/$id')({
  component: ClipPage,
})

function ClipPage() {
  const { id } = Route.useParams()
  const navigate = Route.useNavigate()
  return (
    <ClipViewer
      id={id}
      source={{ kinds: [] }}
      onSelect={(next) => navigate({ params: { id: next }, replace: true })}
    />
  )
}
