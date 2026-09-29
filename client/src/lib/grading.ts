import type { Grade, ReportFinding, ScanReport, Severity } from '@/lib/scan';

// Mirrors server/src/scanner/score.ts so suggestions match real grades.
const DEDUCTION: Record<Severity, number> = { critical: 30, medium: 10, low: 4 };
const ORDER: Severity[] = ['critical', 'medium', 'low'];

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function scoreOf(failed: ReportFinding[]): number {
  let score = 100 - failed.reduce((sum, f) => sum + DEDUCTION[f.severity], 0);
  score = Math.max(0, score);
  if (failed.some((f) => f.severity === 'critical')) score = Math.min(score, 69);
  return score;
}

export type NextStep =
  | { kind: 'clear' }
  | { kind: 'fix'; finding: ReportFinding; newScore: number; newGrade: Grade; gain: number };

/** The single fix that helps most: the most severe failing check, and what fixing it would do. */
export function nextStep(report: ScanReport): NextStep {
  const failed = report.findings.filter((f) => f.status === 'fail');
  if (failed.length === 0) return { kind: 'clear' };
  const top = [...failed].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))[0]!;
  const rest = failed.filter((f) => f !== top);
  const newScore = scoreOf(rest);
  return { kind: 'fix', finding: top, newScore, newGrade: gradeFor(newScore), gain: newScore - report.score };
}

export const GRADE_COLOR: Record<Grade, string> = {
  A: 'var(--grade-a)',
  B: 'var(--grade-b)',
  C: 'var(--grade-c)',
  D: 'var(--grade-d)',
  F: 'var(--grade-f)',
};
