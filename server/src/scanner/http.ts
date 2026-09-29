import http, { type IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import type { PeerCertificate, TLSSocket } from 'node:tls';
import type { ScanContext } from './context.ts';

export type HttpResult = {
  url: URL;
  status: number;
  headers: IncomingHttpHeaders;
  certificate?: PeerCertificate;
  /** The first `maxBodyBytes` of the body, only when asked for. */
  body?: Buffer;
};

export const USER_AGENT = 'SentryScanner/0.2 (+https://github.com/Oluwatimilehin0606/sentry)';

/**
 * Makes one GET request. Redirects are not followed here (the caller decides). The body is only
 * read when `maxBodyBytes` is set, and never beyond that many bytes.
 */
export function fetchUrl(
  ctx: ScanContext,
  url: URL,
  { timeoutMs = 8000, maxBodyBytes = 0 }: { timeoutMs?: number; maxBodyBytes?: number } = {},
): Promise<HttpResult> {
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: ctx.lookup,
        ca: ctx.ca,
        timeout: timeoutMs,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
      },
      (res) => {
        const certificate =
          url.protocol === 'https:' ? (res.socket as TLSSocket).getPeerCertificate() : undefined;
        const result: HttpResult = { url, status: res.statusCode ?? 0, headers: res.headers, certificate };
        if (maxBodyBytes <= 0) {
          resolve(result);
          res.destroy();
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        const finish = () => {
          resolve({ ...result, body: Buffer.concat(chunks).subarray(0, maxBodyBytes) });
          res.destroy();
        };
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
          if (size >= maxBodyBytes) finish();
        });
        res.on('end', finish);
        res.on('error', finish);
      },
    );
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', reject);
    req.end();
  });
}
