const LEADS = {
  capture: 'The game failed while capturing it',
  delivery: 'The capture finished, but the clip could not be saved',
  job: 'The recording job stopped',
} as const

/** Long stack-ish messages (ffmpeg, wine) would swamp the card that shows them. */
const MAX_LENGTH = 400

/** Why a clip failed, worded for the person who asked for it, with the recorder's own message. */
export const failureReason = (stage: keyof typeof LEADS, error: unknown) => {
  const message = (error instanceof Error ? error.message : String(error)).trim()
  const detail = message.length > MAX_LENGTH ? `${message.slice(0, MAX_LENGTH)}…` : message
  return detail ? `${LEADS[stage]}: ${detail}` : LEADS[stage]
}
