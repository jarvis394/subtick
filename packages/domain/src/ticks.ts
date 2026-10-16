/** CS2 servers (and therefore SourceTV demos) run at 64 ticks per second. */
export const TICKRATE = 64

export const secondsToTicks = (seconds: number, tickrate = TICKRATE) =>
  Math.round(seconds * tickrate)
export const ticksToSeconds = (ticks: number, tickrate = TICKRATE) => ticks / tickrate
