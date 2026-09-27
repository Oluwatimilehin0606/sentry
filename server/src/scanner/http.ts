import http, { type IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import type { PeerCertificate, TLSSocket } from 'node:tls';
import { guardedLookup } from './target.ts';

export type HttpResult = {
  url: URL;
  status: number;
  headers: IncomingHttpHeaders;
  certificate?: PeerCertificate;
};

const USER_AGENT = 'SentryScanner/0.1 (+https://github.com/Oluwatimilehin0606/sentry)';

/**
 * Makes one GET request and returns the status and headers only; the body is
 * never downloaded. Redirects are not followed here (the caller decides).
 */
export function fetchHead(url: URL, timeoutMs = 8000): Promise<HttpResult> {
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: guardedLookup,
        timeout: timeoutMs,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
      },
      (res) => {
        const certificate =
          url.protocol === 'https:' ? (res.socket as TLSSocket).getPeerCertificate() : undefined;
        resolve({ url, status: res.statusCode ?? 0, headers: res.headers, certificate });
        res.destroy();
      },
    );
    req.on('timeout', () => {
      req.destroy(Object.assign(new Error('Request timed out'), { code: 'ETIMEDOUT' }));
    });
    req.on('error', reject);
    req.end();
  });
}
