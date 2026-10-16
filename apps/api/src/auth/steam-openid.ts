/**
 * Steam sign-in is OpenID 2.0 (not OAuth): Steam redirects back with a signed assertion, and we
 * ask Steam to confirm it with a `check_authentication` request.
 */
import { isSteamId } from '@subtick/domain'

const OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login'
const OPENID_NS = 'http://specs.openid.net/auth/2.0'
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select'
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/

export const steamLoginUrl = (returnTo: string) =>
  `${OPENID_ENDPOINT}?${new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': new URL(returnTo).origin,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  })}`

/** Returns the verified steamId64, or null if the assertion is invalid or not for `returnTo`. */
export const verifySteamAssertion = async (
  params: Record<string, string>,
  returnTo: string,
): Promise<string | null> => {
  if (params['openid.mode'] !== 'id_res') return null
  if (params['openid.op_endpoint'] !== OPENID_ENDPOINT) return null
  if (params['openid.return_to'] !== returnTo) return null

  const steamId = CLAIMED_ID_RE.exec(params['openid.claimed_id'] ?? '')?.[1]
  if (
    !steamId ||
    !isSteamId(steamId) ||
    params['openid.identity'] !== params['openid.claimed_id']
  ) {
    return null
  }

  const body = new URLSearchParams(
    Object.entries(params).filter(([key]) => key.startsWith('openid.')),
  )
  body.set('openid.mode', 'check_authentication')
  const response = await fetch(OPENID_ENDPOINT, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(10_000),
  })
  const text = await response.text()
  return response.ok && /^is_valid\s*:\s*true$/m.test(text) ? steamId : null
}
