/**
 * CS2 crosshair share codes (`CS` + 44 base57 chars, the format since the Sep 2026 update), as
 * demos report them in the `crosshair_code` player prop. Byte layout from akiver/csgo-sharecode.
 */
const DICTIONARY = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789'
const CODE_RE = new RegExp(`^CS[${DICTIONARY}]{44}$`)
const BYTES = 32

export const CROSSHAIR_STYLES = [
  'Dynamic cross',
  'Dynamic circle',
  'Dynamic cross (legacy)',
  'Static circle',
  'Static cross',
  'Static cross (shot feedback)',
  'Dot only',
  'Dynamic quad',
  'Static square',
  'Static quad',
] as const

export interface Crosshair {
  /** Index into `CROSSHAIR_STYLES`. */
  style: number
  followRecoil: boolean
  dot: boolean
  tStyle: boolean
  /** 0 none, 1 full, 2 half. */
  outlineMode: number
  color: { r: number; g: number; b: number; a: number }
  outlineColor: { r: number; g: number; b: number; a: number }
  /** Pixels at `screenHeight`; gap is from the center to where each line starts, and can be negative. */
  gap: number
  length: number
  thickness: number
  /** Vertical resolution the sizes are measured at; CS2 scales them to the player's screen. */
  screenHeight: number
}

export const isCrosshairCode = (code: string) => CODE_RE.test(code)

/** Null for anything that isn't a valid v1 code (bad checksum, unknown version, no screen height). */
export const decodeCrosshair = (code: string): Crosshair | null => {
  if (!isCrosshairCode(code)) return null

  let big = 0n
  for (const char of code.slice(2).split('').toReversed()) {
    big = big * 57n + BigInt(DICTIONARY.indexOf(char))
  }
  const b = Array.from({ length: BYTES }, () => 0)
  for (let i = BYTES - 1; i >= 0; i--) {
    b[i] = Number(big & 0xffn)
    big >>= 8n
  }
  const byte = (i: number) => b[i]!

  const sum = b.slice(1).reduce((total, x) => total + x, 0)
  if ((sum & 0xff) !== byte(0) || byte(1) !== 1) return null
  const screenHeight = byte(2) | (byte(3) << 8)
  if (screenHeight === 0) return null

  // A signed 16-bit integer.
  const gap = ((byte(14) | (byte(15) << 8)) << 16) >> 16
  return {
    style: Math.min(byte(4) & 0x1f, CROSSHAIR_STYLES.length - 1),
    followRecoil: (byte(4) & 0x20) !== 0,
    dot: (byte(4) & 0x40) !== 0,
    tStyle: (byte(4) & 0x80) !== 0,
    outlineMode: Math.min(byte(13) >>> 6, 2),
    color: { r: byte(5), g: byte(6), b: byte(7), a: byte(8) },
    outlineColor: { r: byte(9), g: byte(10), b: byte(11), a: byte(12) },
    gap: Math.max(-3840, Math.min(3840, gap)),
    length: byte(16),
    thickness: Math.min(byte(13) & 0x3f, 32),
    screenHeight: Math.max(screenHeight, 240),
  }
}
