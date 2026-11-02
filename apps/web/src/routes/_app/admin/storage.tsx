import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { StorageCard } from '@/components/admin/storage-card'
import { RecordedHighlights, StoredMatches } from '@/components/admin/stored-items'
import { Card, Skeleton } from '@/components/ui/surface'
import { storageQuery, storedHighlightsQuery, storedMatchesQuery } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/storage')({
  head: () => ({ meta: [{ title: 'Storage · Admin · subtick' }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.prefetchQuery(storageQuery),
      context.queryClient.prefetchQuery(storedHighlightsQuery),
      context.queryClient.prefetchQuery(storedMatchesQuery),
    ]),
  component: StoragePage,
})

function StoragePage() {
  const storage = useQuery(storageQuery)

  return (
    <section className="flex flex-col gap-4">
      <p className="text-body text-muted">
        What subtick keeps on the disk and how much room is left.
      </p>
      {storage.isPending ? (
        <Skeleton className="h-72" />
      ) : storage.error ? (
        <Card className="p-6">
          <p className="text-body text-danger select-text">{storage.error.message}</p>
        </Card>
      ) : (
        <StorageCard report={storage.data} />
      )}
      <RecordedHighlights />
      <StoredMatches />
    </section>
  )
}
