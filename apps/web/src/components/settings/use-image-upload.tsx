import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ApiError, api, unwrap } from '@/lib/api'
import { type CropShape, ImageCropDialog } from './image-crop-dialog'

export type ImageKind = 'avatar' | 'banner'

const SHAPES: Record<ImageKind, CropShape> = {
  avatar: { aspect: 1, width: 512, round: true },
  banner: { aspect: 3, width: 1500 },
}

/**
 * For the picked original. What's uploaded is the cropped WebP, well under the api's own limits,
 * so this only keeps the browser from decoding something huge.
 */
const MAX_PICK_BYTES = 10_000_000
export const UPLOAD_LIMITS = 'PNG, JPEG or WebP, up to 10 MB'

const IMAGE_ERRORS: Record<string, string> = {
  too_large: 'That image is too large. Try a smaller one',
  unsupported_type: 'Use a PNG, JPEG or WebP image',
}

/** `/me` and every profile show these pictures. */
export const invalidateProfile = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({
    predicate: (q) => ['me', 'player'].includes(String(q.queryKey[0])),
  })

/**
 * Picks a file, frames it in the crop dialog, uploads the result. Render `picker` and `dialog`
 * somewhere; `pick()` opens the file chooser.
 */
export const useImageUpload = (kind: ImageKind) => {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<File | null>(null)

  const upload = useMutation({
    meta: { inlineError: true },
    mutationFn: (file: File) => unwrap(api.me.images({ kind }).put({ file })),
    onSuccess: async () => {
      setPicked(null)
      await invalidateProfile(queryClient)
      toast.success(kind === 'avatar' ? 'Avatar updated' : 'Banner updated')
    },
    onError: (error) =>
      toast.error(
        (error instanceof ApiError && IMAGE_ERRORS[error.message]) || 'Could not upload the image',
      ),
  })

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/png,image/jpeg,image/webp"
      hidden
      onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        event.currentTarget.value = ''
        if (!file) return
        if (file.size > MAX_PICK_BYTES) return void toast.error('That image is over 10 MB')
        setPicked(file)
      }}
    />
  )
  const dialog = (
    <ImageCropDialog
      file={picked}
      shape={SHAPES[kind]}
      title={kind === 'avatar' ? 'Frame your avatar' : 'Frame your banner'}
      saving={upload.isPending}
      onSave={(file) => upload.mutate(file)}
      onClose={() => setPicked(null)}
    />
  )
  return { pick: () => input.current?.click(), picker, dialog }
}

/** Drops the uploaded picture: the avatar falls back to Steam's, the banner to the default. */
export const useRemoveImage = (kind: ImageKind) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => unwrap(api.me.images({ kind }).delete()),
    onSuccess: () => invalidateProfile(queryClient),
  })
}
