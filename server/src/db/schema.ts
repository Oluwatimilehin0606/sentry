import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Better Auth core tables (matches better-auth 1.7 core schema)       */
/* ------------------------------------------------------------------ */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** When the user agreed to only scan domains they own or may test. */
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* Sentry tables                                                       */
/* ------------------------------------------------------------------ */

export const rescanInterval = pgEnum('rescan_interval', ['none', 'weekly', 'monthly']);
export const scanStatus = pgEnum('scan_status', ['queued', 'running', 'done', 'failed']);
export const scanTrigger = pgEnum('scan_trigger', ['manual', 'scheduled']);
export const findingStatus = pgEnum('finding_status', ['pass', 'fail']);
export const severity = pgEnum('severity', ['critical', 'medium', 'low', 'info']);

export const domains = pgTable(
  'domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull(),
    verifyToken: text('verify_token').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    rescanInterval: rescanInterval('rescan_interval').notNull().default('none'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('domains_user_hostname_uq').on(t.userId, t.hostname)],
);

export const scanMode = pgEnum('scan_mode', ['full', 'light']);

/**
 * One check of one website by one account. Light checks can be of any website, so a scan
 * belongs to its user and hostname; domainId links it to the account's website when there is one.
 */
export const scans = pgTable(
  'scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull(),
    domainId: uuid('domain_id').references(() => domains.id, { onDelete: 'set null' }),
    mode: scanMode('mode').notNull(),
    status: scanStatus('status').notNull().default('queued'),
    trigger: scanTrigger('trigger').notNull().default('manual'),
    score: integer('score'),
    grade: text('grade'),
    finalUrl: text('final_url'),
    durationMs: integer('duration_ms'),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('scans_domain_created_idx').on(t.domainId, t.createdAt),
    index('scans_user_created_idx').on(t.userId, t.createdAt),
    index('scans_user_hostname_created_idx').on(t.userId, t.hostname, t.createdAt),
  ],
);

export const findings = pgTable(
  'findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => scans.id, { onDelete: 'cascade' }),
    checkId: text('check_id').notNull(),
    status: findingStatus('status').notNull(),
    severity: severity('severity').notNull(),
    evidence: jsonb('evidence'),
  },
  (t) => [index('findings_scan_id_idx').on(t.scanId)],
);
