import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * The PRD's success path, in a real browser: sign up → light check → add the website and prove
 * it's yours → full check finds the exposed file → the reports are saved and reopen.
 * bakery.test is the pretend website from e2e/fixture-site.ts.
 */
const SITE = 'bakery.test';
const TXT_FILE = path.resolve(import.meta.dirname, '.tmp/txt.json');
const OUTBOX = path.resolve(import.meta.dirname, '.tmp/outbox.jsonl');

/** The link in the newest email to this address (the test server writes emails to OUTBOX). */
function emailedLink(to: string): string {
  const lines = fs.readFileSync(OUTBOX, 'utf8').trim().split('\n');
  const emails = lines.map((line) => JSON.parse(line) as { to: string; text: string });
  const text = emails.findLast((e) => e.to === to)?.text ?? '';
  return text.match(/https?:\/\/\S+/)![0];
}

test('sign up, check, verify, full check, reopen the report', async ({ page }) => {
  // Sign up.
  await page.goto('/sign-up');
  await page.getByLabel('Your name').fill('Ada Baker');
  const email = `ada+${Date.now()}@bakery.test`;
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill('fresh-loaves-every-morning');
  await page.getByRole('checkbox', { name: /only scan websites I own/ }).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  // Confirm the email: the link signs in and opens Home.
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.goto(emailedLink(email));
  await expect(page).toHaveURL(/\/home$/);

  // A light check of a website not yet proven: no private files.
  await page.getByLabel('Your website’s domain').fill(SITE);
  await page.getByRole('button', { name: 'Check website' }).click();
  const report = page.getByRole('region', { name: `Scan report for ${SITE}` });
  await expect(report.getByText('Light check', { exact: true })).toBeVisible();
  await expect(report.getByText('Private files weren’t checked')).toBeVisible();
  await expect(report.getByText('Your private settings file is public')).toHaveCount(0);

  // Prove it's yours: "publish" the line shown on the page, then check.
  await report.getByRole('button', { name: 'Verify ownership' }).click();
  await expect(page).toHaveURL(new RegExp(`/websites/${SITE}$`));
  await expect(page.getByRole('heading', { name: `Prove ${SITE} is yours` })).toBeVisible();
  const value = (await page.locator('code', { hasText: 'sentry-verify=' }).textContent())!.trim();
  expect(value).toMatch(/^sentry-verify=[0-9a-f]{16}$/);

  // Before the line is there: "not yet".
  await page.getByRole('button', { name: 'Check now' }).click();
  await expect(page.getByText('We can’t see the line yet.')).toBeVisible();

  fs.writeFileSync(TXT_FILE, JSON.stringify({ [SITE]: [value] }));
  await page.getByRole('button', { name: 'Check now' }).click();
  await expect(page.getByRole('heading', { name: `${SITE} is verified` })).toBeVisible();

  // The full check finds the exposed .env file.
  await page.getByRole('button', { name: 'Run the full check' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(report.getByRole('heading', { name: 'Your private settings file is public' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(report.getByText('Light check', { exact: true })).toHaveCount(0);
  // (The summary is in the page twice, laid out for desktop and for phones; one is visible.)
  await expect(report.getByText(/^Your site scored an? [DF]\./).filter({ visible: true })).toBeVisible();

  // The full check is compared with the light one before it.
  await expect(report.getByText(/^Since your last check/)).toBeVisible();

  // The website's own page: score over time and both checks.
  await page.goto(`/websites/${SITE}`);
  await expect(page.getByRole('heading', { name: SITE, level: 1 })).toBeVisible();
  await expect(page.getByText('Verified · gets the full check')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score over time' })).toBeVisible();
  await expect(page.getByRole('group', { name: `Score over time for ${SITE}` }).getByRole('link')).toHaveCount(2);
  const checks = page.getByRole('region', { name: `All checks of ${SITE}` });
  await expect(checks.getByRole('link', { name: /^View report/ })).toHaveCount(2);
  await expect(checks.getByText('First check')).toBeVisible();

  // Both checks are saved and reopen on their own page.
  await page.getByRole('navigation', { name: 'App' }).getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByRole('link', { name: /^View report/ })).toHaveCount(2);
  await page.getByRole('link', { name: /^View report/ }).first().click();
  await expect(page.getByRole('heading', { name: SITE, level: 1 })).toBeVisible();
  await expect(page.getByText(/· Full check ·/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your private settings file is public' })).toBeVisible();
});
