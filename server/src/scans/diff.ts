import type { CheckId } from '../scanner/catalog.ts';

type Result = { checkId: CheckId; status: 'pass' | 'fail' };

export type Changes = {
  /** Failing last time, passing now. */
  fixed: CheckId[];
  /** Passing last time, failing now. */
  appeared: CheckId[];
  /** Failing both times, plus failures with nothing to compare against. */
  stillFailing: CheckId[];
};

/**
 * What changed between two checks of the same website. Only checks that ran both times are
 * compared, so a light check (no private files) never makes file problems look "fixed", and a
 * first full check doesn't call every file problem "new".
 */
export function diffChecks(previous: Result[], current: Result[]): Changes {
  const before = new Map(previous.map((r) => [r.checkId, r.status]));
  const changes: Changes = { fixed: [], appeared: [], stillFailing: [] };
  for (const { checkId, status } of current) {
    const was = before.get(checkId);
    if (was === 'fail' && status === 'pass') changes.fixed.push(checkId);
    else if (was === 'pass' && status === 'fail') changes.appeared.push(checkId);
    else if (status === 'fail') changes.stillFailing.push(checkId);
  }
  return changes;
}
