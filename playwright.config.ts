import { defineConfig } from '@playwright/test'

// Smoke E2E contra el dev server local (npm run dev -- -p 3080, con
// .env.local configurado). Reutiliza el server si ya está corriendo.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3080',
  },
  webServer: {
    command: 'npx next dev --webpack -p 3080',
    url: 'http://localhost:3080',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
