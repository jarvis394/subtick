import { createLogger } from '@subtick/logger'

export interface Mail {
  to: string
  subject: string
  html: string
  text: string
}

export interface Mailer {
  send(mail: Mail): Promise<void>
}

/**
 * Sends through Resend (https://resend.com/docs/api-reference/emails/send-email) when an api key
 * is set. Without one, mail is only logged, so local development needs no account: copy the link
 * from the api's output.
 */
export const createMailer = ({ apiKey, from }: { apiKey?: string; from: string }): Mailer =>
  apiKey ? createResendMailer(apiKey, from) : createLogMailer()

const createResendMailer = (apiKey: string, from: string): Mailer => ({
  async send(mail) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, ...mail }),
    })
    if (!response.ok) {
      throw new Error(`Resend answered ${response.status}: ${await response.text()}`)
    }
  },
})

const createLogMailer = (): Mailer => {
  const log = createLogger('mail')
  return {
    async send(mail) {
      log.info(
        { to: mail.to, subject: mail.subject },
        `mail not sent (no RESEND_API_KEY)\n${mail.text}`,
      )
    },
  }
}

export * from './templates'
