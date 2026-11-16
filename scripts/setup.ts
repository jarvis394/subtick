/* oxlint-disable no-await-in-loop -- polling, one check at a time */
/**
 * Prepares a development checkout: checks bun and Docker, installs dependencies, creates .env with
 * generated secrets, starts Postgres, Redis and SeaweedFS (infra/compose.yml), waits for them and
 * runs the migrations. Safe to rerun: it keeps every value already in .env. Never prints secrets.
 *   bun run setup
 */
import { randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import pkg from '../package.json'

const root = join(import.meta.dir, '..')
const envPath = join(root, '.env')
const compose = ['docker', 'compose', '-f', join(root, 'infra/compose.yml'), '--env-file', envPath]
const WAIT_MS = 180_000

/** Filled in when empty; both are 32 random bytes, base64 (what `openssl rand -base64 32` makes). */
const GENERATED = ['BETTER_AUTH_SECRET', 'SECRETS_KEY']

const say = (message: string) => console.log(`\x1b[2m›\x1b[0m ${message}`)
const warn = (message: string) => console.log(`\x1b[33m!\x1b[0m ${message}`)

const fail = (message: string, fix?: string): never => {
  console.error(`\x1b[31m✗\x1b[0m ${message}${fix ? `\n  ${fix}` : ''}`)
  process.exit(1)
}

const run = async (cmd: string[], inherit = false) => {
  const proc = Bun.spawn(cmd, {
    cwd: root,
    stdin: 'ignore',
    stdout: inherit ? 'inherit' : 'pipe',
    stderr: inherit ? 'inherit' : 'pipe',
  })
  const [stdout, stderr] = inherit
    ? ['', '']
    : await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])

  return { code: await proc.exited, stdout, stderr }
}

const checkBun = () => {
  const required = pkg.packageManager.replace(/^bun@/, '')
  const install = `curl -fsSL https://bun.sh/install | bash -s "bun-v${required}"`
  const [major, minor] = required.split('.')
  if (!Bun.version.startsWith(`${major}.${minor}.`))
    fail(`This repo uses bun ${required}; this is bun ${Bun.version}.`, install)
  if (Bun.version !== required) warn(`This repo pins bun ${required}; this is ${Bun.version}.`)
}

const checkDocker = async () => {
  const getDocker = 'Install Docker with the compose plugin: https://docs.docker.com/get-docker/'
  if (!Bun.which('docker'))
    fail('Docker is not installed. It runs Postgres, Redis and SeaweedFS here.', getDocker)
  if ((await run(['docker', 'compose', 'version'])).code !== 0)
    fail('`docker compose` (Compose v2) is not available.', getDocker)
  const info = await run(['docker', 'info'])
  if (info.code !== 0) {
    const reason = info.stderr.trim().split('\n').at(-1)
    fail(`Docker is not reachable: ${reason}`, 'Start Docker, and check your user may use it.')
  }
}

/** Creates .env from .env.example if missing and fills the generated secrets that are empty. */
const ensureEnv = async () => {
  const exists = await Bun.file(envPath).exists()
  let text = await Bun.file(join(root, exists ? '.env' : '.env.example')).text()
  const filled: string[] = []

  for (const key of GENERATED) {
    const line = new RegExp(`^${key}=(.*)$`, 'm')
    const current = text.match(line)?.[1]?.trim()
    if (current) continue
    const value = randomBytes(32).toString('base64')
    text = line.test(text)
      ? text.replace(line, () => `${key}=${value}`)
      : `${text.trimEnd()}\n${key}=${value}\n`
    filled.push(key)
  }

  if (!exists || filled.length) await writeFile(envPath, text, { mode: 0o600 })
  say(exists ? '.env exists; keeping every value already in it' : 'created .env from .env.example')
  if (filled.length) say(`generated ${filled.join(' and ')} in .env`)

  const env = parseEnv(text)
  const key = env.SECRETS_KEY ?? ''
  if (key.length !== 44 || Buffer.from(key, 'base64').length !== 32)
    warn('SECRETS_KEY in .env is not 32 bytes of base64; the api will refuse to start.')
  if ((env.BETTER_AUTH_SECRET ?? '').length < 32)
    warn('BETTER_AUTH_SECRET in .env is shorter than 32 characters; the api will refuse to start.')

  return env
}

const waitFor = async (what: string, ready: () => Promise<boolean>) => {
  const deadline = Date.now() + WAIT_MS
  while (!(await ready())) {
    if (Date.now() > deadline)
      fail(`${what} is not ready after ${WAIT_MS / 1000} s.`, `See: ${compose.join(' ')} logs`)
    await Bun.sleep(1000)
  }
  say(`${what} is ready`)
}

type ComposeRow = { State?: string; ExitCode?: number }

/** `docker compose ps --format json` prints one object per line, or an array on older versions. */
const initExited = async () => {
  const { stdout } = await run([...compose, 'ps', '-a', '--format', 'json', 'seaweedfs-init'])
  const rows = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => JSON.parse(line) as ComposeRow | ComposeRow[])

  return rows.some((row) => row.State === 'exited' && row.ExitCode === 0)
}

checkBun()
say('installing dependencies')
if ((await run(['bun', 'install'], true)).code !== 0) fail('bun install failed.')

const env = await ensureEnv()
await checkDocker()

say('starting Postgres, Redis and SeaweedFS (infra/compose.yml)')

if ((await run([...compose, 'up', '-d'], true)).code !== 0) {
  fail(
    'docker compose could not start the infra.',
    'If a port is taken, change POSTGRES_PORT, REDIS_PORT or S3_PORT and the URLs using them in .env.',
  )
}

await waitFor(
  'Postgres',
  async () =>
    (await run([...compose, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'subtick', '-q']))
      .code === 0,
)

await waitFor('Redis', async () =>
  (await run([...compose, 'exec', '-T', 'redis', 'redis-cli', 'ping'])).stdout.includes('PONG'),
)

await waitFor('SeaweedFS buckets', initExited)

say('running database migrations')
if ((await run(['bun', 'run', 'db:migrate'], true)).code !== 0) fail('Migrations failed.')

console.log(`
\x1b[32m✓\x1b[0m Ready.

  bun run dev      api, web app, parser and steam workers, restarting on changes
  open ${env.PUBLIC_URL ?? 'http://localhost:5173'}, sign up with any email and skip the Steam step
  bun run seed     downloads three sample demos (~420 MB, needs bzip2) and adds them for every user
  bun run --filter @subtick/api grant-admin <email>    makes that user an admin

Optional, in .env (README.md, "Configuration"):
  STEAM_API_KEY    Steam sign-in, player profiles and match-history sync
  STEAM_BOT_*      downloading the demos of newly found matches
A recorder turns highlights into clips (apps/recorder/README.md); the web app's dev menu fakes
recordings without one.
`)
