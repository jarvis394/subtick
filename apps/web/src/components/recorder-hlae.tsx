import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import type { AdminRecorder } from '@/lib/admin'
import { api, unwrap } from '@/lib/api'

/** GitHub is asked at most every half hour by the api; no need to poll it here. */
const latestHlaeQuery = queryOptions({
  queryKey: ['admin', 'hlae'],
  queryFn: () => unwrap(api.admin.recorders.hlae.get()),
  staleTime: 10 * 60_000,
  retry: false,
})

/** `prerelease-103-<sha>` reads as `prerelease-103`. */
const shortRelease = (release: string) => release.replace(/-[0-9a-f]{40}$/, '')

const describe = (hlae: string | null, pov: string | null) =>
  hlae ? `${hlae}${pov ? ` · mirv_pov ${shortRelease(pov)}` : ''}` : 'Unknown'

/** The HLAE build a recorder runs, and a way to move it to the latest mirv_pov fork build. */
export function RecorderHlae({ recorder }: { recorder: AdminRecorder }) {
  const queryClient = useQueryClient()
  const latest = useQuery(latestHlaeQuery)
  const update = useMutation({
    meta: { inlineError: true },
    mutationFn: () => unwrap(api.admin.recorders({ id: recorder.id }).hlae.post()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'recorders'] }),
  })

  const target = recorder.hlaeTarget
  const installing =
    target &&
    (target.hlae !== recorder.hlaeVersion ||
      (recorder.hlaePovRelease !== null && target.povRelease !== recorder.hlaePovRelease))
  const behind =
    latest.data &&
    (latest.data.hlae !== recorder.hlaeVersion ||
      latest.data.povRelease !== recorder.hlaePovRelease) &&
    latest.data.povRelease !== target?.povRelease

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="text-label text-muted">HLAE</p>
        <p className="truncate text-body select-text">
          {describe(recorder.hlaeVersion, recorder.hlaePovRelease)}
        </p>
        <p className="text-small text-muted">
          {installing
            ? `Installs ${describe(target.hlae, target.povRelease)} before its next clip`
            : behind
              ? `${describe(latest.data.hlae, latest.data.povRelease)} is out`
              : latest.isError
                ? `Couldn't check for updates: ${latest.error.message}`
                : latest.data
                  ? 'Up to date'
                  : 'Checking for updates…'}
        </p>
      </div>
      {behind && !installing && (
        <Button
          size="sm"
          variant="secondary"
          loading={update.isPending}
          onClick={() => update.mutate()}
        >
          Update
        </Button>
      )}
      {update.error && <p className="text-body text-danger select-text">{update.error.message}</p>}
    </div>
  )
}
