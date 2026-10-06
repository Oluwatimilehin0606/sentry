import { config } from 'zod';

// Zod (form checking) tests at start-up whether it may build fast checkers with `new Function`.
// Sentry's Content-Security-Policy forbids that, and browsers report the blocked test as a security
// problem even though Zod catches it. Turning the test off removes the report; checks work the same.
// Imported first in main.tsx, before any form defines its rules.
config({ jitless: true });
