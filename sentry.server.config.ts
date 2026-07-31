import * as Sentry from '@sentry/nextjs'

// Sin SENTRY_DSN, Sentry.init() nunca se llama: el SDK queda sin cliente y
// todas las llamadas a captureException/captureMessage son no-op seguros.
// Pasos para activar en producción: crear proyecto en sentry.io → setear
// SENTRY_DSN en Vercel (Production) → redeploy.
const dsn = process.env.SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
}
