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
  // The most severe issue, first in report order: the same one the home page's "Your next step" shows.
  const rank = (f: Finding) => SEVERITY_ORDER.indexOf(CATALOG[f.checkId].severity);
  const first = [...failed].sort((a, b) => rank(a) - rank(b))[0];
  const firstTitle = first ? CATALOG[first.checkId].title : '';

  const summary =
    count === 0
      ? `Your site scored ${article} ${grade}. No problems found in the checks we ran.`
      : count === 1
        ? `Your site scored ${article} ${grade}. 1 issue is putting you at risk: “${firstTitle}”.`
        : `Your site scored ${article} ${grade}. ${count} issues are putting you at risk. Start with “${firstTitle}”.`;

  return { score, grade, summary };
}
