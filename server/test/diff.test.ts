import { describe, expect, it } from 'vitest';
import { diffChecks } from '../src/scans/diff.ts';

describe('diffChecks', () => {
  it('finds fixed, newly failing and still failing checks', () => {
    const changes = diffChecks(
      [
        { checkId: 'header.hsts_missing', status: 'fail' },
        { checkId: 'header.csp_missing', status: 'fail' },
        { checkId: 'header.xcto_missing', status: 'pass' },
      ],
      [
        { checkId: 'header.hsts_missing', status: 'pass' },
        { checkId: 'header.csp_missing', status: 'fail' },
        { checkId: 'header.xcto_missing', status: 'fail' },
      ],
    );
    expect(changes).toEqual({
      fixed: ['header.hsts_missing'],
      appeared: ['header.xcto_missing'],
      stillFailing: ['header.csp_missing'],
    });
  });

  it('never calls skipped private files "fixed" after a light check', () => {
    const fullBefore = [
      { checkId: 'path.env_exposed', status: 'fail' },
      { checkId: 'header.hsts_missing', status: 'fail' },
    ] as const;
    const lightNow = [{ checkId: 'header.hsts_missing', status: 'fail' }] as const;
    expect(diffChecks([...fullBefore], [...lightNow])).toEqual({
      fixed: [],
      appeared: [],
      stillFailing: ['header.hsts_missing'],
    });
  });

  it('does not call problems "new" when they were never checked before', () => {
    const lightBefore = [{ checkId: 'header.hsts_missing', status: 'pass' }] as const;
    const fullNow = [
      { checkId: 'header.hsts_missing', status: 'pass' },
      { checkId: 'path.env_exposed', status: 'fail' },
    ] as const;
    expect(diffChecks([...lightBefore], [...fullNow])).toEqual({
      fixed: [],
      appeared: [],
      stillFailing: ['path.env_exposed'],
    });
  });
});
