import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { domains, scans } from '../db/schema.ts';
import { newVerifyToken } from '../domains/verify.ts';
import { CATALOG } from '../scanner/catalog.ts';
import { buildReport } from '../scanner/scan.ts';
import { saveScan } from '../scans/store.ts';

/**
 * The demo account's websites, with weeks of made-up checks so the charts and lists look lived-in.
 * Used by `npm run db:seed` and by "Reset demo" on the demo account's Account page.
 *
 * The live demo website (bakery.test on this machine, DEMO_SITE_HOST online) is an A for weeks, so
 * a live check shows "A → F". The others use reserved .example names, which can never exist on the
 * internet, so nothing real is ever checked.
 */

type CheckId = keyof typeof CATALOG;
type Check = { daysAgo: number; failing: CheckId[]; trigger?: 'manual' | 'scheduled'; minute?: number };
type Site = {
  hostname: string;
  addedDaysAgo: number;
  verified: boolean;
  rescanInterval: 'none' | 'weekly' | 'monthly';
  nextCheckInDays?: number;
  checks: Check[];
};

function sites(demoSite: string, demoVerified: boolean): Site[] {
  return [
    {
      // An A for weeks; live on the day it scores an F (missing protections, a public .env file).
      hostname: demoSite,
      addedDaysAgo: 34,
      verified: demoVerified,
      rescanInterval: 'weekly',
      nextCheckInDays: 6,
      checks: [
        { daysAgo: 33, failing: ['header.csp_missing', 'header.xfo_missing', 'header.xcto_missing'], trigger: 'manual', minute: 12 },
        { daysAgo: 26, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 14 },
        { daysAgo: 19, failing: ['header.xcto_missing'], minute: 9 },
        { daysAgo: 12, failing: [], minute: 17 },
        { daysAgo: 5, failing: ['header.server_version_leak'], minute: 11 },
      ],
    },
    {
      // Started with its settings file public; fixed it, then worked through the rest.
      hostname: 'lagoslaundry.example',
      addedDaysAgo: 41,
      verified: true,
      rescanInterval: 'weekly',
      nextCheckInDays: 3,
      checks: [
        {
          daysAgo: 40,
          failing: ['path.env_exposed', 'http.no_https_redirect', 'header.hsts_missing', 'header.csp_missing', 'header.xfo_missing', 'header.xcto_missing', 'header.referrer_policy_missing'],
          trigger: 'manual',
          minute: 31,
        },
        {
          daysAgo: 33,
          failing: ['http.no_https_redirect', 'header.hsts_missing', 'header.csp_missing', 'header.xfo_missing', 'header.xcto_missing', 'header.referrer_policy_missing'],
          minute: 33,
        },
        { daysAgo: 26, failing: ['header.csp_missing', 'header.xfo_missing', 'header.xcto_missing', 'header.referrer_policy_missing'], minute: 29 },
        { daysAgo: 19, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 35 },
        { daysAgo: 12, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 30 },
        { daysAgo: 5, failing: ['header.csp_missing', 'header.xcto_missing'], minute: 32 },
      ],
    },
    {
      // Checked monthly; a debug page went public for a while, then was taken down.
      hostname: 'mamaputkitchen.example',
      addedDaysAgo: 62,
      verified: true,
      rescanInterval: 'monthly',
      nextCheckInDays: 27,
      checks: [
        { daysAgo: 61, failing: ['header.hsts_missing', 'header.csp_missing', 'header.xcto_missing', 'header.server_version_leak'], trigger: 'manual', minute: 48 },
        { daysAgo: 31, failing: ['header.hsts_missing', 'header.csp_missing', 'header.xcto_missing', 'header.server_version_leak', 'path.debug_page_exposed'], minute: 51 },
        { daysAgo: 3, failing: ['header.hsts_missing', 'header.csp_missing', 'header.xcto_missing'], trigger: 'manual', minute: 46 },
      ],
    },
    {
      // Added yesterday; its ownership record isn't in place yet, so the "prove it's yours" steps show.
      hostname: 'adunnicakes.example',
      addedDaysAgo: 1,
      verified: false,
      rescanInterval: 'none',
      checks: [],
    },
  ];
}

/** The main domain above a hostname: demo.yourdomain.com.ng → yourdomain.com.ng. */
export function mainDomain(hostname: string): string {
  const parts = hostname.split('.');
  const twoLevel = parts.length >= 3 && /^(com|co|org|net|gov|edu|ac|sch|name|mil)$/.test(parts.at(-2)!);
  return parts.slice(-(twoLevel ? 3 : 2)).join('.');
}

export type PlantOptions = {
  /** The live demo website's hostname. */
  demoSite: string;
  /** Its ownership proof value (kept the same, so the DNS record never has to change). */
  demoToken: string;
  /** Whether its proof is in place. */
  demoVerified: boolean;
  now?: number;
};

export type PlantedSite = { hostname: string; verified: boolean; grades: { grade: string; score: number }[] };

/**
 * Puts the demo websites into an account: first removes those websites (and their checks) if
 * they're already there, then adds them with their history. Other websites are left alone.
 */
export async function plantDemoWebsites(userId: string, opts: PlantOptions): Promise<PlantedSite[]> {
  const now = opts.now ?? Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  /** `days` ago (negative: ahead), at a plausible time of day. */
  const daysAgo = (days: number, hour = 10, minute = 0) => {
    const at = new Date(now - days * DAY);
    at.setHours(hour, minute, 0, 0);
    return at;
  };
  const list = sites(opts.demoSite, opts.demoVerified);
  const hostnames = list.map((s) => s.hostname);
  const allChecks = Object.keys(CATALOG) as CheckId[];

  // Each website's saved developer ("Send to my developer") survives the reset, like its proof.
  const kept = new Map(
    (
      await db
        .select({
          hostname: domains.hostname,
          developerName: domains.developerName,
          developerEmail: domains.developerEmail,
          developerAutoSend: domains.developerAutoSend,
          developerStopToken: domains.developerStopToken,
        })
        .from(domains)
        .where(and(eq(domains.userId, userId), inArray(domains.hostname, hostnames)))
    ).map(({ hostname, ...developer }) => [hostname, developer]),
  );

  await db.delete(scans).where(and(eq(scans.userId, userId), inArray(scans.hostname, hostnames)));
  await db.delete(domains).where(and(eq(domains.userId, userId), inArray(domains.hostname, hostnames)));

  const planted: PlantedSite[] = [];
  for (const site of list) {
    await db.insert(domains).values({
      userId,
      hostname: site.hostname,
      verifyToken: site.hostname === opts.demoSite ? opts.demoToken : newVerifyToken(),
      verifiedAt: site.verified ? daysAgo(site.addedDaysAgo, 9, 50) : null,
      createdAt: daysAgo(site.addedDaysAgo, 9, 45),
      rescanInterval: site.rescanInterval,
      // At about the time of day of its earlier checks, like real automatic checks.
      nextCheckAt:
        site.nextCheckInDays === undefined ? null : daysAgo(-site.nextCheckInDays, 10, (site.checks.at(-1)?.minute ?? 0) + 2),
      alertsEnabled: true,
      ...kept.get(site.hostname),
    });

    const grades: PlantedSite['grades'] = [];
    for (const check of site.checks) {
      const report = buildReport({
        hostname: site.hostname,
        mode: 'full',
        scannedAt: daysAgo(check.daysAgo, 10, check.minute ?? 0).toISOString(),
        durationMs: 8000 + Math.round(Math.random() * 4000),
        findings: allChecks.map((checkId) => ({
          checkId,
          status: check.failing.includes(checkId) ? ('fail' as const) : ('pass' as const),
        })),
      });
      await saveScan(userId, report, check.trigger ?? 'scheduled');
      grades.push({ grade: report.grade, score: report.score });
    }
    planted.push({ hostname: site.hostname, verified: site.verified, grades });
  }
  return planted;
}
