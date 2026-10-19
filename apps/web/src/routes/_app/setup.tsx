import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { z } from 'zod'
import { MatchAuthForm } from '@/components/match-auth-form'
import { SteamIcon } from '@/components/steam-icon'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/surface'
import { describeAuthError, startSteamFlow } from '@/lib/auth'
import { notifyError } from '@/lib/notify'
import { meQuery } from '@/lib/queries'
import { skipSetup } from '@/lib/setup'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/setup')({
  validateSearch: z.object({ error: z.string().optional() }),
  component: SetupPage,
})

const Step = ({
  n,
  title,
  done,
  children,
}: {
  n: number
  title: string
  done: boolean
  children?: ReactNode
}) => (
  <Card className="p-5">
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'grid size-7 place-items-center rounded-full text-[13px] font-medium',
          done ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted',
        )}
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <h2 className="font-medium">{title}</h2>
    </div>
    {children && <div className="mt-4 pl-10">{children}</div>}
  </Card>
)

function SetupPage() {
  const { data: me } = useSuspenseQuery(meQuery)
  const { error } = Route.useSearch()
  const navigate = useNavigate()
  const [linking, setLinking] = useState(false)
  const link = me.steamLinks[0]

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <div className="mb-2">
        <h1 className="font-serif text-3xl tracking-tight">Set up subtick</h1>
        <p className="mt-1.5 text-muted">
          Two steps, then new matches are picked up and clipped automatically.
        </p>
      </div>

      <Step n={1} title="Connect your Steam account" done={Boolean(link)}>
        {link ? (
          <div className="flex items-center gap-2.5 text-sm">
            <Avatar src={link.avatarUrl} name={link.personaName} className="size-6" />
            {link.personaName}
          </div>
        ) : (
          <div className="grid gap-3">
            <Button
              variant="secondary"
              className="justify-self-start"
              loading={linking}
              onClick={() => {
                setLinking(true)
                void startSteamFlow('link', '/setup').catch((e: unknown) => {
                  setLinking(false)
                  notifyError('Couldn’t start the Steam sign-in', e)
                })
              }}
            >
              <SteamIcon />
              Connect Steam
            </Button>
            {error && <p className="text-sm text-danger">{describeAuthError(error)}</p>}
          </div>
        )}
      </Step>

      <Step n={2} title="Give access to your match history" done={Boolean(link?.hasMatchAuth)}>
        {link && !link.hasMatchAuth && (
          <MatchAuthForm steamId={link.steamId} onDone={() => navigate({ to: '/' })} />
        )}
      </Step>

      {!link?.hasMatchAuth && (
        <div className="flex items-center justify-between gap-4 pt-1 pl-1">
          <p className="text-[13px] text-muted">You can finish this later from the sidebar.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              skipSetup()
              void navigate({ to: '/' })
            }}
          >
            Skip for now
          </Button>
        </div>
      )}
    </div>
  )
}
