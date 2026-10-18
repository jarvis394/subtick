import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { ApiError, api, unwrap } from '@/lib/api'

const HELP_URL = 'https://help.steampowered.com/en/wizard/HelpWithGameIssue/?appid=730&issueid=128'

const ERRORS: Record<string, string> = {
  invalid_auth_code:
    "Steam rejected this authentication code for your account. Check it's the latest one.",
  invalid_share_code:
    "Steam doesn't know this share code for your account. Use your most recent match.",
}

/** Authentication code + latest share code, validated against Valve by the api. */
export const MatchAuthForm = ({ steamId, onDone }: { steamId: string; onDone?: () => void }) => {
  const queryClient = useQueryClient()
  const save = useMutation({
    mutationFn: (body: { authCode: string; shareCode: string }) =>
      unwrap(api['steam-links']({ steamId })['match-auth'].put(body)),
    onSuccess: async () => {
      await queryClient.invalidateQueries()
      onDone?.()
    },
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    save.mutate({
      authCode: String(form.get('authCode')),
      shareCode: String(form.get('shareCode')),
    })
  }

  const error =
    save.error instanceof ApiError
      ? (ERRORS[save.error.message] ??
        (save.error.status === 422 ? 'Check the format of both codes.' : save.error.message))
      : save.error?.message

  return (
    <form onSubmit={submit} className="grid gap-4">
      <p className="text-sm leading-relaxed text-muted">
        Steam only shares your match history with an authentication code. Find it, together with
        your most recent match's share code, on{' '}
        <a
          href={HELP_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-accent hover:underline"
        >
          Steam Help → Access to Your Match History <ExternalLink className="size-3" />
        </a>
        .
      </p>
      <Field label="Authentication code">
        <Input
          name="authCode"
          required
          placeholder="XXXX-XXXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
      </Field>
      <Field label="Most recent match share code">
        <Input
          name="shareCode"
          required
          placeholder="CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx"
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
      </Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div>
        <Button type="submit" variant="contrast" disabled={save.isPending}>
          {save.isPending ? 'Checking with Steam…' : 'Save and start syncing'}
        </Button>
      </div>
    </form>
  )
}
