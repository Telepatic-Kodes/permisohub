import { defineConfig } from '@playwright/test'

// Smoke E2E contra el dev server local (npm run dev -- -p 3080, con
// .env.local configurado). Reutiliza el server si ya está corriendo.
// Si E2E_BASE_URL viene seteada, se corre contra ESE server y no se levanta
// ninguno: `next dev` se niega a arrancar si ya hay otro dev server vivo, así
// que sin esto no se puede correr el smoke con el server de desarrollo
// habitual abierto — que es justo el caso normal mientras se programa.
const baseURLExterna = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  // Un solo worker: estos smokes apuntan a un `next dev`, que compila rutas
  // bajo demanda en un solo proceso. Con los 5 workers por defecto el server
  // se satura y tira ERR_CONNECTION_RESET — fallas que parecen bugs de la app
  // y no lo son. Secuencial es además más rápido acá, porque no se pelean por
  // la misma compilación.
  workers: 1,
  use: {
    baseURL: baseURLExterna ?? 'http://localhost:3080',
  },
  ...(baseURLExterna
    ? {}
    : {
        webServer: {
          command: 'npx next dev --webpack -p 3080',
          url: 'http://localhost:3080',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
})
