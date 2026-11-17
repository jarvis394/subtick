import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { configHome } from './platform'

/** `%LOCALAPPDATA%\subtick-recorder\recorder.env`, `~/.config/subtick-recorder/recorder.env`. */
export const configPath = () =>
  process.env.SUBTICK_RECORDER_CONFIG || join(configHome(), 'recorder.env')

/** Fills in what the environment doesn't set from the config file, if there is one. Empty is unset. */
export const loadConfigFile = async (path = configPath()) => {
  const file = Bun.file(path)
  if (!(await file.exists())) return false
  for (const [key, value] of Object.entries(parseEnv(await file.text())))
    if (!process.env[key] && value !== '') process.env[key] = value

  return true
}

const TEMPLATE = (
  values: Record<string, string>,
) => `# subtick recorder settings. Real environment variables override these.

# The instance (its PUBLIC_URL) and this machine's token, from subtick:
# Manage instance -> Recorders -> Add recorder. The token is shown once.
SUBTICK_URL=
RECORDER_TOKEN=

# The instance's Redis, where jobs come from. Reach it over an SSH tunnel or a private network,
# e.g. redis://:password@127.0.0.1:6379 with \`ssh -L 6379:127.0.0.1:6379 your-server\`.
REDIS_URL=

${Object.entries(values)
  .map(([key, value]) => `${key}=${value}`)
  .join('\n')}

# 1: clips show the recorded player's own HUD (rerun setup after changing it).
HLAE_POV=${process.env.HLAE_POV === '1' ? 1 : 0}

# Capture size and rate.
RECORD_WIDTH=1280
RECORD_HEIGHT=720
RECORD_FPS=60
`

/** Writes the config file with placeholders when there is none; true when it did. */
export const ensureConfigFile = async (path: string, values: Record<string, string>) => {
  if (await Bun.file(path).exists()) return false
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, TEMPLATE(values))

  return true
}

/** Sets `values` in an existing config file, leaving every other line as it is. */
export const setConfigValues = async (path: string, values: Record<string, string>) => {
  const lines = (await Bun.file(path).text()).split(/\r?\n/)
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`))
    if (index === -1) lines.splice(lines.at(-1) === '' ? -1 : lines.length, 0, `${key}=${value}`)
    else lines[index] = `${key}=${value}`
  }
  await Bun.write(path, lines.join('\n'))
}
