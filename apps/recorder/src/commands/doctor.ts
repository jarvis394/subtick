import { configPath } from '../config-file'
import { doctorChecks } from '../doctor/checks'
import { loadGameEnv } from '../game-side'
import { resolveLayout } from '../layout'
import { VERSION } from '../self'

const LABEL = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' }

/** Checks the setup, the config and what the worker reaches, one line each. */
export const doctor = async (configFound: boolean) => {
  console.log(`subtick-recorder ${VERSION}`)
  console.log(`config: ${configPath()}${configFound ? '' : ' (none; only the environment)'}`)

  let env: ReturnType<typeof loadGameEnv>
  try {
    env = loadGameEnv()
  } catch (error) {
    console.log(`FAIL  settings: ${(error as Error).message}`)

    return 1
  }
  const layout = resolveLayout(env)
  console.log(`game: ${layout.gameHost === 'windows' ? 'Windows' : 'Wine'}, ${layout.root}`)

  const checks = doctorChecks(layout, { ...process.env, HLAE_POV: env.HLAE_POV })
  const results = await Promise.all(
    checks.map(async (check) => ({
      name: check.name,
      ...(await check.run().catch((error: Error) => ({
        status: 'fail' as const,
        detail: error.message,
        fix: undefined,
      }))),
    })),
  )
  const width = Math.max(...results.map((r) => r.name.length))
  for (const { name, status, detail, fix } of results) {
    console.log(`${LABEL[status]}  ${name.padEnd(width)}  ${detail}`)
    if (fix && status !== 'ok')
      console.log(`${' '.repeat(width + 8)}${fix.replaceAll('\n', `\n${' '.repeat(width + 8)}`)}`)
  }

  return results.some((r) => r.status === 'fail') ? 1 : 0
}
