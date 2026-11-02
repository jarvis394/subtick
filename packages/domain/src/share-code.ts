const DICTIONARY = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789'
const BASE = BigInt(DICTIONARY.length)
const SHARE_CODE_RE = /^CSGO(-[A-Za-z0-9]{5}){5}$/

export interface DecodedShareCode {
  matchId: bigint
  outcomeId: bigint
  token: number
}

export const isShareCode = (code: string) => SHARE_CODE_RE.test(code)

const readUintLE = (bytes: Uint8Array, from: number, length: number) => {
  let value = 0n
  for (let i = from + length - 1; i >= from; i--) value = (value << 8n) | BigInt(bytes[i]!)

  return value
}

const writeUintLE = (bytes: Uint8Array, from: number, length: number, value: bigint) => {
  for (let i = from; i < from + length; i++) {
    bytes[i] = Number(value & 0xffn)
    value >>= 8n
  }
}

/** Decodes a `CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx` match share code. */
export const decodeShareCode = (code: string): DecodedShareCode => {
  if (!isShareCode(code)) throw new Error(`Invalid share code: ${code}`)

  let big = 0n
  for (const char of [...code.slice(5).replaceAll('-', '')].toReversed()) {
    big = big * BASE + BigInt(DICTIONARY.indexOf(char))
  }

  // 18 bytes, big-endian
  const bytes = new Uint8Array(18)
  for (let i = 17; i >= 0; i--) {
    bytes[i] = Number(big & 0xffn)
    big >>= 8n
  }

  return {
    matchId: readUintLE(bytes, 0, 8),
    outcomeId: readUintLE(bytes, 8, 8),
    token: Number(readUintLE(bytes, 16, 2)),
  }
}

export const encodeShareCode = ({ matchId, outcomeId, token }: DecodedShareCode): string => {
  const bytes = new Uint8Array(18)
  writeUintLE(bytes, 0, 8, matchId)
  writeUintLE(bytes, 8, 8, outcomeId)
  writeUintLE(bytes, 16, 2, BigInt(token))

  let big = 0n
  for (const byte of bytes) big = (big << 8n) | BigInt(byte)

  let chars = ''
  for (let i = 0; i < 25; i++) {
    chars += DICTIONARY[Number(big % BASE)]
    big /= BASE
  }

  return `CSGO-${chars.match(/.{5}/g)!.join('-')}`
}
