import pins from '../../pins.json'
import { runProgram } from '../platform'
import { VERSION, isCompiled, self } from '../self'
import {
  CHECKSUMS,
  RELEASES_URL,
  type Release,
  assetName,
  compareVersions,
  latestRelease,
  parseChecksums,
  replaceExecutable,
  verifyChecksum,
} from '../update'

const GITHUB_HEADERS = { accept: 'application/vnd.github+json', 'user-agent': 'subtick-recorder' }

const fetchBytes = async (url: string) => {
  const response = await fetch(url, { headers: { 'user-agent': 'subtick-recorder' } })
  if (!response.ok) throw new Error(`download failed: ${url}: HTTP ${response.status}`)

  return response.bytes()
}

/** Replaces this executable with the newest release from GitHub; `check` only says if there is one. */
export const update = async ({ check = false }) => {
  if (!isCompiled) {
    console.error('update replaces the compiled executable; from source, pull the repo instead.')

    return 1
  }
  if (await Bun.file('/.dockerenv').exists()) {
    console.error('In Docker, pull the new image instead (see the README).')

    return 1
  }
  const asset = assetName()
  if (!asset) {
    console.error(`No recorder build for ${process.platform}-${process.arch}.`)

    return 1
  }

  const response = await fetch(RELEASES_URL, { headers: GITHUB_HEADERS })
  if (!response.ok) throw new Error(`GitHub releases: HTTP ${response.status}`)
  const latest = latestRelease((await response.json()) as Release[], asset)
  if (!latest || compareVersions(latest.version, VERSION) <= 0) {
    console.log(`${VERSION} is the newest release.`)

    return 0
  }
  if (check) {
    console.log(`${latest.version} is available (this is ${VERSION}): run \`${self} update\`.`)

    return 0
  }

  const url = (name: string) =>
    latest.release.assets.find((a) => a.name === name)!.browser_download_url

  console.log(`downloading ${latest.version}`)
  const [bytes, sums] = await Promise.all([fetchBytes(url(asset)), fetchBytes(url(CHECKSUMS))])
  verifyChecksum(bytes, parseChecksums(new TextDecoder().decode(sums)), asset)
  await replaceExecutable(process.execPath, bytes)
  console.log(`updated ${VERSION} -> ${latest.version}`)

  const next = await runProgram([process.execPath, 'version', '--json'])
  const nextPins = next.code === 0 ? (JSON.parse(next.stdout) as { pins: unknown }).pins : null
  if (JSON.stringify(nextPins) !== JSON.stringify(pins))
    console.log(`This release installs other game-side files: run \`${self} setup\` again.`)
  console.log('Restart a running recorder to use it.')

  return 0
}
