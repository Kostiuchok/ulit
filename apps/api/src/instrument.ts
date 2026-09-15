// Must be imported before any other module (see src/index.ts) so Sentry's
// auto-instrumentation can hook into http/Prisma before they're required.
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
});
