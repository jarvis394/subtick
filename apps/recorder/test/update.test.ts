import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { sha256 } from '../src/setup/download'
import {
  type Release,
  assetName,
  compareVersions,
  latestRelease,
  parseChecksums,
  replaceExecutable,
  verifyChecksum,
} from '../src/update'

const release = (tag: string, assets: string[], extra: Partial<Release> = {}): Release => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  assets: assets.map((name) => ({ name, browser_download_url: `https://x/${tag}/${name}` })),
  ...extra,
})

const WIN = 'subtick-recorder-windows-x64.exe'

describe('self-update', () => {
  test('one asset per platform', () => {
    expect(assetName('win32', 'x64')).toBe(WIN)
    expect(assetName('linux', 'x64')).toBe('subtick-recorder-linux-x64')
    expect(assetName('darwin', 'arm64')).toBeNull()
  })

  test('versions compare numerically; dev builds are older than any release', () => {
    expect(compareVersions('1.10.0', '1.9.3')).toBeGreaterThan(0)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(compareVersions('0.0.0-dev', '0.0.1')).toBeLessThan(0)
  })

  test('picks the newest stable recorder release that has the asset and its checksums', () => {
    const releases = [
      release('v9.0.0', [WIN, 'SHA256SUMS']),
      release('recorder-v1.3.0', [WIN, 'SHA256SUMS'], { prerelease: true }),
      release('recorder-v1.2.0', ['subtick-recorder-linux-x64', 'SHA256SUMS']),
      release('recorder-v1.1.0', [WIN]),
      release('recorder-v1.0.10', [WIN, 'SHA256SUMS']),
      release('recorder-v1.0.9', [WIN, 'SHA256SUMS']),
    ]
    expect(latestRelease(releases, WIN)?.version).toBe('1.0.10')
    expect(latestRelease([], WIN)).toBeNull()
  })

  test('checks the download against SHA256SUMS', () => {
    const bytes = new TextEncoder().encode('binary')
    const sums = parseChecksums(`${sha256(bytes)}  ${WIN}\n${'0'.repeat(64)} *other\n`)
    expect(sums.get('other')).toBe('0'.repeat(64))
    expect(() => verifyChecksum(bytes, sums, WIN)).not.toThrow()
    expect(() => verifyChecksum(new TextEncoder().encode('tampered'), sums, WIN)).toThrow(/sha256/)
    expect(() => verifyChecksum(bytes, sums, 'missing')).toThrow(/lists no/)
  })

  test('swaps the executable and leaves nothing behind', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'recorder-update-'))
    const exe = join(dir, 'subtick-recorder')
    await Bun.write(exe, 'old')
    await replaceExecutable(exe, new TextEncoder().encode('new'))
    expect(await Bun.file(exe).text()).toBe('new')
    expect(await readdir(dir)).toEqual(['subtick-recorder'])
  })
})
