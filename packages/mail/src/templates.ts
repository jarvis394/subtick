import type { Mail } from './index'

/** Gmail and Apple Mail turn addresses into underlined links; this keeps it plain blue. */
const address = (email: string) =>
  `<a href="mailto:${escape(email)}" style="color:#2974cf;text-decoration:none;font-weight:600">${escape(email)}</a>`

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

/** Email clients ignore stylesheets and dark-mode variables, so everything is inline. */
const layout = ({ heading, body, action }: { heading: string; body: string; action: Action }) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111111">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid rgba(17,17,17,0.09);border-radius:16px">
          <tr><td style="padding:32px">
            <p style="margin:0 0 28px;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:-0.02em">subtick<span style="color:#2974cf">.</span></p>
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:-0.01em">${heading}</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.55;color:#3d3d3d">${body}</p>
            <a href="${escape(action.url)}" style="display:inline-block;background:#111111;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:11px 20px;border-radius:10px">${action.label}</a>
            <p style="margin:28px 0 0;font-size:13px;line-height:1.55;color:#6b6b6b">Or paste this link into your browser:<br><a href="${escape(action.url)}" style="color:#6b6b6b;word-break:break-all">${escape(action.url)}</a></p>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#8f8f8f">If you didn't ask for this, ignore this email. Nothing changes until the link is opened.</p>
      </td></tr>
    </table>
  </body>
</html>`

interface Action {
  label: string
  url: string
}

/** Magic link that sets `email` as the sign-in address of the account that asked for it. */
export const confirmEmailMail = ({
  to,
  url,
  adding,
  expiresInHours,
}: {
  to: string
  url: string
  /** First email on a Steam-only account, rather than a change of address. */
  adding: boolean
  expiresInHours: number
}): Mail => {
  const heading = adding ? 'Confirm your email' : 'Confirm your new email'
  const what = adding
    ? `Open this link to sign in to subtick with ${address(to)} as well as Steam.`
    : `Open this link to change your subtick sign-in email to ${address(to)}.`
  const expires = `It works once and expires in ${expiresInHours} hour${expiresInHours === 1 ? '' : 's'}.`

  return {
    to,
    subject: adding ? 'Confirm your subtick email' : 'Confirm your new subtick email',
    html: layout({ heading, body: `${what} ${expires}`, action: { label: 'Confirm email', url } }),
    text: `${heading}\n\n${what.replace(/<[^>]+>/g, '')} ${expires}\n\n${url}\n\nIf you didn't ask for this, ignore this email.`,
  }
}
