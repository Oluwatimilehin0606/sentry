import { createRequire } from 'node:module';
import {
  Document,
  Font,
  Page,
  Path,
  renderToBuffer,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';
import { createElement as h } from 'react';
import type { SavedReport } from '../scans/store.ts';

/**
 * A saved report as an A4 PDF, from the approved mockup (design canvas, "PDF report download"):
 * a cover page (grade, summary, counts, the three fixes to do first, what changed), then every
 * problem most serious first in the website's own plain-English wording, then what's already fine.
 * Light, and readable printed in black and white (severity is written as well as coloured).
 * Plain createElement (no JSX), because Node runs this TypeScript directly.
 */

const require = createRequire(import.meta.url);
const font = (pkg: string, file: string) => require.resolve(`@fontsource/${pkg}/files/${file}`);
// The website's own fonts, as .woff (the PDF library can't embed their .woff2 files). JetBrains
// Mono won't embed in either form, so technical details use Courier, which every PDF reader has.
Font.register({
  family: 'Public Sans',
  fonts: [
    { src: font('public-sans', 'public-sans-latin-400-normal.woff') },
    { src: font('public-sans', 'public-sans-latin-600-normal.woff'), fontWeight: 600 },
    { src: font('public-sans', 'public-sans-latin-700-normal.woff'), fontWeight: 700 },
  ],
});
Font.register({
  family: 'Bricolage',
  src: font('bricolage-grotesque', 'bricolage-grotesque-latin-700-normal.woff'),
});
// Break long words (website addresses, settings) anywhere rather than hyphenating them.
Font.registerHyphenationCallback((word) => [word]);

const INK = '#111A2B';
const SUB = '#56637A';
const LINE = '#D9E0EA';
const BLUE = '#1F5FAD';
const GRADE: Record<string, string> = {
  A: '#1D7F47',
  B: '#4E8A25',
  C: '#9A7300',
  D: '#C0571A',
  F: '#C2322C',
};
const SEVERITY = {
  critical: { label: 'Critical', text: '#C2322C', stripe: '#C2322C', pill: '#FBE9E8' },
  medium: { label: 'Medium', text: '#8A5200', stripe: '#B87A12', pill: '#FDF1DD' },
  low: { label: 'Low', text: '#56627A', stripe: '#8A96A8', pill: '#ECEFF3' },
} as const;

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 54,
    paddingHorizontal: 44,
    fontFamily: 'Public Sans',
    fontSize: 10,
    color: INK,
  },
  // Line spacing on the content, not the page: on the page it hides the footer (a library bug).
  // No lineHeight anywhere: on the page it hides the footer, and on views or text this library
  // multiplies it out of proportion. Its normal spacing reads well at these sizes.
  body: {},
  para: {},
  display: { fontFamily: 'Bricolage' },
  mono: { fontFamily: 'Courier', fontSize: 8.5 },
  sub: { color: SUB },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: LINE,
    fontSize: 8,
    color: SUB,
  },
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 99,
    fontSize: 9,
    fontWeight: 700,
  },
  box: { padding: 12, borderWidth: 1, borderColor: LINE, borderRadius: 8 },
});

// The bundled fonts cover Latin text and punctuation, but not arrows; evidence uses them.
const plain = (text: string) => text.replaceAll('→', '->');

/** The report with every piece of wording made safe for the bundled fonts. */
function fontSafe(report: SavedReport): SavedReport {
  return {
    ...report,
    summary: plain(report.summary),
    findings: report.findings.map((f) => ({
      ...f,
      title: plain(f.title),
      whatItIs: plain(f.whatItIs),
      whyItMatters: plain(f.whyItMatters),
      howToFix: plain(f.howToFix),
      forDeveloper: f.forDeveloper && plain(f.forDeveloper),
      evidence: f.evidence && plain(f.evidence),
    })),
  };
}

/** The approved shield on the blue tile. The S is drawn over the halves in the tile's blue. */
function LogoTile({ size }: { size: number }) {
  return h(
    View,
    {
      style: {
        width: size,
        height: size,
        borderRadius: size / 4,
        backgroundColor: BLUE,
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    h(
      Svg,
      { width: size * 0.66, height: size * 0.66, viewBox: '0 0 24 24' },
      h(Path, {
        d: 'M12 2.3 8.7 10.1 14 14.2 12 21.7C7.2 18.4 4.6 12.5 4.8 6.4Z',
        fill: '#FFFFFF',
      }),
      h(Path, {
        d: 'M12 2.3 19.2 6.4C19.4 12.5 16.8 18.4 12 21.7L14 14.2 8.7 10.1Z',
        fill: '#FFFFFF',
        fillOpacity: 0.5,
      }),
      h(Path, {
        d: 'M12 2.3 8.7 10.1 14 14.2 12 21.7',
        stroke: BLUE,
        strokeWidth: 1.2,
        fill: 'none',
      }),
    ),
  );
}

/** On every page. A plain element, not a component: the library dropped it as a component. */
const footer = h(
  View,
  { style: s.footer, fixed: true },
  h(Text, null, 'Sentry checks only what any visitor’s browser can see. csentinel.com.ng'),
  h(Text, {
    render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
      `Page ${pageNumber} of ${totalPages}`,
  }),
);

type Finding = SavedReport['findings'][number];

function Pill({ severity, n }: { severity: keyof typeof SEVERITY; n: number }) {
  const v = SEVERITY[severity];
  return h(
    Text,
    { style: [s.pill, { backgroundColor: v.pill, color: v.text }] },
    `${n} ${severity}`,
  );
}

function Part({ term, text }: { term: string; text: string }) {
  return h(Text, { style: s.para }, h(Text, { style: { fontWeight: 700 } }, `${term}. `), text);
}

/** One problem, never split across two pages. */
function Problem({ f, isNew }: { f: Finding; isNew: boolean }) {
  const v = SEVERITY[f.severity];
  return h(
    View,
    {
      wrap: false,
      style: [s.box, { borderLeftWidth: 4, borderLeftColor: v.stripe, marginBottom: 10, gap: 5 }],
    },
    h(
      Text,
      { style: { fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: v.text } },
      v.label.toUpperCase() + (isNew ? '  ·  NEW SINCE THE LAST CHECK' : ''),
    ),
    h(Text, { style: [s.display, { fontSize: 12.5 }] }, f.title),
    h(Part, { term: 'What it is', text: f.whatItIs }),
    h(Part, { term: 'Why it matters', text: f.whyItMatters }),
    h(Part, { term: 'How to fix it', text: f.howToFix }),
    f.forDeveloper &&
      h(
        View,
        { style: { padding: 7, backgroundColor: '#F5F7FA', borderRadius: 5, gap: 2 } },
        h(
          Text,
          { style: { fontSize: 7.5, fontWeight: 700, letterSpacing: 0.6, color: SUB } },
          'FOR YOUR DEVELOPER',
        ),
        h(Text, { style: s.mono }, plain(f.forDeveloper)),
      ),
    f.evidence && h(Text, { style: [s.mono, s.sub] }, plain(f.evidence)),
  );
}

function LightNote({ hostname }: { hostname: string }) {
  return h(
    View,
    { style: [s.box, { backgroundColor: '#F5F7FA', borderColor: '#F5F7FA' }] },
    h(Text, { style: { fontWeight: 700 } }, 'This was a light check'),
    h(
      Text,
      { style: [s.sub, s.para] },
      `Private files weren’t checked. Prove ${hostname} is yours in Sentry to get the full check, which also looks for settings files, backups and admin pages left public.`,
    ),
  );
}

export type PdfOptions = { timeZone: string };

/** The finished PDF, as bytes. */
export async function reportPdf(original: SavedReport, { timeZone }: PdfOptions): Promise<Buffer> {
  const report = fontSafe(original);
  const failed = report.findings.filter((f) => f.status === 'fail');
  const passed = report.findings.filter((f) => f.status === 'pass');
  const appeared = new Set<string>(report.changes?.appeared ?? []);
  const place = timeZone.split('/').at(-1)?.replaceAll('_', ' ');
  const when = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(report.scannedAt));
  const shortDate = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone }).format(
      new Date(iso),
    );
  const longDate = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone,
    }).format(new Date(iso));
  const mode = report.mode === 'full' ? 'Full check' : 'Light check';
  const counts = (['critical', 'medium', 'low'] as const)
    .map((sev) => [sev, failed.filter((f) => f.severity === sev).length] as const)
    .filter(([, n]) => n > 0);

  const cover = h(
    Page,
    { size: 'A4', style: s.page },
    footer,
    h(
      View,
      { style: s.body },
      h(
        View,
        { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
        h(
          View,
          { style: { flexDirection: 'row', alignItems: 'center', gap: 7 } },
          h(LogoTile, { size: 24 }),
          h(Text, { style: [s.display, { fontSize: 15 }] }, 'Sentry'),
        ),
        h(
          Text,
          { style: { fontSize: 8, fontWeight: 700, letterSpacing: 1, color: SUB } },
          'SECURITY CHECK-UP REPORT',
        ),
      ),
      h(
        View,
        { style: { marginTop: 34, marginBottom: 18, gap: 3 } },
        h(Text, { style: [s.display, { fontSize: 24, lineHeight: 1.2 }] }, report.hostname),
        h(Text, { style: s.sub }, `Checked ${when}${place ? ` (${place} time)` : ''} · ${mode}`),
      ),
      h(
        View,
        {
          style: [
            s.box,
            { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, marginBottom: 12 },
          ],
        },
        h(
          View,
          {
            style: {
              width: 62,
              height: 62,
              borderWidth: 3,
              borderColor: GRADE[report.grade],
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          h(
            Text,
            { style: [s.display, { fontSize: 38, lineHeight: 1, color: GRADE[report.grade] }] },
            report.grade,
          ),
        ),
        h(
          View,
          { style: { flex: 1, gap: 4 } },
          h(
            Text,
            { style: [s.display, { fontSize: 22, lineHeight: 1 }] },
            String(report.score),
            h(Text, { style: { fontFamily: 'Public Sans', fontSize: 11, color: SUB } }, ' / 100'),
          ),
          h(Text, { style: s.para }, report.summary),
        ),
      ),
      h(
        View,
        { style: { flexDirection: 'row', gap: 6, marginBottom: 18 } },
        ...counts.map(([sev, n]) => h(Pill, { key: sev, severity: sev, n })),
        h(
          Text,
          { style: [s.pill, { backgroundColor: '#E3F4EA', color: '#1D7F47' }] },
          `${passed.length} passed`,
        ),
      ),
      failed.length > 0
        ? h(
            View,
            { style: { gap: 6, marginBottom: 16 } },
            h(Text, { style: [s.display, { fontSize: 12.5 }] }, 'Fix these first'),
            ...failed.slice(0, 3).map((f) =>
              h(
                View,
                {
                  key: f.checkId,
                  style: {
                    flexDirection: 'row',
                    gap: 8,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: LINE,
                    borderLeftWidth: 4,
                    borderLeftColor: SEVERITY[f.severity].stripe,
                    borderRadius: 6,
                  },
                },
                h(
                  Text,
                  { style: { width: 48, fontWeight: 700, color: SEVERITY[f.severity].text } },
                  SEVERITY[f.severity].label,
                ),
                h(Text, { style: { flex: 1 } }, f.title),
              ),
            ),
          )
        : h(
            View,
            {
              style: [
                s.box,
                { backgroundColor: '#E3F4EA', borderColor: '#E3F4EA', marginBottom: 16 },
              ],
            },
            h(
              Text,
              null,
              h(Text, { style: { fontWeight: 700 } }, 'Nice work. '),
              `${report.hostname} passed every check we ran. Keep your software up to date and check again after big changes.`,
            ),
          ),
      report.changes &&
        h(
          View,
          {
            style: {
              padding: 10,
              backgroundColor: '#F5F7FA',
              borderRadius: 6,
              gap: 2,
              marginBottom: 12,
            },
          },
          h(
            Text,
            { style: { fontWeight: 700 } },
            `Since the last check (${shortDate(report.changes.previous.scannedAt)})`,
          ),
          h(
            Text,
            { style: s.sub },
            `${report.changes.previous.grade} ${report.changes.previous.score} -> ${report.grade} ${report.score}: ` +
              [
                report.changes.appeared.length
                  ? `${report.changes.appeared.length} new ${report.changes.appeared.length === 1 ? 'problem' : 'problems'}`
                  : '',
                report.changes.fixed.length ? `${report.changes.fixed.length} fixed` : '',
              ]
                .filter(Boolean)
                .join(', ') +
              (report.changes.appeared.length + report.changes.fixed.length === 0
                ? 'nothing changed'
                : '') +
              '.',
          ),
        ),
      report.mode === 'light' && h(LightNote, { hostname: report.hostname }),
    ),
  );

  const header = h(
    View,
    {
      fixed: true,
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 6,
        marginBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: LINE,
        fontSize: 8,
        color: SUB,
      },
    },
    h(Text, null, `${report.hostname} · ${longDate(report.scannedAt)}`),
    h(Text, { style: [s.display, { fontSize: 10, color: INK }] }, 'Sentry'),
  );

  const details = h(
    Page,
    { size: 'A4', style: s.page },
    footer,
    header,
    h(
      View,
      { style: s.body },
      failed.length > 0 &&
        h(
          Text,
          { style: [s.display, { fontSize: 16, marginBottom: 10 }] },
          `Problems to fix (${failed.length})`,
        ),
      ...failed.map((f) => h(Problem, { key: f.checkId, f, isNew: appeared.has(f.checkId) })),
      report.changes &&
        report.changes.fixed.length > 0 &&
        h(
          View,
          { wrap: false, style: { marginTop: 6, marginBottom: 10, gap: 4 } },
          h(
            Text,
            { style: [s.display, { fontSize: 13, color: '#1D7F47' }] },
            'Fixed since the last check',
          ),
          ...report.changes.fixed.map((f) => h(Text, { key: f.checkId }, `•  ${f.title}`)),
        ),
      h(
        View,
        // Kept on one page unless it's too long to fit on one.
        { wrap: passed.length > 14, style: { marginTop: 6, gap: 4 } },
        h(
          Text,
          { style: [s.display, { fontSize: 13 }], minPresenceAhead: 40 },
          `What’s already fine (${passed.length})`,
        ),
        ...passed.map((f) =>
          h(
            View,
            { key: f.checkId, wrap: false, style: { flexDirection: 'row', gap: 6 } },
            // A drawn tick: the bundled fonts don't include a tick character.
            h(
              Svg,
              { width: 9, height: 9, viewBox: '0 0 24 24', style: { marginTop: 2.5 } },
              h(Path, {
                d: 'M4 12.5 9.5 18 20 6',
                stroke: '#1D7F47',
                strokeWidth: 3.2,
                fill: 'none',
              }),
            ),
            h(
              View,
              { style: { flex: 1 } },
              h(Text, null, f.title),
              f.evidence && h(Text, { style: [s.mono, s.sub] }, plain(f.evidence)),
            ),
          ),
        ),
      ),
      report.mode === 'light' &&
        h(View, { style: { marginTop: 14 } }, h(LightNote, { hostname: report.hostname })),
    ),
  );

  const doc = h(
    Document,
    {
      title: `Sentry report: ${report.hostname}`,
      author: 'Sentry',
      subject: `Security check-up of ${report.hostname}`,
    },
    cover,
    details,
  );
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}

/** "sentry-demo.csentinel.com.ng-2026-10-05.pdf" (the date where the user is). */
export function pdfFileName(report: SavedReport, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(report.scannedAt));
  return `sentry-${report.hostname}-${day}.pdf`;
}
