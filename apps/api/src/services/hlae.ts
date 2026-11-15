import { HLAE_BUILD_PATTERNS, type HlaeBuild } from '@subtick/domain'

const UPSTREAM = 'advancedfx/advancedfx'
const FORK = 'WangChuDi/advancedfx'
/** GitHub allows 60 unauthenticated calls an hour; one lookup makes up to a dozen. */
const CACHE_MS = 30 * 60_000

interface Release {
  tag_name: string
  prerelease: boolean
  draft: boolean
  published_at: string
  target_commitish: string
  assets: { name: string; digest?: string | null }[]
}

let cached: { at: number; build: Promise<HlaeBuild & { publishedAt: string }> } | undefined

const github = async <T>(path: string) => {
  const res = await fetch(`https://api.github.com/repos/${path}`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'subtick' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`GitHub answered ${res.status} for ${path}`)

  return (await res.json()) as T
}

/** The fork's tags end in the commit they were built from: `prerelease-103-<sha>`. */
const forkCommit = (release: Release) =>
  release.tag_name.match(/([0-9a-f]{40})$/)?.[1] ?? release.target_commitish

/**
 * The newest mirv_pov fork build and the newest HLAE release it contains: the fork is a DLL laid
 * over a full HLAE install, so the two must match.
 */
const lookup = async () => {
  const upstream = (await github<Release[]>(`${UPSTREAM}/releases?per_page=10`)).filter(
    (r) => !r.prerelease && !r.draft,
  )
  const fork = (await github<Release[]>(`${FORK}/releases?per_page=5`)).find((r) =>
    r.assets.some((a) => a.name.endsWith('-windows-x64.zip')),
  )
  if (!fork) throw new Error('the mirv_pov fork has no Windows build')

  const asset = fork.assets.find((a) => a.name.endsWith('-windows-x64.zip'))!
  const sha256 = asset.digest?.match(/^sha256:([0-9a-f]{64})$/)?.[1]
  if (!sha256) throw new Error(`GitHub gave no sha256 for ${asset.name}`)

  for (const release of upstream.slice(0, 5)) {
    // oxlint-disable-next-line no-await-in-loop -- newest first, stop at the first match: rate limit
    const { behind_by } = await github<{ behind_by: number }>(
      `${FORK}/compare/${UPSTREAM.replace('/', ':')}:${release.tag_name}...${forkCommit(fork)}`,
    ).catch(() => ({ behind_by: -1 }))
    if (behind_by !== 0) continue

    const build = {
      hlae: release.tag_name.replace(/^v/, ''),
      povRelease: fork.tag_name,
      povAsset: asset.name,
      povSha256: sha256,
    }
    const valid = Object.entries(HLAE_BUILD_PATTERNS).every(([key, pattern]) =>
      pattern.test(build[key as keyof HlaeBuild]),
    )
    if (!valid) throw new Error(`unexpected release names: ${JSON.stringify(build)}`)

    return { ...build, publishedAt: fork.published_at }
  }
  throw new Error(`${fork.tag_name} isn't built on any recent HLAE release`)
}

/** The latest HLAE build recorders can install, cached; a failed lookup isn't. */
export const latestHlaeBuild = () => {
  if (!cached || Date.now() - cached.at > CACHE_MS) {
    const build = lookup()
    cached = { at: Date.now(), build }
    build.catch(() => (cached = undefined))
  }

  return cached.build
}
