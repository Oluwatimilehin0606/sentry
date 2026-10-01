import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.ts';
import { logger } from '../logger.ts';

export type Email = { to: string; subject: string; text: string; html: string };
export type SendEmail = (email: Email) => Promise<boolean>;

let transport: Transporter | undefined;

/**
 * Sends one email. In development SMTP_URL points at the local test inbox, so nothing reaches a
 * real address. A failed send is logged, never thrown: an alert must not break a check.
 */
export const sendEmail: SendEmail = async (email) => {
  transport ??= nodemailer.createTransport(env.SMTP_URL);
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...email });
    logger.info({ subject: email.subject }, 'Alert email sent');
    return true;
  } catch (err) {
    logger.warn({ code: (err as NodeJS.ErrnoException).code }, 'Alert email could not be sent (is the mail server running?)');
    return false;
  }
};
