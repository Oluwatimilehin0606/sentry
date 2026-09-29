import { describe, expect, it } from 'vitest';
import { gradeFor, nextStep } from '@/lib/grading';
import type { Grade, ReportFinding, ScanReport, Severity } from '@/lib/scan';

const finding = (checkId: string, severity: Severity, status: 'pass' | 'fail' = 'fail'): ReportFinding => ({
  checkId,
  status,
  severity,
  title: `Title for ${checkId}`,
  whatItIs: '',
  whyItMatters: '',
  howToFix: `Fix ${checkId}`,
  evidence: undefined,
});

const report = (score: number, grade: Grade, findings: ReportFinding[]): ScanReport => ({
  hostname: 'yourbakery.example',
  scannedAt: '2026-09-29T12:00:00Z',
  durationMs: 900,
  score,
  grade,
  summary: '',
  findings,
});

describe('gradeFor', () => {
  it.each([
    [100, 'A'],
    [90, 'A'],
    [89, 'B'],
    [80, 'B'],
    [79, 'C'],
    [70, 'C'],
    [69, 'D'],
    [60, 'D'],
    [59, 'F'],
    [0, 'F'],
  ] as const)('%i → %s', (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });
});

describe('nextStep', () => {
  it('says all clear when nothing failed', () => {
    const r = report(100, 'A', [finding('tls.no_https', 'critical', 'pass')]);
    expect(nextStep(r)).toEqual({ kind: 'clear' });
  });

  it('picks a medium issue ahead of low ones and works out the new grade (example.com: F → D)', () => {
    const r = report(58, 'F', [
      finding('header.xfo_missing', 'low'),
      finding('header.hsts_missing', 'medium'),
      finding('header.csp_missing', 'medium'),
      finding('http.no_https_redirect', 'medium'),
      finding('header.xcto_missing', 'low'),
      finding('header.referrer_policy_missing', 'low'),
    ]);
    const step = nextStep(r);
    expect(step.kind).toBe('fix');
    if (step.kind !== 'fix') return;
    expect(step.finding.severity).toBe('medium');
    expect(step.newScore).toBe(68);
    expect(step.newGrade).toBe('D');
    expect(step.gain).toBe(10);
  });

  it('fixes a critical issue first, lifting the D cap', () => {
    // 100 - 30 - 10 = 60 (and capped at 69 anyway) → fixing the critical leaves 90, an A.
    const r = report(60, 'D', [finding('header.hsts_missing', 'medium'), finding('tls.cert_invalid', 'critical')]);
    const step = nextStep(r);
    expect(step.kind === 'fix' && step.finding.checkId).toBe('tls.cert_invalid');
    expect(step.kind === 'fix' && [step.newScore, step.newGrade]).toEqual([90, 'A']);
  });

  it('keeps the D cap while another critical issue remains', () => {
    // Two criticals: 40 (F). Fixing one gives 70, but the other still caps it at 69 (D).
    const r = report(40, 'F', [finding('tls.no_https', 'critical'), finding('tls.cert_invalid', 'critical')]);
    const step = nextStep(r);
    expect(step.kind === 'fix' && [step.newScore, step.newGrade]).toEqual([69, 'D']);
  });
});
