-- Confirming your email became required on 6 October 2026. Accounts made before then count as
-- confirmed, so nobody who already uses Sentry is locked out.
UPDATE "user" SET "email_verified" = true WHERE "email_verified" = false;
