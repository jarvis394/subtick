import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { ensureConfigFile, loadConfigFile, setConfigValues } from '../src/config-file'

const env: Record<string, string | undefined> = process.env
const read = (key: string) => env[key]

describe('config file', () => {
  test('is created once, with Windows paths kept as written', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'recorder-config-')), 'recorder.env')
    expect(await ensureConfigFile(path, { WINDOWS_DIR: 'C:\\subtick' })).toBe(true)
    expect(await ensureConfigFile(path, { WINDOWS_DIR: 'D:\\other' })).toBe(false)

    delete env.WINDOWS_DIR
    env.RECORD_FPS = '30'
    await loadConfigFile(path)
    expect(read('WINDOWS_DIR')).toBe('C:\\subtick')
    // The environment wins over the file.
    expect(read('RECORD_FPS')).toBe('30')
    delete env.WINDOWS_DIR
    delete env.RECORD_FPS
  })

  test('an empty value counts as unset', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'recorder-config-')), 'recorder.env')
    await Bun.write(path, 'SUBTICK_TEST_EMPTY=\n')
    await loadConfigFile(path)
    expect(read('SUBTICK_TEST_EMPTY')).toBeUndefined()
  })

  test('sets values without touching other lines', async () => {
    const path = join(await mkdtemp(join(tmpdir(), 'recorder-config-')), 'recorder.env')
    await Bun.write(path, '# note\nRECORDER_TOKEN=strec_secret\nWINDOWS_DIR=C:\\a\n')
    await setConfigValues(path, { WINDOWS_DIR: 'D:\\b', GAME_HOST: 'windows' })
    expect(await Bun.file(path).text()).toBe(
      '# note\nRECORDER_TOKEN=strec_secret\nWINDOWS_DIR=D:\\b\nGAME_HOST=windows\n',
    )
  })
})
