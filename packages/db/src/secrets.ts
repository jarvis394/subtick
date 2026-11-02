/**
 * AES-256-GCM for secrets stored in columns (match history auth codes).
 * Format: base64(iv ‖ ciphertext+tag). The key is 32 random bytes, base64-encoded.
 */
const IV_BYTES = 12

export const createSecretBox = async (keyBase64: string) => {
  const raw = Buffer.from(keyBase64, 'base64')
  if (raw.length !== 32) throw new Error('SECRETS_KEY must be 32 bytes, base64-encoded')
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])

  return {
    async encrypt(plaintext: string) {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
      const data = new TextEncoder().encode(plaintext)
      const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))

      return Buffer.concat([iv, sealed]).toString('base64')
    },
    async decrypt(box: string) {
      const bytes = Buffer.from(box, 'base64')
      const iv = bytes.subarray(0, IV_BYTES)
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        bytes.subarray(IV_BYTES),
      )

      return new TextDecoder().decode(plain)
    },
  }
}

export type SecretBox = Awaited<ReturnType<typeof createSecretBox>>
