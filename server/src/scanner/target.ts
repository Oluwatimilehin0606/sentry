import dns from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';

/**
 * SSRF guard: Sentry must only ever connect to public internet addresses,
 * never to this machine, the local network or cloud metadata services.
 */
const blocked = new BlockList();

const BLOCKED_V4: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

const BLOCKED_V6: [string, number][] = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
  ['2001:db8::', 32], // documentation
];

for (const [net, prefix] of BLOCKED_V4) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of BLOCKED_V6) blocked.addSubnet(net, prefix, 'ipv6');

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) could smuggle a private IPv4 address; check the IPv4 part.
  // (A ::ffff:0:0/96 rule can't be used: BlockList would then match every IPv4 address.)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return isBlockedAddress(mapped);
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class ScanTargetError extends Error {
  readonly code: 'NOT_FOUND' | 'BLOCKED' | 'UNREACHABLE';

  constructor(code: ScanTargetError['code'], message: string) {
    super(message);
    this.name = 'ScanTargetError';
    this.code = code;
  }
}

/** Fails early, with a friendly message, if a hostname doesn't resolve to a public address. */
export async function assertPublicHost(hostname: string): Promise<void> {
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true });
  } catch {
    throw new ScanTargetError(
      'NOT_FOUND',
      `We couldn’t find ${hostname}. Check the spelling and try again.`,
    );
  }
  if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
    throw new ScanTargetError(
      'BLOCKED',
      'Sentry can only check public websites. That domain points to a private or internal address.',
    );
  }
}

/**
 * DNS lookup used for every outgoing scan connection. Re-checking at connect
 * time (not just up front) stops DNS-rebinding tricks.
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as dns.LookupAddress[];
    const first = list[0];
    if (!first || list.some((a) => isBlockedAddress(a.address))) {
      return callback(new ScanTargetError('BLOCKED', 'Blocked non-public address'), '');
    }
    if (options.all) return callback(null, list);
    callback(null, first.address, first.family);
  });
};
