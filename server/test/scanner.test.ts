import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { pool } from '../src/db/client.ts';
import { CATALOG } from '../src/scanner/catalog.ts';
import { evaluateCertificate, evaluateHeaders, evaluateTlsError, type Finding } from '../src/scanner/checks.ts';
import { normalizeHostname } from '../src/scanner/domain.ts';
import { scoreFindings } from '../src/scanner/score.ts';
import { assertPublicHost, isBlockedAddress } from '../src/scanner/target.ts';
import { resetDatabase, signedInAgent } from './helpers.ts';

describe('SSRF guard', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.5',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks %s', (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(['93.184.215.14', '1.1.1.1', '2606:4700:4700::1111'])('allows public %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });

  it('rejects domains that resolve to this machine', async () => {
    await expect(assertPublicHost('localhost')).rejects.toMatchObject({ code: 'BLOCKED' });
  });
});

describe('normalizeHostname', () => {
  it('accepts and lowercases real domains', () => {
    expect(normalizeHostname('  YourBakery.COM ')).toBe('yourbakery.com');
    expect(normalizeHostname('shop.example.co.uk.')).toBe('shop.example.co.uk');
  });

  it.each(['https://example.com', 'example.com/menu', 'localhost', '127.0.0.1', 'a@b.com', ''])(
    'rejects %j',
    (input) => {
      expect(normalizeHostname(input)).toBeNull();
    },
  );
});

describe('evaluateHeaders', () => {
  const statusOf = (findings: Finding[], id: string) => findings.find((f) => f.checkId === id)?.status;

  it('passes a well-configured site', () => {
    const findings = evaluateHeaders({
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      server: 'cloudflare',
    });
    expect(findings.every((f) => f.status === 'pass')).toBe(true);
  });

  it('flags missing headers and version leaks', () => {
    const findings = evaluateHeaders({ server: 'Apache/2.4.41 (Ubuntu)', 'x-powered-by': 'PHP/7.4.3' });
    expect(statusOf(findings, 'header.hsts_missing')).toBe('fail');
    expect(statusOf(findings, 'header.csp_missing')).toBe('fail');
    expect(statusOf(findings, 'header.xfo_missing')).toBe('fail');
    expect(statusOf(findings, 'header.server_version_leak')).toBe('fail');
  });

  it('treats HSTS with max-age=0 as missing', () => {
    const findings = evaluateHeaders({ 'strict-transport-security': 'max-age=0' });
    expect(statusOf(findings, 'header.hsts_missing')).toBe('fail');
  });
});

describe('certificate and TLS errors', () => {
  it('warns when the certificate expires within 14 days', () => {
    const now = new Date('2026-09-27T00:00:00Z');
    const [soon] = evaluateCertificate({ valid_to: 'Oct  3 00:00:00 2026 GMT' } as never, now);
    const [fine] = evaluateCertificate({ valid_to: 'Dec 31 00:00:00 2026 GMT' } as never, now);
    expect(soon?.status).toBe('fail');
    expect(fine?.status).toBe('pass');
  });

  it('maps certificate errors to a plain-English finding', () => {
    expect(evaluateTlsError({ code: 'CERT_HAS_EXPIRED' } as NodeJS.ErrnoException)?.checkId).toBe('tls.cert_invalid');
    expect(evaluateTlsError({ code: 'ECONNREFUSED' } as NodeJS.ErrnoException)).toBeNull();
  });
});

describe('scoreFindings', () => {
  const fail = (checkId: keyof typeof CATALOG): Finding => ({ checkId, status: 'fail' });

  it('gives a clean site 100 and an A', () => {
    expect(scoreFindings([{ checkId: 'tls.no_https', status: 'pass' }])).toMatchObject({ score: 100, grade: 'A' });
  });

  it('deducts by severity', () => {
    const result = scoreFindings([fail('header.hsts_missing'), fail('header.xcto_missing')]);
    expect(result).toMatchObject({ score: 86, grade: 'B' });
    expect(result.summary).toBe(
      'Your site scored a B. 2 issues are putting you at risk. Start with “Browsers aren’t told to always use a secure connection”.',
    );
  });

  it('names the single issue when there is only one', () => {
    expect(scoreFindings([fail('header.xcto_missing')]).summary).toBe(
      'Your site scored an A. 1 issue is putting you at risk: “Browsers may guess what your files are”.',
    );
  });

  it('starts with the most severe issue, whatever order the checks ran in', () => {
    const result = scoreFindings([fail('header.xcto_missing'), fail('header.csp_missing'), fail('path.env_exposed')]);
    expect(result.summary).toContain('Start with “Your private settings file is public”.');
  });

  it('caps any critical problem at a D', () => {
    expect(scoreFindings([fail('tls.cert_invalid')])).toMatchObject({ score: 69, grade: 'D' });
  });

  it('never goes below zero', () => {
    const many = Array.from({ length: 5 }, () => fail('tls.no_https'));
    expect(scoreFindings(many)).toMatchObject({ score: 0, grade: 'F' });
  });
});

describe('catalog', () => {
  it('has complete plain-English copy for every check', () => {
    for (const entry of Object.values(CATALOG)) {
      for (const text of [entry.title, entry.passTitle, entry.whatItIs, entry.whyItMatters, entry.howToFix]) {
        expect(text.length).toBeGreaterThan(10);
      }
    }
  });
});

describe('POST /api/scan', () => {
  const app = createApp();
  let agent: Awaited<ReturnType<typeof signedInAgent>>;

  beforeAll(async () => {
    await resetDatabase();
    agent = await signedInAgent(app);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('requires signing in', async () => {
    const res = await request(app).post('/api/scan').send({ domain: 'example.com' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Please sign in to continue.');
  });

  it('rejects invalid domains without scanning', async () => {
    const res = await agent.post('/api/scan').send({ domain: 'https://example.com/menu' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid domain/);
  });

  it('refuses to scan private addresses', async () => {
    const res = await agent.post('/api/scan').send({ domain: 'localhost.' });
    expect(res.status).toBe(400);
  });

  it('streams progress lines when asked, ending with the result', async () => {
    const res = await agent
      .post('/api/scan')
      .set('Accept', 'application/x-ndjson')
      .send({ domain: 'no-such-site.example' })
      .buffer(true)
      .parse((r, done) => {
        let text = '';
        r.on('data', (c: Buffer) => (text += c.toString()));
        r.on('end', () => done(null, text));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/x-ndjson/);
    const lines = (res.body as string).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ type: 'error', code: 'NOT_FOUND' });
  });
});
