import { env } from '../env.ts';

/** Emails about the account itself (confirm email, reset password, …), as approved in the security mockup. */
type AccountEmail = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there';

/** One short message: heading, a paragraph, an optional button, and small print. Same look as the alert email. */
function layout(o: { subject: string; heading: string; body: string; button?: { label: string; url: string }; small: string }): AccountEmail {
  const logoUrl = new URL('/email-logo.png', env.APP_URL).href;
  const text = [o.heading, '', o.body, ...(o.button ? ['', `${o.button.label}: ${o.button.url}`] : []), '', o.small].join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(o.subject)}</title></head>
<body style="margin:0;background:#F5F7FA;font-family:'Public Sans',Segoe UI,Arial,sans-serif;color:#111A2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 0 20px;font-size:21px;font-weight:700">
  <img src="${esc(logoUrl)}" width="32" height="32" alt="" style="display:inline-block;width:32px;height:32px;border:0;border-radius:8px;vertical-align:middle">&nbsp; Sentry
</td></tr>
<tr><td style="padding:0 0 14px;font-size:26px;line-height:1.2;font-weight:700">${esc(o.heading)}</td></tr>
<tr><td style="padding:0 0 20px;font-size:16px;line-height:1.55">${esc(o.body)}</td></tr>
${o.button ? `<tr><td style="padding:0 0 24px"><a href="${esc(o.button.url)}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#1F5FAD;color:#FFFFFF;font-weight:600;text-decoration:none">${esc(o.button.label)}</a></td></tr>` : ''}
<tr><td style="padding:16px 0 0;border-top:1px solid #D9E0EA;font-size:13px;color:#56637A">${esc(o.small)}</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject: o.subject, text, html };
}

export function confirmEmail(name: string, url: string): AccountEmail {
  return layout({
    subject: 'Confirm your email for Sentry',
    heading: `Hi ${firstName(name)}, confirm your email`,
    body: 'Click the button to confirm this is your email address. Sentry sends your website alerts here, so we want to be sure they reach you.',
    button: { label: 'Confirm my email', url },
    small: 'The link works for 24 hours. Didn’t sign up for Sentry? Ignore this email and no account will be set up.',
  });
}

export function resetPasswordEmail(url: string): AccountEmail {
  return layout({
    subject: 'Reset your Sentry password',
    heading: 'Choose a new password',
    body: 'Someone (we hope you) asked to reset the password for this Sentry account. Click the button to choose a new one.',
    button: { label: 'Choose a new password', url },
    small: 'The link works once, for 1 hour. Didn’t ask for this? Ignore this email; your password stays the same.',
  });
}

export function passwordChangedEmail(name: string): AccountEmail {
  return layout({
    subject: 'Your Sentry password was changed',
    heading: `Hi ${firstName(name)}, your password was changed`,
    body: 'The password for your Sentry account was just changed, and every other phone and computer was signed out.',
    button: { label: 'Open Sentry', url: `${env.APP_URL}/account` },
    small: 'Wasn’t you? Use “Forgot password?” on the sign-in page straight away to choose a new one.',
  });
}

/** Someone tried to sign up with an email that already has an account (they see "check your email" either way). */
export function alreadySignedUpEmail(name: string): AccountEmail {
  return layout({
    subject: 'You already have a Sentry account',
    heading: `Hi ${firstName(name)}, you already have an account`,
    body: 'Someone just tried to create a Sentry account with this email. If it was you, sign in instead, or choose a new password if you’ve forgotten it.',
    button: { label: 'Sign in', url: `${env.APP_URL}/sign-in` },
    small: 'Wasn’t you? Nothing has changed and you can ignore this email.',
  });
}
