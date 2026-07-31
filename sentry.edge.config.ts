import * as Sentry from '@sentry/nextjs'

// Config para el runtime Edge (ej. middleware). Mismo comportamiento no-op
// sin SENTRY_DSN que sentry.server.config.ts.
const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
