import * as Sentry from '@sentry/nextjs'

// Se ejecuta una vez por instancia de servidor (Node y Edge). Carga la config
// de Sentry correspondiente al runtime — ambas son no-op si SENTRY_DSN no
// está configurado (ver sentry.server.config.ts / sentry.edge.config.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captura errores no manejados de Route Handlers / Server Components / Server
// Actions. Sin SENTRY_DSN configurado esto es un no-op seguro (SDK sin cliente
// inicializado).
export const onRequestError = Sentry.captureRequestError
