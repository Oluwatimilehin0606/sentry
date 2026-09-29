import tls from 'node:tls';
import type { Finding } from './checks.ts';
import type { ScanContext } from './context.ts';

/**
 * Tries a handshake that offers only TLS 1.0 and 1.1, which browsers dropped in 2020.
 * If the site agrees, it still accepts connections with known weaknesses.
 * (SECLEVEL=0 is needed for Node's OpenSSL to even offer these old versions.)
 */
export function checkLegacyTls(ctx: ScanContext, hostname: string, timeoutMs = 6000): Promise<Finding | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port: ctx.ports.https,
      servername: hostname,
      lookup: ctx.lookup,
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1.1',
      ciphers: 'DEFAULT@SECLEVEL=0',
      // We only want to know which versions are accepted; the certificate is checked elsewhere.
      rejectUnauthorized: false,
      timeout: timeoutMs,
    });
    const done = (finding: Finding | null) => {
      socket.destroy();
      resolve(finding);
    };
    socket.once('secureConnect', () => {
      const version = socket.getProtocol()?.replace('TLSv', 'TLS ') ?? 'TLS 1.0/1.1';
      done({ checkId: 'tls.legacy_protocol', status: 'fail', evidence: `Accepted a ${version} connection` });
    });
    // No answer either way: leave the check out rather than guess.
    socket.once('timeout', () => done(null));
    socket.once('error', () =>
      done({ checkId: 'tls.legacy_protocol', status: 'pass', evidence: 'Refuses TLS 1.0 and 1.1' }),
    );
  });
}
