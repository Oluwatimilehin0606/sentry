import { env } from '../env.ts';
import type { Severity } from '../scanner/catalog.ts';

/** The "Send to my developer" email, as approved in the mockup: owner's note, grade, problems, PDF attached. */
export type DeveloperEmailInput = {
  ownerName: string;
  ownerEmail: string;
  developerName: string;
  hostname: string;
  grade: string;
  score: number;
  note: string;
  problems: { title: string; severity: Severity; evidence?: string }[];
  /** "Don't send me reports for this website" (only when the website is saved with a developer). */
  stopUrl?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'Someone';
const article = (grade: string) => (grade === 'A' || grade === 'F' ? 'an' : 'a');
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const GRADE_COLOUR: Record<string, string> = { A: '#1D7F47', B: '#4E8A25', C: '#9A7300', D: '#C0571A', F: '#C2322C' };
const PILL: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical: { bg: '#FBE9E8', fg: '#C2322C', label: 'Critical' },
  medium: { bg: '#FDF1DD', fg: '#8A5200', label: 'Medium' },
  low: { bg: '#ECEFF3', fg: '#56627A', label: 'Low' },
};

/** The note the owner starts from (they can change it before sending). */
export function defaultDeveloperNote(developerName: string, hostname: string, problems: number): string {
  const hi = `Hi ${firstName(developerName)},`;
  return problems === 0
    ? `${hi} Sentry checked ${hostname} and found no problems. The report is attached for your records.`
    : `${hi} Sentry found ${plural(problems, 'security problem', 'security problems')} on ${hostname}. Could you fix ${problems === 1 ? 'it' : 'them, starting with the first one'}? The full report is attached.`;
}

export function developerEmail(d: DeveloperEmailInput): { subject: string; text: string; html: string } {
  const owner = firstName(d.ownerName);
  const n = d.problems.length;
  const subject =
    n === 0
      ? `${owner} shared a Sentry report for ${d.hostname}`
      : `${owner} asked you to fix ${plural(n, 'security problem', 'security problems')} on ${d.hostname}`;
  const heading = `${d.hostname} scored ${article(d.grade)} ${d.grade} (${d.score}/100)`;
  const after =
    n === 0
      ? 'The attached PDF has the full report.'
      : `The attached PDF explains each problem and how to fix it, with the technical evidence. When you’ve fixed ${n === 1 ? 'it' : 'them'}, ${owner} can run a new check to confirm.`;
  const small = `${d.ownerName} (${d.ownerEmail}) sent you this with Sentry, a security check-up for small business websites. Reply to reach ${owner}.`;

  const text = [
    `${owner}’s note: ${d.note}`,
    '',
    heading,
    ...(n ? ['', ...d.problems.map((p) => `- [${PILL[p.severity].label}] ${p.title}${p.evidence ? ` (${p.evidence})` : ''}`)] : []),
    '',
    after,
    '',
    small,
    ...(d.stopUrl ? [`Don’t send me reports for ${d.hostname}: ${d.stopUrl}`] : []),
  ].join('\n');

  const rows = d.problems
    .map(
      (p) => `<tr><td style="padding:4px 0;font-size:15px;color:#111A2B">
        <span style="display:inline-block;padding:1px 8px;border-radius:99px;background:${PILL[p.severity].bg};color:${PILL[p.severity].fg};font-size:12px;font-weight:700">${PILL[p.severity].label}</span>
        &nbsp;${esc(p.title)}${p.evidence ? ` <span style="color:#56637A;font-size:13px">· ${esc(p.evidence)}</span>` : ''}</td></tr>`,
    )
    .join('');
  const logoUrl = new URL('/email-logo.png', env.APP_URL).href;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#F5F7FA;font-family:'Public Sans',Segoe UI,Arial,sans-serif;color:#111A2B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 0 20px;font-size:21px;font-weight:700">
  <img src="${esc(logoUrl)}" width="32" height="32" alt="" style="display:inline-block;width:32px;height:32px;border:0;border-radius:8px;vertical-align:middle">&nbsp; Sentry
</td></tr>
<tr><td style="padding:14px 18px;background:#FFFFFF;border:1px solid #D9E0EA;border-radius:10px;font-size:15px;line-height:1.55"><strong>${esc(owner)}’s note:</strong> ${esc(d.note)}</td></tr>
<tr><td style="padding:20px 0 10px;font-size:22px;line-height:1.25;font-weight:700"><span style="color:${GRADE_COLOUR[d.grade] ?? '#111A2B'}">${esc(heading)}</span></td></tr>
${n ? `<tr><td><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table></td></tr>` : ''}
<tr><td style="padding:16px 0 24px;font-size:15px;line-height:1.55">${esc(after)}</td></tr>
<tr><td style="padding:16px 0 0;border-top:1px solid #D9E0EA;font-size:13px;color:#56637A">${esc(small)}${
    d.stopUrl ? ` <a href="${esc(d.stopUrl)}" style="color:#1F5FAD">Don’t send me reports for ${esc(d.hostname)}</a>` : ''
  }</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject, text, html };
}
