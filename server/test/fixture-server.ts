import http, { type OutgoingHttpHeaders } from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import selfsigned from 'selfsigned';
import { fixtureContext, type ScanContext } from '../src/scanner/context.ts';

/**
 * A pretend website on this machine, served as https://localhost:<port>, for scanner tests.
 * Never test against real third-party sites.
 */

type Pems = { cert: string; private: string };
const DAY = 24 * 60 * 60 * 1000;

let caPromise: Promise<Pems> | undefined;
/** One test certificate authority per test run; the scanner is told to trust it. */
function testCa(): Promise<Pems> {
  caPromise ??= selfsigned.generate([{ name: 'commonName', value: 'Sentry Test CA' }], {
    keyType: 'ec',
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true },
    ],
  });
  return caPromise;
}

export type CertKind = 'valid' | 'expiring' | 'expired' | 'wrong-host' | 'self-signed';

async function siteCert(kind: CertKind): Promise<Pems> {
  const ca = await testCa();
  const now = Date.now();
  const name = kind === 'wrong-host' ? 'other.example' : 'localhost';
  const validity =
    kind === 'expired'
      ? { notBeforeDate: new Date(now - 60 * DAY), notAfterDate: new Date(now - DAY) }
      : kind === 'expiring'
        ? { notBeforeDate: new Date(now - DAY), notAfterDate: new Date(now + 5 * DAY) }
        : { notBeforeDate: new Date(now - DAY), notAfterDate: new Date(now + 200 * DAY) };
  return selfsigned.generate([{ name: 'commonName', value: name }], {
    keyType: 'ec',
    algorithm: 'sha256',
    ...validity,
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'subjectAltName', altNames: [{ type: 2, value: name }] },
    ],
    ...(kind === 'self-signed' ? {} : { ca: { key: ca.private, cert: ca.cert } }),
  });
}

type File = { status?: number; body: string | Buffer; type?: string };

export type FixtureOptions = {
  cert?: CertKind;
  /** Serve HTTPS at all (false = nothing listening on the HTTPS port). */
  https?: boolean;
  /** Also accept TLS 1.0/1.1. */
  legacyTls?: boolean;
  /** Headers on every HTTPS response. */
  headers?: OutgoingHttpHeaders;
  /** Paths the site serves; everything else is 404 unless `softNotFound`. */
  files?: Record<string, File>;
  /** Answer unknown paths with a normal 200 page, like many site builders do. */
  softNotFound?: boolean;
  /** Plain HTTP on port "80": redirect to HTTPS, serve the site insecurely, or not listen. */
  http?: 'redirect' | 'serve' | 'closed';
};

export type Fixture = { ctx: ScanContext; requests: string[]; close: () => Promise<void> };

const HOME = '<!doctype html><html><head><title>Your Bakery</title></head><body>Fresh bread daily</body></html>';

async function listen(server: http.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

/** A port with nothing listening on it. */
async function closedPort(): Promise<number> {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise((r) => server.close(r));
  return port;
}

export async function startFixture(opts: FixtureOptions = {}): Promise<Fixture> {
  const requests: string[] = [];
  const files: Record<string, File> = { '/': { body: HOME, type: 'text/html' }, ...opts.files };

  const handler = (headers: OutgoingHttpHeaders) => (req: http.IncomingMessage, res: http.ServerResponse) => {
    requests.push(req.url ?? '');
    const file = files[req.url ?? '/'];
    if (file) {
      res.writeHead(file.status ?? 200, { 'content-type': file.type ?? 'text/plain', ...headers });
      res.end(file.body);
    } else if (opts.softNotFound) {
      res.writeHead(200, { 'content-type': 'text/html', ...headers });
      res.end(HOME);
    } else {
      res.writeHead(404, { 'content-type': 'text/html', ...headers });
      res.end('<!doctype html><title>Not found</title>');
    }
  };

  const servers: http.Server[] = [];
  const ca = await testCa();

  let httpsPort: number;
  if (opts.https === false) {
    httpsPort = await closedPort();
  } else {
    const pems = await siteCert(opts.cert ?? 'valid');
    const server = https.createServer(
      {
        key: pems.private,
        cert: pems.cert,
        ...(opts.legacyTls ? { minVersion: 'TLSv1', ciphers: 'DEFAULT@SECLEVEL=0' } : { minVersion: 'TLSv1.2' }),
      },
      handler(opts.headers ?? {}),
    );
    servers.push(server);
    httpsPort = await listen(server);
  }

  let httpPort: number;
  const httpMode = opts.http ?? 'redirect';
  if (httpMode === 'closed') {
    httpPort = await closedPort();
  } else {
    const server = http.createServer(
      httpMode === 'serve'
        ? handler({})
        : (req, res) => {
            res.writeHead(301, { location: `https://localhost:${httpsPort}${req.url ?? '/'}` });
            res.end();
          },
    );
    servers.push(server);
    httpPort = await listen(server);
  }

  return {
    ctx: fixtureContext({ httpsPort, httpPort, ca: ca.cert }),
    requests,
    close: async () => {
      await Promise.all(
        servers.map((s) => new Promise((r) => {
          s.closeAllConnections();
          s.close(r);
        })),
      );
    },
  };
}
