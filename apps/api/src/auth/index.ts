import type { Db } from '@subtick/db'
import type { Mailer } from '@subtick/mail'
import { schema } from '@subtick/db'
import type { SteamWebApi } from '@subtick/steam'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Env } from '../env'
import { upsertSteamLink } from '../services/steam-links'
import { emailChange } from './email-plugin'
import { steam } from './steam-plugin'

export const createAuth = ({
  env,
  db,
  steamApi,
  mailer,
  beforeDeleteUser,
}: {
  env: Env
  db: Db
  steamApi: SteamWebApi
  mailer: Mailer
  /** Cleans up what doesn't cascade from the user row (uploaded pictures). */
  beforeDeleteUser: (userId: string) => Promise<void>
}) =>
  betterAuth({
    baseURL: env.PUBLIC_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.PUBLIC_URL],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    // Sign-up isn't verified by email; addresses are confirmed only when added or changed later.
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: {
      // Granted by another admin or `bun run grant-admin`, never at sign-up.
      additionalFields: { role: { type: 'string', defaultValue: 'user', input: false } },
      // From Settings. Without a password (Steam-only accounts have none) the session must be under
      // a day old; everything the user owns cascades from the user row.
      deleteUser: { enabled: true, beforeDelete: (user) => beforeDeleteUser(user.id) },
    },
    plugins: [
      steam({
        async getProfile(steamId) {
          const profile = await steamApi.getProfile(steamId)

          return profile && { name: profile.personaName, image: profile.avatarUrl }
        },
        onAccount: (userId, steamId) => upsertSteamLink({ db, steamApi }, userId, steamId),
      }),
      emailChange({ mailer }),
    ],
  })

export type Auth = ReturnType<typeof createAuth>
