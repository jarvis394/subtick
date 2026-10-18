/**
 * better-auth plugin: add an email to a Steam-only account, or change the sign-in email, through a
 * magic link sent to the new address.
 *
 *   POST /api/auth/email/change { email, password? } → { email }  (requires a session)
 *   GET  /api/auth/email/confirm?token=…                          ← the link in the email
 *
 * `password` is required when the account has none yet (signed up with Steam): it's hashed right
 * away and only becomes a credential account once the link is opened. Opening the link sets the
 * email at once, marks it verified and signs that browser in. It then lands on
 * `/settings?email=confirmed`, or `/settings?error=<code>` when the link can't be used.
 */
import { type Mailer, confirmEmailMail } from '@subtick/mail'
import type { BetterAuthPlugin } from 'better-auth'
import { APIError, createAuthEndpoint, getSessionFromCtx, sessionMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'

const TOKEN_PREFIX = 'email-change:'
const TOKEN_TTL_HOURS = 1
const CREDENTIAL_PROVIDER_ID = 'credential'

const Pending = z.object({
  userId: z.string(),
  email: z.string(),
  passwordHash: z.string().optional(),
})

const fail = (status: 'BAD_REQUEST' | 'CONFLICT' | 'BAD_GATEWAY', code: string) =>
  new APIError(status, { code, message: code })

export const emailChange = ({ mailer }: { mailer: Mailer }) =>
  ({
    id: 'email-change',
    endpoints: {
      requestEmailChange: createAuthEndpoint(
        '/email/change',
        {
          method: 'POST',
          body: z.object({
            email: z.email().trim().toLowerCase(),
            password: z.string().optional(),
          }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const { user } = ctx.context.session
          const { email, password } = ctx.body
          if (email === user.email.toLowerCase()) throw fail('BAD_REQUEST', 'email_unchanged')
          if (await ctx.context.internalAdapter.findUserByEmail(email)) {
            throw fail('CONFLICT', 'email_in_use')
          }

          const accounts = await ctx.context.internalAdapter.findAccounts(user.id)
          const hasPassword = accounts.some((a) => a.providerId === CREDENTIAL_PROVIDER_ID)
          let passwordHash: string | undefined
          if (!hasPassword) {
            const { minPasswordLength, maxPasswordLength } = ctx.context.password.config
            if (!password) throw fail('BAD_REQUEST', 'password_required')
            if (password.length < minPasswordLength) throw fail('BAD_REQUEST', 'password_too_short')
            if (password.length > maxPasswordLength) throw fail('BAD_REQUEST', 'password_too_long')
            passwordHash = await ctx.context.password.hash(password)
          }

          const token = crypto.randomUUID()
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: `${TOKEN_PREFIX}${token}`,
            value: JSON.stringify({ userId: user.id, email, passwordHash }),
            expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
          })

          const url = `${ctx.context.baseURL}/email/confirm?${new URLSearchParams({ token })}`
          try {
            await mailer.send(
              confirmEmailMail({
                to: email,
                url,
                adding: !hasPassword,
                expiresInHours: TOKEN_TTL_HOURS,
              }),
            )
          } catch (error) {
            ctx.context.logger.error('could not send the email confirmation', error)
            await ctx.context.internalAdapter.deleteVerificationByIdentifier(
              `${TOKEN_PREFIX}${token}`,
            )
            throw fail('BAD_GATEWAY', 'email_send_failed')
          }
          return ctx.json({ email })
        },
      ),

      confirmEmailChange: createAuthEndpoint(
        '/email/confirm',
        { method: 'GET', query: z.object({ token: z.string().default('') }) },
        async (ctx) => {
          const redirectError = (code: string): never => {
            throw ctx.redirect(`/settings?${new URLSearchParams({ error: code })}`)
          }
          const record = await ctx.context.internalAdapter.consumeVerificationValue(
            `${TOKEN_PREFIX}${ctx.query.token}`,
          )
          const parsed =
            record && record.expiresAt > new Date()
              ? Pending.safeParse(JSON.parse(record.value))
              : null
          if (!parsed?.success) return redirectError('email_link_invalid')
          const { userId, email, passwordHash } = parsed.data

          // Someone may have taken the address between the request and the click.
          const taken = await ctx.context.internalAdapter.findUserByEmail(email)
          if (taken && taken.user.id !== userId) return redirectError('email_in_use')

          const user = await ctx.context.internalAdapter.updateUser(userId, {
            email,
            emailVerified: true,
          })
          if (!user) return redirectError('email_link_invalid')

          if (passwordHash) {
            const accounts = await ctx.context.internalAdapter.findAccounts(userId)
            if (!accounts.some((a) => a.providerId === CREDENTIAL_PROVIDER_ID)) {
              await ctx.context.internalAdapter.linkAccount({
                providerId: CREDENTIAL_PROVIDER_ID,
                accountId: userId,
                userId,
                password: passwordHash,
              })
            }
          }

          // The link proves the address: let it sign in a browser that isn't (e.g. a phone).
          const current = await getSessionFromCtx(ctx)
          if (current?.user.id !== userId) {
            const session = await ctx.context.internalAdapter.createSession(userId)
            if (session) await setSessionCookie(ctx, { session, user })
          }
          throw ctx.redirect('/settings?email=confirmed')
        },
      ),
    },
    rateLimit: [{ pathMatcher: (path) => path === '/email/change', window: 60, max: 3 }],
  }) satisfies BetterAuthPlugin
