// Runs once in the browser. No-ops when NEXT_PUBLIC_SENTRY_DSN isn't set
// (e.g. local dev), so nothing to guard here.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
});
