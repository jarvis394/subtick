import { describe, expect, test } from 'bun:test'
import { localPath, windowsPath } from '../src/platform'
import { resolveLayout } from '../src/layout'

describe.skipIf(process.platform === 'win32')('paths from WSL', () => {
  test('a WSL drive path as Windows sees it', () => {
    expect(windowsPath('/mnt/c/subtick/cs2')).toBe('C:\\subtick\\cs2')
    expect(windowsPath('/mnt/d')).toBe('D:\\')
    expect(() => windowsPath('/home/me')).toThrow()
  })

  test('a Windows path as WSL reaches it', () => {
    expect(localPath('C:\\subtick\\cs2')).toBe('/mnt/c/subtick/cs2')
    expect(localPath('d:/Games/')).toBe('/mnt/d/Games')
    expect(localPath('/mnt/c/subtick')).toBe('/mnt/c/subtick')
    expect(localPath('/cs2')).toBe('/cs2')
  })

  test('the Windows layout takes Windows paths from a config file', () => {
    const layout = resolveLayout({
      GAME_HOST: 'windows',
      WINDOWS_DIR: 'C:\\rec',
      WINEPREFIX: '/wine/pfx',
    })
    expect(layout).toMatchObject({
      root: '/mnt/c/rec',
      cs2Dir: '/mnt/c/rec/cs2',
      hlaeDir: '/mnt/c/rec/hlae',
    })
  })

  test('the container keeps its paths', () => {
    expect(resolveLayout({ WINEPREFIX: '/wine/pfx' })).toMatchObject({
      gameHost: 'wine',
      root: '/wine/pfx/drive_c',
      cs2Dir: '/cs2',
    })
  })
})
