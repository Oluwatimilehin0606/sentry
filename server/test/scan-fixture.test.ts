import { afterEach, describe, expect, it } from 'vitest';
import { PROBES } from '../src/scanner/paths.ts';
import { scanHost, type ScanReport } from '../src/scanner/scan.ts';
import { startFixture, type Fixture, type FixtureOptions } from './fixture-server.ts';

const SECURE_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

let fixture: Fixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

async function scan(opts: FixtureOptions): Promise<ScanReport> {
  fixture = await startFixture(opts);
  return scanHost('localhost', fixture.ctx);
}

const find = (report: ScanReport, checkId: string) => report.findings.find((f) => f.checkId === checkId);
const statusOf = (report: ScanReport, checkId: string) => find(report, checkId)?.status;
const failed = (report: ScanReport) => report.findings.filter((f) => f.status === 'fail').map((f) => f.checkId).sort();

describe('scanning the local fixture site', () => {
  it('gives a well-configured site an A with every check passing', async () => {
    const report = await scan({ headers: SECURE_HEADERS });
    expect(failed(report)).toEqual([]);
    expect(report).toMatchObject({ score: 100, grade: 'A' });
    for (const id of ['tls.no_https', 'tls.cert_invalid', 'tls.cert_expiring_soon', 'tls.legacy_protocol', 'http.no_https_redirect', 'path.env_exposed', 'path.git_exposed', 'path.backup_exposed', 'path.ds_store_exposed']) {
      expect(statusOf(report, id), id).toBe('pass');
    }
  });

  it('flags a bare site: missing headers, version leak, old TLS, no redirect', async () => {
    const report = await scan({ legacyTls: true, http: 'serve', headers: { server: 'Apache/2.4.41 (Ubuntu)' } });
    expect(failed(report)).toEqual([
      'header.csp_missing',
      'header.hsts_missing',
      'header.referrer_policy_missing',
      'header.server_version_leak',
      'header.xcto_missing',
      'header.xfo_missing',
      'http.no_https_redirect',
      'tls.legacy_protocol',
    ]);
    expect(find(report, 'tls.legacy_protocol')?.evidence).toMatch(/TLS 1\.[01]/);
  });

  it('warns about a certificate that expires within 14 days', async () => {
    const report = await scan({ cert: 'expiring', headers: SECURE_HEADERS });
    expect(failed(report)).toEqual(['tls.cert_expiring_soon']);
  });

  it.each([
    ['expired', /expired/],
    ['wrong-host', /different domain/],
    ['self-signed', /self-signed/],
  ] as const)('reports a %s certificate as invalid', async (cert, evidence) => {
    const report = await scan({ cert });
    expect(statusOf(report, 'tls.cert_invalid')).toBe('fail');
    expect(find(report, 'tls.cert_invalid')?.evidence).toMatch(evidence);
    expect(report.grade).not.toMatch(/[ABC]/);
  });

  it('reports no HTTPS, and still checks for exposed files over plain HTTP', async () => {
    const report = await scan({ https: false, http: 'serve', files: { '/.env': { body: 'DB_PASSWORD=hunter2\nAPI_KEY=abc\n' } } });
    expect(statusOf(report, 'tls.no_https')).toBe('fail');
    expect(statusOf(report, 'path.env_exposed')).toBe('fail');
    expect(find(report, 'path.env_exposed')?.evidence).toMatch(/^GET http:\/\/localhost:\d+\/\.env → 200$/);
  });

  it('says the site is unreachable when nothing answers', async () => {
    fixture = await startFixture({ https: false, http: 'closed' });
    await expect(scanHost('localhost', fixture.ctx)).rejects.toMatchObject({ code: 'UNREACHABLE' });
  });
});

describe('exposed files', () => {
  it('finds each kind of exposed file', async () => {
    const report = await scan({
      headers: SECURE_HEADERS,
      files: {
        '/.env': { body: 'APP_KEY=base64:abc\nDB_PASSWORD=hunter2\n' },
        '/.git/HEAD': { body: 'ref: refs/heads/main\n' },
        '/.htpasswd': { body: 'admin:$apr1$abc$defghijklmnopqrstuvw\n' },
        '/db.sql': { body: '-- MySQL dump 10.13\nCREATE TABLE `orders` (id int);\n' },
        '/phpinfo.php': { body: '<html><head><title>PHP 8.1.2 - phpinfo()</title></head></html>', type: 'text/html' },
        '/phpmyadmin/': { body: '<title>phpMyAdmin</title><form id="login_form" class="pma_login">', type: 'text/html' },
        '/.DS_Store': { body: Buffer.from([0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31, 0, 0]) },
      },
    });
    expect(failed(report)).toEqual([
      'path.backup_exposed',
      'path.db_admin_exposed',
      'path.debug_page_exposed',
      'path.ds_store_exposed',
      'path.env_exposed',
      'path.git_exposed',
      'path.htpasswd_exposed',
    ]);
    expect(find(report, 'path.backup_exposed')?.evidence).toContain('/db.sql');
    // A critical exposure caps the grade at D.
    expect(report.score).toBeLessThanOrEqual(69);
  });

  it('does not raise false alarms on sites that answer every address with a page', async () => {
    const report = await scan({ headers: SECURE_HEADERS, softNotFound: true });
    expect(failed(report)).toEqual([]);
  });

  it('checks the content, not just the status code', async () => {
    const report = await scan({
      headers: SECURE_HEADERS,
      files: {
        '/.env': { body: '<!doctype html><p>APP_KEY=not really</p><p>X=1</p>', type: 'text/html' },
        '/.git/HEAD': { body: 'Nothing to see here' },
        '/backup.zip': { body: 'This is not a zip file' },
        '/phpmyadmin/': { body: 'Read our blog post about phpMyAdmin', type: 'text/html' },
      },
    });
    expect(failed(report)).toEqual([]);
  });

  it('asks only for the listed files, plus one address that cannot exist', async () => {
    await scan({ headers: SECURE_HEADERS });
    const probed = fixture!.requests.filter((url) => url !== '/');
    const allowed = new Set(PROBES.map((p) => p.path));
    const unexpected = probed.filter((url) => !allowed.has(url));
    expect(unexpected).toHaveLength(1);
    expect(unexpected[0]).toMatch(/^\/sentry-check-[0-9a-f]{12}$/);
  });
});

describe('scan safety', () => {
  it('refuses to scan this machine with the real settings', async () => {
    await expect(scanHost('localhost')).rejects.toMatchObject({ code: 'BLOCKED' });
  });
});
