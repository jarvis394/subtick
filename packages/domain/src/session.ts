/** A break this long between the starts of two matches ends a session, midnight or not. */
const SESSION_GAP_HOURS = 4

/** Newest first, like the matches: one sitting of play per entry. */
export const splitSessions = <M extends { playedAt: Date | string }>(newestFirst: M[]) => {
  const gap = SESSION_GAP_HOURS * 3600 * 1000
  const sessions: M[][] = []
  let newer: number | null = null
  for (const match of newestFirst) {
    const at = new Date(match.playedAt).getTime()
    if (newer === null || newer - at > gap) sessions.push([match])
    else sessions.at(-1)!.push(match)
    newer = at
  }

  return sessions
}
