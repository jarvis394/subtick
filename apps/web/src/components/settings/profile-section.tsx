import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Card } from '@/components/ui/surface'
import { api, unwrap } from '@/lib/api'
import type { Me } from '@/lib/queries'
import { EditableImage } from './editable-image'
import { UPLOAD_LIMITS, invalidateProfile, useRemoveImage } from './use-image-upload'

const Row = ({
  label,
  description,
  children,
}: {
  label: string
  description: ReactNode
  children: ReactNode
}) => (
  <div className="flex min-h-16 flex-wrap items-center gap-3 py-3">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-0.5 text-[13px] text-muted">{description}</div>
    </div>
    <div className="flex shrink-0 items-center gap-2">{children}</div>
  </div>
)

/** How long typing pauses before the name saves. */
const SAVE_DELAY_MS = 600

/** Saves as you type, once you pause; an empty name isn't saved, the last one stays. */
const NameRow = ({ current }: { current: string }) => {
  const queryClient = useQueryClient()
  const [name, setName] = useState(current)
  const { mutate, isError } = useMutation({
    meta: { inlineError: true },
    mutationFn: (value: string) => unwrap(api.me.profile.patch({ name: value })),
    onSuccess: () => invalidateProfile(queryClient),
  })

  useEffect(() => {
    const value = name.trim()
    if (!value || value === current) return
    const timer = setTimeout(() => mutate(value), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [name, current, mutate])

  const error = !name.trim() ? 'Enter a name' : isError ? 'Couldn’t save your name' : null

  return (
    <Row
      label="Display name"
      description={
        error ? <span className="text-danger">{error}</span> : 'Shown across the website'
      }
    >
      <Input
        aria-label="Display name"
        value={name}
        maxLength={32}
        aria-invalid={Boolean(error)}
        onChange={(event) => setName(event.currentTarget.value)}
        className="w-56 sm:w-64"
      />
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
        <h2 className="text-[15px] font-medium">Profile</h2>
        {steam && (
          <Button
            size="sm"
            variant="ghost"
            render={<Link to="/players/$steamId" params={{ steamId: steam.steamId }} />}
          >
            View profile
          </Button>
        )}
      </div>
      <Card className="divide-y px-4">
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
            className="grid aspect-[3/1] w-full place-items-center overflow-hidden rounded-md border border-dashed bg-surface-2 text-[13px] text-muted"
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
