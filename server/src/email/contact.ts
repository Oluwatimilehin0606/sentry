/** "Contact us" messages, as approved in the mockup: to Sentry's inbox (reply goes to the sender), and the sender's copy. */
export const CONTACT_TOPICS = {
  report: 'A question about my report',
  account: 'Help with my account',
  security: 'Report a security problem',
  other: 'Something else',
} as const;
export type ContactTopic = keyof typeof CONTACT_TOPICS;

export type ContactMessage = {
  name: string;
  email: string;
  topic: ContactTopic;
  message: string;
  /** The account, when the sender was signed in. */
  account?: { email: string; createdAt: Date };
  sentAt: Date;
  timeZone: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title: string, body: string, small: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F5F7FA;font-family:'Public Sans',Segoe UI,Arial,sans-serif;color:#111A2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:16px 18px;background:#FFFFFF;border:1px solid #D9E0EA;border-radius:10px;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(body)}</td></tr>
<tr><td style="padding:14px 0 0;font-size:13px;color:#56637A">${esc(small)}</td></tr>
</table></td></tr></table>
</body></html>`;
}

/** What arrives in Sentry's inbox. Press Reply to answer the sender. */
export function contactInboxEmail(m: ContactMessage): { subject: string; text: string; html: string } {
  const subject = `[Contact] ${CONTACT_TOPICS[m.topic]}: ${m.name}`;
  const when = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: m.timeZone,
  }).format(m.sentAt);
  const who = m.account
    ? `signed in as ${m.account.email} (account since ${m.account.createdAt.toISOString().slice(0, 10)})`
    : 'not signed in';
  const small = `Sent from csentinel.com.ng/contact by ${m.name} <${m.email}> · ${who} · ${when}`;
  return { subject, text: `${m.message}\n\n${small}`, html: page(subject, m.message, small) };
}

/** The sender's copy (only for signed-in senders, so the form can't be used to email strangers). */
export function contactCopyEmail(m: ContactMessage): { subject: string; text: string; html: string } {
  const subject = 'We got your message';
  const small = `You sent this to Sentry (${CONTACT_TOPICS[m.topic]}). We usually reply within 2 working days, to this address.`;
  return { subject, text: `${m.message}\n\n${small}`, html: page(subject, m.message, small) };
}
