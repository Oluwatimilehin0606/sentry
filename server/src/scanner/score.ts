import { CATALOG, type Severity } from './catalog.ts';
import type { Finding } from './checks.ts';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

const DEDUCTION: Record<Severity, number> = { critical: 30, medium: 10, low: 4 };
const SEVERITY_ORDER: Severity[] = ['critical', 'medium', 'low'];

export function gradeFor(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export function scoreFindings(findings: Finding[]) {
  const failed = findings.filter((f) => f.status === 'fail');
  const severities = failed.map((f) => CATALOG[f.checkId].severity);

  let score = 100 - severities.reduce((sum, s) => sum + DEDUCTION[s], 0);
  score = Math.max(0, score);
  // Any critical problem caps the result at a D, however well the rest went.
  if (severities.includes('critical')) score = Math.min(score, 69);

  const grade = gradeFor(score);
  const article = grade === 'A' || grade === 'F' ? 'an' : 'a';
  const count = failed.length;
  const worst = SEVERITY_ORDER.find((s) => severities.includes(s));
  const worstCount = severities.filter((s) => s === worst).length;

  const summary =
    count === 0
      ? `Your site scored ${article} ${grade}. No problems found in the checks we ran.`
      : `Your site scored ${article} ${grade}. ${count} ${
          count === 1 ? 'issue is' : 'issues are'
        } putting you at risk. Fix the ${worst} ${worstCount === 1 ? 'one' : 'ones'} first.`;

  return { score, grade, summary };
}
