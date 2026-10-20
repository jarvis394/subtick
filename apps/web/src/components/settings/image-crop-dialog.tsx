import { Dialog } from '@base-ui/react/dialog'
import { Slider } from '@base-ui/react/slider'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface CropShape {
  /** Width over height of the result. */
  aspect: number
  /** Pixel size of the result. */
  width: number
  round?: boolean
}

interface View {
  zoom: number
  x: number
  y: number
}

const fit = (image: HTMLImageElement, frame: DOMRect) =>
  Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight)

/** Offsets that keep the image covering the frame at this zoom. */
const clamp = (view: View, image: HTMLImageElement, frame: DOMRect): View => {
  const scale = fit(image, frame) * view.zoom
  const maxX = Math.max(0, (image.naturalWidth * scale - frame.width) / 2)
  const maxY = Math.max(0, (image.naturalHeight * scale - frame.height) / 2)
  return {
    zoom: view.zoom,
    x: Math.min(maxX, Math.max(-maxX, view.x)),
    y: Math.min(maxY, Math.max(-maxY, view.y)),
  }
}

const render = async (image: HTMLImageElement, frame: DOMRect, view: View, shape: CropShape) => {
  const scale = fit(image, frame) * view.zoom
  const sw = frame.width / scale
  const sh = frame.height / scale
  const sx = image.naturalWidth / 2 - view.x / scale - sw / 2
  const sy = image.naturalHeight / 2 - view.y / scale - sh / 2
  const canvas = document.createElement('canvas')
  canvas.width = shape.width
  canvas.height = Math.round(shape.width / shape.aspect)
  const context = canvas.getContext('2d')!
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  )
  if (!blob) throw new Error('Could not process the image')
  return new File([blob], 'image.webp', { type: 'image/webp' })
}

/**
 * Drag to position and zoom to frame a picked image, then save the framed part, re-encoded as WebP
 * at the size it's shown at, so uploads stay small whatever the original was.
 */
export const ImageCropDialog = ({
  file,
  shape,
  title,
  saving,
  onSave,
  onClose,
}: {
  file: File | null
  shape: CropShape
  title: string
  saving: boolean
  onSave: (file: File) => void
  onClose: () => void
}) => {
  const [url, setUrl] = useState<string>()
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const image = useRef<HTMLImageElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; view: View } | null>(null)

  useEffect(() => {
    if (!file) return
    const next = URL.createObjectURL(file)
    setUrl(next)
    setView({ zoom: 1, x: 0, y: 0 })
    return () => URL.revokeObjectURL(next)
  }, [file])

  const update = (next: View) => {
    if (!image.current?.naturalWidth || !frame.current) return setView(next)
    setView(clamp(next, image.current, frame.current.getBoundingClientRect()))
  }

  const scale =
    image.current?.naturalWidth && frame.current
      ? fit(image.current, frame.current.getBoundingClientRect()) * view.zoom
      : 0

  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, view }
  }
  const onPointerMove = (event: PointerEvent) => {
    const start = drag.current
    if (!start) return
    update({
      ...start.view,
      x: start.view.x + event.clientX - start.x,
      y: start.view.y + event.clientY - start.y,
    })
  }

  return (
    <Dialog.Root open={Boolean(file)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-surface p-5 shadow-2xl outline-none transition-[opacity,scale] duration-150 ease-out-quart data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0">
          <Dialog.Title className="text-base font-medium">{title}</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            Drag to move it, use the slider to zoom.
          </Dialog.Description>

          <div
            ref={frame}
            className={cn(
              'relative mx-auto mt-4 cursor-grab touch-none overflow-hidden bg-surface-2 select-none active:cursor-grabbing',
              shape.round ? 'w-64 max-w-full rounded-full' : 'w-full rounded-xl',
            )}
            style={{ aspectRatio: shape.aspect }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {url && (
              <img
                ref={image}
                src={url}
                alt=""
                draggable={false}
                onLoad={() => update(view)}
                className="absolute top-1/2 left-1/2 max-w-none origin-center"
                style={{
                  width: image.current ? image.current.naturalWidth * scale : undefined,
                  translate: `calc(-50% + ${view.x}px) calc(-50% + ${view.y}px)`,
                  opacity: scale ? 1 : 0,
                }}
              />
            )}
          </div>

          <Slider.Root
            value={view.zoom}
            min={1}
            max={3}
            step={0.01}
            onValueChange={(zoom) =>
              update({ ...view, zoom: Array.isArray(zoom) ? zoom[0]! : zoom })
            }
            className="mt-4 flex items-center gap-3"
          >
            <Slider.Label className="text-[13px] text-muted">Zoom</Slider.Label>
            <Slider.Control className="flex h-6 flex-1 cursor-pointer touch-none items-center select-none">
              <Slider.Track className="h-1 w-full rounded-full bg-surface-3">
                <Slider.Indicator className="rounded-full bg-foreground" />
                <Slider.Thumb
                  aria-label="Zoom"
                  className="size-4 rounded-full bg-foreground shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring"
                />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
            <Button
              variant="primary"
              loading={saving}
              onClick={async () => {
                if (!image.current || !frame.current) return
                onSave(
                  await render(image.current, frame.current.getBoundingClientRect(), view, shape),
                )
              }}
            >
              Save
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
