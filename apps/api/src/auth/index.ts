import type { Db } from '@subtick/db'
import { schema } from '@subtick/db'
import type { SteamWebApi } from '@subtick/steam'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Env } from '../env'
import { upsertSteamLink } from '../services/steam-links'
import { steam } from './steam-plugin'

export const createAuth = ({ env, db, steamApi }: { env: Env; db: Db; steamApi: SteamWebApi }) =>
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
    // No mail server: accounts are not verified by email and there is no password reset by mail.
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    plugins: [
      steam({
        async getProfile(steamId) {
          const profile = await steamApi.getProfile(steamId)
          return profile && { name: profile.personaName, image: profile.avatarUrl }
        },
        onAccount: (userId, steamId) => upsertSteamLink({ db, steamApi }, userId, steamId),
      }),
    ],
  })

export type Auth = ReturnType<typeof createAuth>
