import type { Db } from '@subtick/db'
import type { createLogger } from '@subtick/logger'
import { type Mailer, verifyEmailMail } from '@subtick/mail'
import { schema } from '@subtick/db'
import type { SteamWebApi } from '@subtick/steam'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { multiSession } from 'better-auth/plugins'
import type { Env } from '../env'
import { accounts } from './accounts-plugin'
import { upsertSteamLink } from '../services/steam-links'
import { emailChange } from './email-plugin'
import { steam } from './steam-plugin'

/** Accounts one browser can be signed in to at once. */
export const MAX_ACCOUNTS = 5

export const createAuth = ({
  env,
  db,
  steamApi,
  mailer,
  log,
  beforeDeleteUser,
}: {
  env: Env
  db: Db
  steamApi: SteamWebApi
  mailer: Mailer
  log: ReturnType<typeof createLogger>
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
    // Email sign-up confirms the address first; the link signs the browser in. Either way an admin
    // then approves the account (`approvedAt`).
    emailAndPassword: { enabled: true, minPasswordLength: 8, requireEmailVerification: true },
    emailVerification: {
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      // The user row exists by now: a throw would answer the sign-up with an error for an account
      // that was made. Signing in sends a new link.
      sendVerificationEmail: async ({ user, url }) => {
        await mailer
          .send(verifyEmailMail({ to: user.email, url }))
          .catch((error) => log.warn({ userId: user.id }, 'verification mail not sent', error))
      },
    },
    user: {
      // Granted by another admin or `bun run grant-admin`, never at sign-up.
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
        approvedAt: { type: 'date', required: false, input: false },
      },
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
      // Several accounts signed in at once in one browser; the account menu switches between them.
      multiSession({ maximumSessions: MAX_ACCOUNTS }),
      accounts(),
    ],
  })

export type Auth = ReturnType<typeof createAuth>
