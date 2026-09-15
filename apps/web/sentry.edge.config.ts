// Runs on the Edge runtime (middleware, edge route handlers) — this project
// has no middleware.ts today, but Next.js still loads this file if present.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  tracesSampleRate: 0.1,
});
