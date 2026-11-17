/** Sign-up is invite-only: an account waits for approval, except admins, who never wait. */
export const isApproved = (user: { role?: string | null; approvedAt?: Date | null }) =>
  user.role === 'admin' || Boolean(user.approvedAt)

/** Steam has no email, but better-auth needs one: Steam sign-ups get `<steamId>` at this domain. */
export const STEAM_EMAIL_DOMAIN = '@steam.invalid'

export const isPlaceholderEmail = (email: string) => email.endsWith(STEAM_EMAIL_DOMAIN)
