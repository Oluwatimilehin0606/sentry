import { fromNodeHeaders } from 'better-auth/node';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { auth } from '../auth.ts';
import {
  CONTACT_TOPICS,
  type ContactTopic,
  contactCopyEmail,
  contactInboxEmail,
} from '../email/contact.ts';
import { sendEmail } from '../email/mailer.ts';
import { env } from '../env.ts';

/**
 * "Contact us" (csentinel.com.ng/contact): emails the message to Sentry's inbox, with the sender as
 * Reply-to. Nothing is stored. Anyone can write; signed-in senders also get a copy (only them, so
 * the form can't be used to make Sentry email strangers). One per app, each with its own limit.
 */
export function contactRouter() {
  const router = Router();

  const Body = z.object({
    name: z.string().trim().min(1).max(80),
    email: z.email().max(254),
    topic: z.enum(Object.keys(CONTACT_TOPICS) as [ContactTopic, ...ContactTopic[]]),
    message: z.string().trim().min(10).max(2000),
    // A field people never see: only bots fill it in.
    website: z.string().max(200).optional(),
  });

  router.post(
    '/',
    rateLimit({
      windowMs: 60 * 60_000,
      limit: 3,
      // Only messages that were sent count, so fixing a typo doesn't use up the allowance.
      skipFailedRequests: true,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'You’ve sent 3 messages in the last hour. Please wait a little and try again.',
      },
    }),
    async (req, res) => {
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error:
              'Please fill in your name, a valid email and a message of at least 10 characters.',
          });
        return;
      }
      const { website, ...form } = parsed.data;
      // A bot filled in the hidden field: look successful, send nothing.
      if (website) {
        res.json({ sent: true, copy: false });
        return;
      }
      const inbox = env.CONTACT_EMAIL ?? env.DEMO_EMAIL;
      if (!inbox) {
        res.status(503).json({ error: 'Messages can’t be sent just now. Please try again later.' });
        return;
      }
      const session = await auth.api
        .getSession({ headers: fromNodeHeaders(req.headers) })
        .catch(() => null);
      const message = {
        ...form,
        account: session
          ? { email: session.user.email, createdAt: session.user.createdAt }
          : undefined,
        sentAt: new Date(),
        timeZone: env.APP_TIMEZONE,
      };
      const sent = await sendEmail({
        to: inbox,
        replyTo: `${form.name.replace(/[<>"]/g, '')} <${form.email}>`,
        ...contactInboxEmail(message),
      });
      if (!sent) {
        res
          .status(502)
          .json({ error: 'Your message couldn’t be sent just now. Please try again in a minute.' });
        return;
      }
      const copy = !!session && session.user.email.toLowerCase() === form.email.toLowerCase();
      if (copy) await sendEmail({ to: session!.user.email, ...contactCopyEmail(message) });
      res.json({ sent: true, copy });
    },
  );
  return router;
}
