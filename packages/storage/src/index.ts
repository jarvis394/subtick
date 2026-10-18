import { S3Client } from 'bun'

/** Object storage port. One instance per bucket. */
export interface ObjectStorage {
  put(key: string, data: Blob | Uint8Array | string | Response, contentType?: string): Promise<void>
  bytes(key: string): Promise<Uint8Array>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  /** Short-lived GET URL for browsers and the recorder. */
  presign(key: string, expiresInSeconds?: number): string
  /** Every object in the bucket, a page at a time. */
  objects(): AsyncIterable<{ key: string; size: number }>
}

export interface S3StorageOptions {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  /** Origin browsers reach the S3 gateway at, when it differs from `endpoint`. Used for presigned URLs. */
  publicEndpoint?: string
}

/** S3-compatible adapter (SeaweedFS S3 gateway in dev and self-hosted prod). */
export const createS3Storage = ({
  publicEndpoint,
  ...options
}: S3StorageOptions): ObjectStorage => {
  const client = new S3Client(options)
  // A presigned URL signs its host, so it has to be made for the origin the browser will request.
  const publicClient = publicEndpoint
    ? new S3Client({ ...options, endpoint: publicEndpoint })
    : client
  // Each signing stamps the current time, so a fresh URL every call would miss the browser cache
  // and re-download every poster whenever a list refetches. Reuse one while half its life remains.
  const signed = new Map<string, { url: string; renewAt: number }>()
  const presign = (key: string, expiresIn: number) => {
    const now = Date.now()
    const id = `${expiresIn}:${key}`
    const hit = signed.get(id)
    if (hit && hit.renewAt > now) return hit.url
    if (signed.size >= 10_000) for (const [k, v] of signed) if (v.renewAt <= now) signed.delete(k)
    const url = publicClient.presign(key, { expiresIn })
    signed.set(id, { url, renewAt: now + (expiresIn * 1000) / 2 })
    return url
  }

  return {
    async put(key, data, contentType) {
      await client.write(key, data, contentType ? { type: contentType } : undefined)
    },
    bytes: (key) => client.file(key).bytes(),
    exists: (key) => client.exists(key),
    delete: (key) => client.delete(key),
    presign: (key, expiresIn = 3600) => presign(key, expiresIn),
    async *objects() {
      let continuationToken: string | undefined
      do {
        const page = await client.list({ maxKeys: 1000, continuationToken })
        for (const { key, size } of page.contents ?? []) yield { key, size: size ?? 0 }
        continuationToken = page.isTruncated ? page.nextContinuationToken : undefined
      } while (continuationToken)
    },
  }
}

/** Canonical object keys, so every service agrees where artifacts live. */
export const keys = {
  demo: (matchId: string) => `${matchId}.dem.zst`,
  clip: (highlightId: string) => `${highlightId}.mp4`,
  thumbnail: (highlightId: string) => `${highlightId}.webp`,
}
