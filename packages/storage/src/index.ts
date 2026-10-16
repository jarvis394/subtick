import { S3Client } from 'bun'

/** Object storage port. One instance per bucket. */
export interface ObjectStorage {
  put(key: string, data: Blob | Uint8Array | string | Response, contentType?: string): Promise<void>
  /** Downloads an object to a local file and returns its size in bytes. */
  download(key: string, path: string): Promise<number>
  exists(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  /** Short-lived GET URL for browsers and the recorder. */
  presign(key: string, expiresInSeconds?: number): string
}

export interface S3StorageOptions {
  endpoint: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

/** S3-compatible adapter (SeaweedFS S3 gateway in dev and self-hosted prod). */
export const createS3Storage = (options: S3StorageOptions): ObjectStorage => {
  const client = new S3Client(options)

  return {
    async put(key, data, contentType) {
      await client.write(key, data, contentType ? { type: contentType } : undefined)
    },
    download: (key, path) => Bun.write(path, client.file(key)),
    exists: (key) => client.exists(key),
    delete: (key) => client.delete(key),
    presign: (key, expiresIn = 3600) => client.presign(key, { expiresIn }),
  }
}

/** Canonical object keys, so every service agrees where artifacts live. */
export const keys = {
  demo: (matchId: string) => `${matchId}.dem.zst`,
  clip: (highlightId: string) => `${highlightId}.mp4`,
  thumbnail: (highlightId: string) => `${highlightId}.jpg`,
}
