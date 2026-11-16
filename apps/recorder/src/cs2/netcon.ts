import { type Socket, createConnection } from 'node:net'

/**
 * CS2's netcon console (`-netconport`): a plain TCP stream, one command per line in, every console
 * line out. There are no replies tied to commands, so callers wait for a line they expect.
 */
export interface NetCon {
  send(...commands: string[]): void
  /** Resolves with the first console line matching `pattern` after this call. */
  waitFor(pattern: RegExp, timeoutMs: number): Promise<string>
  /** The last console lines, for error messages. */
  tail(): string[]
  readonly closed: boolean
  close(): void
}

const TAIL_LINES = 40
/** A closed port refuses at once on Linux; from WSL to Windows the connection hangs for minutes. */
const CONNECT_TIMEOUT_MS = 5000

export class NetConTimeoutError extends Error {
  override name = 'NetConTimeoutError'
}

interface Waiter {
  pattern: RegExp
  resolve: (line: string) => void
  reject: (error: Error) => void
  timer?: Timer
}

export interface NetConOptions {
  host?: string
  /** Sees every console line, e.g. to log the game's console. */
  onLine?: (line: string) => void
}

/** Destroyed on timeout, not abandoned: a pending connect keeps the process alive until the OS gives up. */
const open = (host: string, port: number) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = createConnection({ host, port })
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error(`no answer on netcon port ${port}`))
    }, CONNECT_TIMEOUT_MS)
    socket.once('connect', () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
  })

export const connectNetCon = async (
  port: number,
  { host = '127.0.0.1', onLine: watch }: NetConOptions = {},
): Promise<NetCon> => {
  const waiters = new Set<Waiter>()
  const recent: string[] = []
  let partial = ''
  let closed = false
  const decoder = new TextDecoder()
  const socket = await open(host, port)

  const onLine = (line: string) => {
    watch?.(line)
    recent.push(line)
    if (recent.length > TAIL_LINES) recent.shift()
    for (const waiter of waiters) {
      if (!waiter.pattern.test(line)) continue
      waiters.delete(waiter)
      clearTimeout(waiter.timer)
      waiter.resolve(line)
    }
  }

  /** The game went away: nothing a caller waits for will arrive. */
  const onClose = () => {
    if (closed) return
    closed = true
    for (const waiter of waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(new Error('netcon closed: CS2 exited or crashed'))
    }
    waiters.clear()
  }

  socket.on('data', (chunk: Buffer) => {
    const lines = (partial + decoder.decode(chunk, { stream: true })).split('\n')
    partial = lines.pop() ?? ''
    for (const line of lines) onLine(line.replace(/\r$/, ''))
  })
  socket.on('close', onClose)
  socket.on('error', onClose)

  return {
    send(...commands) {
      if (closed) throw new Error('netcon is closed')
      socket.write(commands.map((c) => `${c}\n`).join(''))
    },
    waitFor(pattern, timeoutMs) {
      return new Promise((resolve, reject) => {
        if (closed) return reject(new Error('netcon closed: CS2 exited or crashed'))
        const waiter: Waiter = { pattern, resolve, reject }
        waiters.add(waiter)
        waiter.timer = setTimeout(() => {
          if (!waiters.delete(waiter)) return
          const last = recent.slice(-5).join(' | ')
          reject(
            new NetConTimeoutError(
              `no console line matching ${pattern} within ${timeoutMs}ms; last lines: ${last}`,
            ),
          )
        }, timeoutMs)
      })
    },
    tail: () => [...recent],
    get closed() {
      return closed
    },
    close() {
      onClose()
      socket.destroy()
    },
  }
}
