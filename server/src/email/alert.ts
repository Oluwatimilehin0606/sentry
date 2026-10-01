import type { Severity } from '../scanner/catalog.ts';

/** The "your website got worse" email, as approved in the Phase 7 mockup. */
export type AlertInput = {
  hostname: string;
  interval: 'weekly' | 'monthly';
  previous: { grade: string; score: number };
  current: { grade: string; score: number; scannedAt: string };
  appeared: { title: string; severity: Severity }[];
  reportUrl: string;
  settingsUrl: string;
  /** IANA time zone for the check time (e.g. Africa/Lagos). */
  timeZone: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const article = (grade: string) => (grade === 'A' || grade === 'F' ? 'an' : 'a');

// Light-theme colours from the design system (emails are read on white).
const GRADE_COLOUR: Record<string, string> = { A: '#1D7F47', B: '#4E8A25', C: '#9A7300', D: '#C0571A', F: '#C2322C' };
const PILL: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical: { bg: '#FBE9E8', fg: '#C2322C', label: 'Critical' },
  medium: { bg: '#FDF1DD', fg: '#8A5200', label: 'Medium' },
  low: { bg: '#ECEFF3', fg: '#56627A', label: 'Low' },
};

export function alertEmail(a: AlertInput): { subject: string; text: string; html: string } {
  const dropped = a.current.grade !== a.previous.grade;
  const subject = dropped
    ? `${a.hostname} dropped from ${article(a.previous.grade)} ${a.previous.grade} to ${article(a.current.grade)} ${a.current.grade}`
    : `${a.hostname} has a new problem to fix`;
  const period = a.interval === 'weekly' ? 'this week’s' : 'this month’s';
  const heading = `${a.hostname} got worse in ${period} check`;
  const checked = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: a.timeZone,
    timeZoneName: 'short',
  }).format(new Date(a.current.scannedAt));
  const newList = a.appeared.length ? a.appeared : [];

  const text = [
    heading,
    '',
    `${a.previous.grade} → ${a.current.grade} (${a.previous.score} → ${a.current.score} out of 100), checked ${checked}.`,
    ...(newList.length ? ['', 'New since the last check:', ...newList.map((p) => `- [${PILL[p.severity].label}] ${p.title}`)] : []),
    '',
    'This often happens after a website update or a change of host. The report explains each problem and how to fix it.',
    '',
    `See the full report: ${a.reportUrl}`,
    '',
    `You get this because automatic checks with email alerts are on for ${a.hostname}.`,
    `Turn off these emails: ${a.settingsUrl}`,
  ].join('\n');

  const pills = newList
    .map(
      (p) => `<tr><td style="padding:4px 0;font-size:15px;color:#111A2B">
        <span style="display:inline-block;padding:1px 8px;border-radius:99px;background:${PILL[p.severity].bg};color:${PILL[p.severity].fg};font-size:12px;font-weight:700">${PILL[p.severity].label}</span>
        &nbsp;${esc(p.title)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#F5F7FA;font-family:'Public Sans',Segoe UI,Arial,sans-serif;color:#111A2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 0 20px;font-size:20px;font-weight:700">
  <span style="display:inline-block;width:28px;height:28px;border-radius:7px;background:#1F5FAD;vertical-align:middle"></span>&nbsp; Sentry
</td></tr>
<tr><td style="padding:0 0 16px;font-size:26px;line-height:1.2;font-weight:700">${esc(heading)}</td></tr>
<tr><td style="padding:16px 18px;background:#FFFFFF;border:1px solid #D9E0EA;border-radius:12px">
  <span style="font-size:30px;font-weight:700;color:${GRADE_COLOUR[a.previous.grade] ?? '#111A2B'}">${esc(a.previous.grade)}</span>
  <span style="font-size:22px;color:#56637A">&nbsp;→&nbsp;</span>
  <span style="font-size:30px;font-weight:700;color:${GRADE_COLOUR[a.current.grade] ?? '#111A2B'}">${esc(a.current.grade)}</span>
  <span style="font-size:15px;color:#56637A">&nbsp;&nbsp;${a.previous.score} → ${a.current.score} out of 100 · checked ${esc(checked)}</span>
</td></tr>
${newList.length ? `<tr><td style="padding:20px 0 4px;font-weight:700">New since the last check:</td></tr><tr><td><table role="presentation" cellpadding="0" cellspacing="0">${pills}</table></td></tr>` : ''}
<tr><td style="padding:16px 0;font-size:15px;color:#56637A">This often happens after a website update or a change of host. The report explains each problem and how to fix it.</td></tr>
<tr><td style="padding:4px 0 24px"><a href="${esc(a.reportUrl)}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#1F5FAD;color:#FFFFFF;font-weight:600;text-decoration:none">See the full report</a></td></tr>
<tr><td style="padding:16px 0 0;border-top:1px solid #D9E0EA;font-size:13px;color:#56637A">
  You get this because automatic checks with email alerts are on for ${esc(a.hostname)}.
  <a href="${esc(a.settingsUrl)}" style="color:#1F5FAD">Turn off these emails</a>
</td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, text, html };
}
