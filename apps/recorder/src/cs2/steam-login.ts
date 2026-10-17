import { createHmac } from 'node:crypto'

/**
 * Signs the Windows Steam client in by typing into its login window, for unattended first boots.
 * After one sign-in Steam keeps a refresh token in the prefix and logs in by itself.
 */
export interface SteamCredentials {
  username: string
  password: string
  /** Steam Guard mobile authenticator secret (base64), to answer the 2FA prompt. */
  sharedSecret?: string
}

const CODE_CHARS = '23456789BCDFGHJKMNPQRTVWXY'

/** The 5-character Steam Guard code for `time` (Steam's TOTP variant: 30 s steps, own alphabet). */
export const steamGuardCode = (sharedSecret: string, time = Date.now()) => {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / 30)))
  const hmac = createHmac('sha1', Buffer.from(sharedSecret, 'base64')).update(counter).digest()
  const offset = hmac[19]! & 0x0f
  let value = hmac.readUInt32BE(offset) & 0x7fffffff
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[value % CODE_CHARS.length]
    value = Math.floor(value / CODE_CHARS.length)
  }
  return code
}

const xdotool = async (...args: string[]) => {
  const proc = Bun.spawn(['xdotool', ...args], { stdout: 'pipe', stderr: 'ignore' })
  const out = await new Response(proc.stdout).text()
  await proc.exited
  return out.trim()
}

/** The visible Steam login window, if Steam is showing one. */
export const findLoginWindow = async () =>
  (await xdotool('search', '--onlyvisible', '--name', '^Sign in to Steam$')).split('\n')[0] || null

/**
 * Types the credentials into the login window (its username field has focus when it opens). Each
 * field is selected first: a form Steam reset after a dropped sign-in keeps what was typed.
 */
export const typeSteamLogin = async (window: string, credentials: SteamCredentials) => {
  await xdotool('windowactivate', '--sync', window)
  await Bun.sleep(1000)
  await xdotool('key', 'ctrl+a')
  await xdotool('type', '--delay', '40', credentials.username)
  await xdotool('key', 'Tab')
  await xdotool('key', 'ctrl+a')
  await xdotool('type', '--delay', '40', credentials.password)
  await xdotool('key', 'Return')
}

/** Empties the code boxes after a rejected code: each Backspace clears one box and steps back. */
export const clearSteamGuardCode = async (window: string) => {
  await xdotool('windowactivate', '--sync', window)
  await xdotool('key', '--delay', '40', ...Array<string>(5).fill('BackSpace'))
}

/** Types a Steam Guard code: the code step replaces the form and focuses its first box. */
export const typeSteamGuardCode = async (window: string, code: string) => {
  await xdotool('windowactivate', '--sync', window)
  await xdotool('type', '--delay', '80', code.trim().toUpperCase())
}
