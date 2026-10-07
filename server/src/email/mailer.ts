import fs from 'node:fs';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.ts';
import { logger } from '../logger.ts';

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Where replies go (e.g. the owner who sent their developer a report, or a contact form's sender). */
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};
export type SendEmail = (email: Email) => Promise<boolean>;

let transport: Transporter | undefined;

/**
 * Emails "sent" while testing: kept here (unit tests) or, for the browser test, added to the file
 * in TEST_OUTBOX_FILE, one JSON line each. Tests never use a mail server.
 */
export const testOutbox: Email[] = [];

/**
 * Sends one email. In development SMTP_URL points at the local test inbox, so nothing reaches a
 * real address. A failed send is logged, never thrown: an email must not break a check or a sign-up.
 */
export const sendEmail: SendEmail = async (email) => {
  if (env.NODE_ENV === 'test') {
    testOutbox.push(email);
    if (process.env.TEST_OUTBOX_FILE) fs.appendFileSync(process.env.TEST_OUTBOX_FILE, `${JSON.stringify(email)}\n`);
    return true;
  }
  transport ??= nodemailer.createTransport(env.SMTP_URL);
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...email });
    // The subject only: who it went to stays out of the logs.
    logger.info({ subject: email.subject }, 'Email sent');
    return true;
  } catch (err) {
    logger.warn({ code: (err as NodeJS.ErrnoException).code }, 'Email could not be sent (is the mail server running?)');
    return false;
  }
};
