import { mkdir, mkdtemp, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { isLink, removeTree } from '../src/setup/links'

test('removing a tree removes links as links, never what they point to', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'recorder-links-'))
  const target = join(dir, 'install')
  await mkdir(join(target, 'csgo'), { recursive: true })
  await Bun.write(join(target, 'csgo/keep.txt'), 'keep')
  const tree = join(dir, 'game')
  await mkdir(join(tree, 'bin'), { recursive: true })
  await Bun.write(join(tree, 'bin/copy.dll'), 'copy')
  await symlink(join(target, 'csgo'), join(tree, 'csgo'))

  expect(await isLink(join(tree, 'csgo'))).toBe(true)
  expect(await isLink(join(tree, 'bin'))).toBe(false)
  await removeTree(tree)
  expect(await readdir(dir)).toEqual(['install'])
  expect(await Bun.file(join(target, 'csgo/keep.txt')).text()).toBe('keep')
})
