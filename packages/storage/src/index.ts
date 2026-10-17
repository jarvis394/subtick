import { S3Client } from 'bun'

/** Object storage port. One instance per bucket. */
export interface ObjectStorage {
  put(key: string, data: Blob | Uint8Array | string | Response, contentType?: string): Promise<void>
  bytes(key: string): Promise<Uint8Array>
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

  return {
    async put(key, data, contentType) {
      await client.write(key, data, contentType ? { type: contentType } : undefined)
    },
    bytes: (key) => client.file(key).bytes(),
    exists: (key) => client.exists(key),
    delete: (key) => client.delete(key),
    presign: (key, expiresIn = 3600) => publicClient.presign(key, { expiresIn }),
  }
}

/** Canonical object keys, so every service agrees where artifacts live. */
export const keys = {
  demo: (matchId: string) => `${matchId}.dem.zst`,
  clip: (highlightId: string) => `${highlightId}.mp4`,
  thumbnail: (highlightId: string) => `${highlightId}.jpg`,
}
