/* oxlint-disable no-await-in-loop -- polling loops: each check waits for the game or Steam */
import { readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Logger } from '@subtick/logger'
import { type NetCon, connectNetCon } from './netcon'
import {
  type SteamCredentials,
  findLoginWindow,
  readLoginScreen,
  clearSteamGuardCode,
  steamGuardCode,
  typeSteamGuardCode,
  typeSteamLogin,
} from './steam-login'

export interface WineGameOptions {
  cs2Dir: string
  prefix: string
  netconPort: number
  /** Folder HLAE hands to CS2 as `USRLOCALCSGO`: our cfg and video settings live here. */
  configDir: string
  /** Signs a fresh prefix in without VNC; once signed in, Steam reuses its saved token. */
  steamAccount?: SteamAccountSource
  /** `emulator`: the game files carry a Steam emulator, so the Steam client is never started. */
  steam?: 'client' | 'emulator'
  log: Logger<unknown>
}

/** Where sign-in details come from: env vars on a standalone machine, or the subtick api. */
export interface SteamAccountSource {
  credentials(): Promise<SteamCredentials | undefined>
  /** A Steam Guard code (emailed or from the mobile app) someone handed over since the last call. */
  takeGuardCode(): Promise<string | null>
  /**
   * Sign-in progress, for the admin. `note` says why a step is repeated (a code Steam didn't take,
   * a sign-in Steam dropped); it is cleared by the next step without one.
   */
  onSigningIn?(phase: SignInPhase, note?: string): void
}

export type SignInPhase = 'credentials' | 'needs_guard_code' | 'checking_guard_code' | 'done'

const STEAM_LOGIN_TIMEOUT_MS = 3 * 60_000
/** Time for a person to fetch an emailed Steam Guard code and hand it over. */
const STEAM_EMAIL_CODE_TIMEOUT_MS = 15 * 60_000
/** A typed code that hasn't signed Steam in by now was not taken (mistyped, expired, used). */
const GUARD_CODE_CHECK_MS = 30_000
/** Sign-ins Steam drops (it loses its connection, the code step times out) are started over. */
const STEAM_SIGN_IN_ATTEMPTS = 3
/** Pending this long, a sign-in is most likely waiting for approval in the Steam Mobile App. */
const APPROVAL_HINT_MS = 8000
/** The form can still show for a moment after Sign in is pressed. */
const FORM_SETTLE_MS = 6000
/** Sign in pending this long means Steam is stuck; shorter than STEAM_LOGIN_TIMEOUT_MS to say so. */
const SIGN_IN_PENDING_MS = 2 * 60_000
const GAME_START_TIMEOUT_MS = 4 * 60_000
/** The menu line may come before we connect; playdemo's retries cover a still-booting game. */
const MENU_WAIT_MS = 60_000

/** Linux path as Wine programs see it: the prefix's drive C, everything else through Z:. */
export const windowsPath = (prefix: string, path: string) => {
  const driveC = join(prefix, 'drive_c')
  const windows = path.startsWith(`${driveC}/`) ? `C:${path.slice(driveC.length)}` : `Z:${path}`
  return windows.replaceAll('/', '\\')
}

/** Processes whose command line contains `needle` (Wine shows Windows command lines). */
export const findProcesses = async (needle: string) => {
  const pids: number[] = []
  for (const entry of await readdir('/proc')) {
    const pid = Number(entry)
    if (!Number.isInteger(pid) || pid === process.pid) continue
    try {
      const cmdline = await Bun.file(`/proc/${pid}/cmdline`).text()
      if (cmdline.replaceAll('\0', ' ').includes(needle)) pids.push(pid)
    } catch {
      // The process exited while we were looking.
    }
  }
  return pids
}

const steamRunning = async () => (await findProcesses('Steam\\steam.exe')).length > 0

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Starts and stops the Windows Steam client and CS2 (through HLAE's loader) in the Wine prefix.
 * Steam signs in once, from credentials or by hand over VNC, and then from its saved token.
 */
export const createWineGame = (options: WineGameOptions) => {
  const { cs2Dir, prefix, netconPort, configDir, steamAccount, log } = options
  const emulated = options.steam === 'emulator'
  const steamDir = join(prefix, 'drive_c/Program Files (x86)/Steam')
  const hlaeDir = join(prefix, 'drive_c/hlae')
  const cs2Exe = join(cs2Dir, 'game/bin/win64/cs2.exe')
  /** Accounts without a stored shared secret need a code typed in; it can be handed over in this file. */
  const guardCodeFile = join(dirname(prefix), 'steam-guard-code')
  const takeGuardCode = async () => {
    const fromSource = await steamAccount?.takeGuardCode()
    if (fromSource) return fromSource
    const file = Bun.file(guardCodeFile)
    if (!(await file.exists())) return null
    const code = await file.text()
    await rm(guardCodeFile, { force: true })
    return code
  }

  const spawnWine = (args: string[], env: Record<string, string> = {}) =>
    Bun.spawn(['wine', ...args], {
      cwd: args[0]?.startsWith('C:\\hlae') ? hlaeDir : undefined,
      env: { ...process.env, WINEPREFIX: prefix, WINEDEBUG: '-all', ...env },
      stdio: ['ignore', 'ignore', 'ignore'],
    })

  const steamLogins = async () => {
    const file = Bun.file(join(steamDir, 'logs/connection_log.txt'))
    if (!(await file.exists())) return 0
    return (await file.text()).match(/\[Logged On,/g)?.length ?? 0
  }

  /** Kills every Windows process in the prefix (Steam, CS2, HLAE) through its wineserver. */
  const stopAll = async () => {
    await Bun.spawn(['wineserver', '-k'], { env: { ...process.env, WINEPREFIX: prefix } }).exited
    await Bun.spawn(['wineserver', '-w'], { env: { ...process.env, WINEPREFIX: prefix } }).exited
  }

  /** The account Steam signs in with on start, from the registry; null when signed out. */
  const signedInAs = async () => {
    const reg = Bun.file(join(prefix, 'user.reg'))
    if (!(await reg.exists())) return null
    return /^"AutoLoginUser"="([^"]+)"$/m.exec(await reg.text())?.[1] ?? null
  }

  /** Forgets the signed-in account (its saved token and login), so Steam asks again. */
  const signOut = async () => {
    log.info({ account: await signedInAs() }, 'signing Steam out')
    await stopAll()
    await rm(join(steamDir, 'config/loginusers.vdf'), { force: true })
    // local.vdf holds the encrypted refresh token ("ConnectCache").
    for (const user of await readdir(join(prefix, 'drive_c/users')).catch(() => []))
      await rm(join(prefix, 'drive_c/users', user, 'AppData/Local/Steam/local.vdf'), {
        force: true,
      })
    const reg = Bun.spawn(
      ['wine', 'reg', 'add', 'HKCU\\Software\\Valve\\Steam', '/v', 'AutoLoginUser', '/d', '', '/f'],
      {
        env: { ...process.env, WINEPREFIX: prefix, WINEDEBUG: '-all' },
        stdio: ['ignore', 'ignore', 'ignore'],
      },
    )
    await reg.exited
    await stopAll()
  }

  /** Starts Steam if needed and waits until it's signed in, typing credentials if it asks. */
  const ensureSteam = async () => {
    if (await steamRunning()) {
      if (!(await findLoginWindow())) return
      // A sign-in that failed earlier left the form open: start over.
      log.warn('Steam is stuck at its sign-in window; restarting it')
      await stopAll()
    }
    log.info('starting Steam')
    const before = await steamLogins()
    spawnWine([windowsPath(prefix, join(steamDir, 'steam.exe')), '-no-cef-sandbox', '-silent'])
    let deadline = Date.now() + STEAM_LOGIN_TIMEOUT_MS
    let attempts = 0
    let failure: string | null = null
    /** When Sign in was pressed; null while the credentials still have to be typed. */
    let typedAt: number | null = null
    let sharedSecret: string | undefined
    /** When Steam's code step showed up for this attempt. */
    let codeStepAt: number | null = null
    let codeTypedAt: number | null = null
    let approvalAsked = false
    try {
      while (Date.now() < deadline) {
        await sleep(3000)
        if ((await steamLogins()) > before) return log.info('Steam signed in')
        const window = await findLoginWindow()
        if (!window) continue
        // Only ever type into the screen meant for it: a code typed into the form ends up in the
        // account name.
        const screen = await readLoginScreen(window)

        if (typedAt !== null && screen === 'form' && Date.now() - typedAt > FORM_SETTLE_MS) {
          // Steam dropped this sign-in (it gives up on the code step after about a minute) and
          // is back at the form. Start over; Steam sends a new code.
          if (attempts >= STEAM_SIGN_IN_ATTEMPTS) {
            failure = `Steam dropped the sign-in ${attempts} times: check the account, its password and the network`
            break
          }
          log.warn({ attempts }, 'Steam is back at its sign-in form; typing the credentials again')
          await takeGuardCode()
          const hadCodeStep = codeStepAt !== null
          typedAt = codeStepAt = codeTypedAt = null
          approvalAsked = false
          steamAccount?.onSigningIn?.(
            'credentials',
            hadCodeStep
              ? 'Steam gave up waiting for the code (it waits about a minute) and is signing in ' +
                  'again. Enter the new code it emails as soon as it arrives.'
              : 'Steam dropped the sign-in, so it is signing in again.',
          )
        }

        if (typedAt === null) {
          if (screen !== 'form') continue
          const credentials = await steamAccount?.credentials()
          if (!credentials) {
            if (attempts === 0)
              log.warn('Steam is waiting for a sign-in: assign it an account, or sign in over VNC')
            attempts = Math.max(attempts, 1)
            continue
          }
          attempts++
          log.info({ username: credentials.username, attempts }, 'signing Steam in')
          if (attempts === 1) steamAccount?.onSigningIn?.('credentials')
          await rm(guardCodeFile, { force: true })
          await typeSteamLogin(window, credentials)
          typedAt = Date.now()
          sharedSecret = credentials.sharedSecret
          continue
        }

        if (screen === 'pending') {
          // Accounts with the Steam Mobile Authenticator wait here for the sign-in to be approved
          // in the app; under Wine that screen still looks like Sign in spinning.
          if (!approvalAsked && Date.now() - typedAt > APPROVAL_HINT_MS) {
            approvalAsked = true
            steamAccount?.onSigningIn?.(
              'credentials',
              'Approve the sign-in in the Steam Mobile App (tap Yes on the request).',
            )
          }
          if (Date.now() - typedAt > SIGN_IN_PENDING_MS) {
            failure =
              "Steam didn't finish signing in: the sign-in wasn't approved in the Steam Mobile " +
              "App in time, or Steam can't reach its servers. It tries again on the next job."
            break
          }
          continue
        }
        if (screen !== 'other') continue

        // The code step.
        if (codeStepAt === null) {
          codeStepAt = Date.now()
          if (sharedSecret) {
            await typeSteamGuardCode(window, steamGuardCode(sharedSecret))
            codeTypedAt = Date.now()
            continue
          }
          deadline = Date.now() + STEAM_EMAIL_CODE_TIMEOUT_MS
          steamAccount?.onSigningIn?.(
            'needs_guard_code',
            attempts > 1
              ? 'Steam sent a new code. Enter it within about a minute; older ones no longer work.'
              : undefined,
          )
          log.warn(
            { file: guardCodeFile },
            'if Steam asks for a Steam Guard code (email or mobile app), enter it in subtick (Manage instance → Recorders) or write ' +
              `it to this file (docker exec <container> sh -c 'echo CODE > ${guardCodeFile}')`,
          )
        }
        if (codeTypedAt !== null && Date.now() - codeTypedAt > GUARD_CODE_CHECK_MS) {
          codeTypedAt = null
          steamAccount?.onSigningIn?.(
            'needs_guard_code',
            "Steam didn't accept that code. Check it (or use a newer one) and send it again.",
          )
        }
        if (sharedSecret) continue
        const code = await takeGuardCode()
        if (!code) continue
        log.info('typing the Steam Guard code')
        // A code step that showed an error keeps the old characters: clear them first.
        await clearSteamGuardCode(window)
        await typeSteamGuardCode(window, code)
        codeTypedAt = Date.now()
        steamAccount?.onSigningIn?.('checking_guard_code')
      }
    } finally {
      steamAccount?.onSigningIn?.('done')
    }
    throw new Error(
      failure ??
        (codeStepAt !== null
          ? 'Steam did not sign in: no Steam Guard code it accepted arrived in time'
          : 'Steam did not sign in: check the account and its password'),
    )
  }

  /** Connects to a running CS2, or starts one through HLAE and waits for its console. */
  const connect = async (): Promise<NetCon> => {
    const consoleLog = { onLine: (line: string) => line && log.trace(line) }
    const running = await connectNetCon(netconPort, consoleLog).catch(() => null)
    if (running) return running

    if (!emulated) await ensureSteam()
    log.info({ steam: options.steam ?? 'client' }, 'starting CS2 through HLAE')
    spawnWine(
      [
        'C:\\hlae\\HLAE.exe',
        '-customLoader',
        '-noGui',
        '-autoStart',
        '-hookDllPath',
        'C:\\hlae\\x64\\AfxHookSource2.dll',
        '-programPath',
        windowsPath(prefix, cs2Exe),
        '-cmdLine',
        [
          '-steam -insecure +sv_lan 1 -console -sw -w 1280 -h 720 -novid -nojoy',
          `-netconport ${netconPort} -afxDisableSteamStorage +exec subtick`,
        ].join(' '),
      ],
      { USRLOCALCSGO: windowsPath(prefix, configDir) },
    )

    const deadline = Date.now() + GAME_START_TIMEOUT_MS
    while (Date.now() < deadline) {
      await sleep(2000)
      const netcon = await connectNetCon(netconPort, consoleLog).catch(() => null)
      if (!netcon) continue
      // The port opens before the game finishes booting; an echo round-trip means it's up.
      // The port opens early in boot. Once the console echoes, wait for the menu's background
      // map: until then CS2 ignores host changes like `playdemo`.
      const menu = netcon.waitFor(/Signon traffic "server"/, MENU_WAIT_MS)
      menu.catch(() => {})
      netcon.send('echo subtick_ready')
      const up = await netcon.waitFor(/^subtick_ready$/, 5000).catch(() => null)
      if (!up) {
        netcon.close()
        continue
      }
      await menu.catch(() => {})
      // CS2 sometimes drops console clients that connected early in boot; connect again.
      if (netcon.closed) continue
      await Bun.sleep(3000)
      if (!netcon.closed) return netcon
    }
    throw new Error('CS2 did not start: no netcon answer')
  }

  const kill = async () => {
    const pids = await findProcesses('cs2.exe')
    for (const pid of pids) process.kill(pid, 'SIGKILL')
    if (pids.length) log.warn({ pids }, 'killed CS2')
    // Until its console port closes, a dying game would still accept the next connection, and
    // `connect` would take it for a running one.
    for (let i = 0; i < (pids.length ? 30 : 1); i++) {
      const netcon = await connectNetCon(netconPort).catch(() => null)
      if (!netcon) return
      netcon.close()
      await sleep(1000)
    }
    // Still answering, or answering though no cs2.exe was found (seen after a timed-out clip):
    // stop every Windows process in the prefix so the next start is a fresh game.
    log.warn({ pids }, 'CS2 still answers after the kill; stopping all Windows processes')
    await stopAll()
  }

  return {
    connect,
    kill,
    // An emulated Steam has no account to sign in or out of.
    signIn: emulated ? async () => {} : ensureSteam,
    signOut: emulated ? async () => {} : signOut,
    signedInAs: emulated ? async () => null : signedInAs,
  }
}

export type WineGame = ReturnType<typeof createWineGame>
