import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { domains, scans } from '../db/schema.ts';
import { defaultDeveloperNote, developerEmail } from '../email/developer.ts';
import { sendEmail as defaultSend, type SendEmail } from '../email/mailer.ts';
import { env } from '../env.ts';
import { pdfFileName, reportPdf } from '../reports/pdf.ts';
import type { SavedReport } from '../scans/store.ts';

/** A new secret for the developer's "Don't send me reports" link. */
export const newStopToken = () => crypto.randomBytes(18).toString('base64url');

export const stopUrl = (token: string) => `${env.APP_URL}/stop-reports?token=${encodeURIComponent(token)}`;

export type SendToDeveloper = {
  owner: { name: string; email: string };
  developer: { name: string; email: string };
  report: SavedReport;
  /** The owner's note; the default one when left out (automatic sends). */
  note?: string;
  /** The website's stop token, when the developer is saved with the website. */
  stopToken?: string | null;
  copyToOwner?: boolean;
  send?: SendEmail;
};

/**
 * Emails the developer the report: the owner's note, the grade and problems, and the PDF.
 * Replies go to the owner. Records on the report who it went to, and when.
 */
export async function sendReportToDeveloper(s: SendToDeveloper): Promise<boolean> {
  const send = s.send ?? defaultSend;
  const problems = s.report.findings
    .filter((f) => f.status === 'fail')
    .map((f) => ({ title: f.title, severity: f.severity, evidence: f.evidence }));
  const email = developerEmail({
    ownerName: s.owner.name,
    ownerEmail: s.owner.email,
    developerName: s.developer.name,
    hostname: s.report.hostname,
    grade: s.report.grade,
    score: s.report.score,
    note: s.note?.trim() || defaultDeveloperNote(s.developer.name, s.report.hostname, problems.length),
    problems,
    stopUrl: s.stopToken ? stopUrl(s.stopToken) : undefined,
  });
  const attachments = [
    {
      filename: pdfFileName(s.report, env.APP_TIMEZONE),
      content: await reportPdf(s.report, { timeZone: env.APP_TIMEZONE }),
      contentType: 'application/pdf',
    },
  ];
  const sent = await send({ to: s.developer.email, replyTo: s.owner.email, ...email, attachments });
  if (!sent) return false;
  if (s.copyToOwner) await send({ to: s.owner.email, ...email, subject: `Copy: ${email.subject}`, attachments });
  await db
    .update(scans)
    .set({ developerSentAt: new Date(), developerSentTo: s.developer.email })
    .where(eq(scans.id, s.report.id));
  return true;
}

/** Saves (or changes) a website's developer, with a fresh stop link when the email changes. */
export async function saveDeveloper(
  domainId: string,
  current: { developerEmail: string | null; developerStopToken: string | null },
  developer: { name: string; email: string; autoSend: boolean },
) {
  const sameEmail = current.developerEmail?.toLowerCase() === developer.email.toLowerCase();
  const [row] = await db
    .update(domains)
    .set({
      developerName: developer.name,
      developerEmail: developer.email,
      developerAutoSend: developer.autoSend,
      developerStopToken: sameEmail && current.developerStopToken ? current.developerStopToken : newStopToken(),
    })
    .where(eq(domains.id, domainId))
    .returning();
  return row!;
}

/** Forgets a website's developer (the owner's "Remove", or the developer's own "Don't send me reports"). */
export async function clearDeveloper(domainId: string) {
  const [row] = await db
    .update(domains)
    .set({ developerName: null, developerEmail: null, developerAutoSend: false, developerStopToken: null })
    .where(eq(domains.id, domainId))
    .returning();
  return row!;
}
