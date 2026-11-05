import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button, IconButton } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Card } from '@/components/ui/surface'
import { api, unwrap } from '@/lib/api'
import type { Me } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { EditableImage } from './editable-image'
import { UPLOAD_LIMITS, invalidateProfile, useRemoveImage } from './use-image-upload'
import { playerSlug } from '@/components/player-link'

const Row = ({
  label,
  description,
  children,
}: {
  label: string
  description: ReactNode
  children: ReactNode
}) => (
  <div className="@container flex min-h-16 flex-wrap items-center gap-3 py-3">
    {/* Wide enough that the row wraps the control below before the text breaks word by word. */}
    <div className="min-w-36 flex-1">
      <p className="text-body font-medium">{label}</p>
      <div className="mt-0.5 text-small text-muted">{description}</div>
    </div>
    <div className="flex shrink-0 items-center gap-2">{children}</div>
  </div>
)

/** Saves on the check button or Enter; Escape puts the saved name back. */
const NameRow = ({ current }: { current: string }) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState(current)
  const { mutate, isError, isPending } = useMutation({
    meta: { inlineError: true },
    mutationFn: (value: string) => unwrap(api.me.profile.patch({ name: value })),
    // Awaited, so the button stays busy until the new name is back and it can hide.
    onSuccess: () => invalidateProfile(queryClient),
  })
  const value = name.trim()
  const edited = value !== current
  const dirty = edited && Boolean(value)
  const error = !value ? 'Enter a name' : isError ? 'Couldn’t save your name' : null

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (dirty) mutate(value)
  }

  return (
    <Row
      label="Display name"
      description={
        error ? <span className="text-danger">{error}</span> : 'Shown across the website'
      }
    >
      <form onSubmit={save} className="relative">
        <Input
          aria-label="Display name"
          value={name}
          maxLength={32}
          aria-invalid={Boolean(error)}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => event.key === 'Escape' && setName(current)}
          // Full size once the row fits it beside the label's 9rem minimum.
          className={cn('w-44 @sm:w-56 @md:w-64', dirty && 'pr-10')}
        />
        {/* Always mounted, so it can scale and fade out; `inert` while hidden keeps it out of reach. */}
        <IconButton
          type="submit"
          variant="primary"
          size="sm"
          label="Save name"
          loading={isPending}
          inert={!dirty}
          aria-hidden={!dirty}
          className={cn(
            'absolute top-1 right-1 transition-[opacity,scale,visibility] duration-150 ease-out motion-reduce:transition-none',
            !dirty && 'invisible scale-75 opacity-0',
          )}
        >
          <Check />
        </IconButton>
      </form>
    </Row>
  )
}

export const ProfileSection = ({ me }: { me: Me }) => {
  const removeAvatar = useRemoveImage('avatar')
  const removeBanner = useRemoveImage('banner')
  const steam = me.steamLinks[0]

  return (
    <section id="profile" className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex h-8 items-center justify-between gap-4">
        <h2 className="text-lead font-medium">Profile</h2>
        {steam && (
          <Button
            size="sm"
            variant="ghost"
            render={<Link to="/players/$player" params={{ player: playerSlug(steam) }} />}
          >
            View profile
          </Button>
        )}
      </div>
      <Card bleed className="divide-y *:px-4 md:px-4 md:*:px-0">
        <NameRow current={me.user.name} />

        <Row
          label="Avatar"
          description={
            <>
              {UPLOAD_LIMITS}
              {me.user.hasUploadedAvatar && (
                <span className="mt-1 block">
                  <Button
                    variant="link"
                    onClick={() => removeAvatar.mutate()}
                    disabled={removeAvatar.isPending}
                  >
                    Use Steam avatar
                  </Button>
                </span>
              )}
            </>
          }
        >
          <EditableImage kind="avatar" size="xs" className="flex rounded-full">
            <Avatar src={me.user.avatarUrl} name={me.user.name} className="size-12" />
          </EditableImage>
        </Row>

        {/* Rows pad themselves (py-3); the preview closes the card with the card's own 16px. */}
        <div className="pb-4">
          <Row label="Banner" description={`${UPLOAD_LIMITS}. Cropped to 3:1`}>
            {me.user.bannerUrl && (
              <Button
                size="sm"
                variant="ghost"
                tone="danger"
                onClick={() => removeBanner.mutate()}
                loading={removeBanner.isPending}
              >
                Remove
              </Button>
            )}
          </Row>
          <EditableImage
            kind="banner"
            className="grid aspect-[3/1] w-full place-items-center overflow-hidden rounded-md border border-dashed bg-surface-2 text-small text-muted"
          >
            {me.user.bannerUrl ? (
              <img src={me.user.bannerUrl} alt="" className="size-full object-cover" />
            ) : (
              'No banner yet'
            )}
          </EditableImage>
        </div>
      </Card>
    </section>
  )
}
