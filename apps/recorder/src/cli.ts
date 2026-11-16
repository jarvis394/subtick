/**
 * subtick-recorder: one program for installing, checking, running and updating a recorder. Built
 * into an executable by `scripts/compile.ts`; from source, `bun apps/recorder/src/cli.ts <command>`.
 */
import { parseArgs } from 'node:util'
import pins from '../pins.json'
import { configPath, loadConfigFile } from './config-file'
import { VERSION, isCompiled, self } from './self'
import { removeOldExecutable } from './update'

const USAGE = `subtick-recorder ${VERSION}: turns CS2 highlights into clips for subtick.

  ${self} setup [--dir <folder>] [--cs2-install <folder>]
                     install HLAE, the Steam emulator and the game folder (Windows); rerun after a CS2 update
  ${self} doctor     check the install, the config and the connections
  ${self} run        take recording jobs
  ${self} smoke <demo.dem> [tick] [player]
                     record two test clips from a demo, without subtick
  ${self} update [--check]
                     replace this executable with the newest release
  ${self} version [--json]

Settings: ${configPath()}
(SUBTICK_RECORDER_CONFIG names another file; environment variables override it.)`

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    dir: { type: 'string' },
    'cs2-install': { type: 'string' },
    check: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
})

const [command, ...args] = positionals

if (isCompiled) await removeOldExecutable(process.execPath)
const configFound = await loadConfigFile()

const main = async () => {
  switch (command) {
    case 'setup': {
      const { setup } = await import('./commands/setup')

      return setup({ dir: values.dir, cs2Install: values['cs2-install'] })
    }
    case 'doctor': {
      const { doctor } = await import('./commands/doctor')

      return doctor(configFound)
    }
    case 'run':
      await import('./main')

      return null
    case 'smoke': {
      const { smoke } = await import('./commands/smoke')
      if (!args[0]) break

      return smoke(args[0], args[1], args[2])
    }
    case 'update': {
      const { update } = await import('./commands/update')

      return update({ check: values.check })
    }
    case 'version':
      console.log(values.json ? JSON.stringify({ version: VERSION, pins }) : VERSION)

      return 0
    default:
      if (command && !values.help) console.error(`unknown command: ${command}\n`)
  }
  console.log(USAGE)

  return command && !values.help ? 2 : 0
}

const code = await main().catch((error: Error) => {
  console.error(`error: ${error.message}`)

  return 1
})

// `run` keeps going until it's stopped; everything else exits, whatever it left open.
if (code !== null) process.exit(code)
