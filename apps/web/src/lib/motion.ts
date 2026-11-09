/** The app's easing curves for motion, mirroring the CSS tokens in styles.css. */
export const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const
/** Strong ease-out: the change starts at once and settles softly. */
export const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const
/** Expo ease-out: a quick start and a long, soft landing. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
/** Accelerating: holds at first, then leaves quickly. Only for brief exits, never for movement. */
export const EASE_IN_ACCELERATE = [0.4, 0, 1, 1] as const
