import { expect, test } from '@playwright/test'

// Smoke del rediseño de separación Permisos vs. Mercado Inmobiliario.
// Requiere BYPASS_AUTH=true en .env.local (auto-login dev).

test('el switcher navega de verdad y cambia el sidebar', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Mercado' }).click()
  await page.waitForURL(/\/mercado-inmobiliario\/pricing/)

  await expect(page.locator('nav').getByRole('link', { name: 'Oportunidades', exact: true })).toBeVisible()
  await expect(page.locator('nav').getByRole('link', { name: 'Terrenos', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Permisos' }).click()
  await page.waitForURL(/\/dashboard/)

  await expect(page.locator('nav').getByRole('link', { name: 'Terrenos', exact: true })).toBeVisible()
  await expect(page.locator('nav').getByRole('link', { name: 'Oportunidades', exact: true })).toHaveCount(0)
})

test('el estado activo es correcto al navegar directo, sin click', async ({ page }) => {
  await page.goto('/mercado-inmobiliario/oportunidades')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Mercado' })).toBeVisible()
  await expect(page.locator('nav').getByRole('link', { name: 'Oportunidades', exact: true })).toBeVisible()
})

test('el badge de módulo aparece en ambos lados y no en el hub compartido', async ({ page }) => {
  await page.goto('/terrenos')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Permisos', { exact: true }).first()).toBeVisible()

  await page.goto('/mercado-inmobiliario/pricing')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Mercado Inmobiliario', { exact: true }).first()).toBeVisible()

  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')
  // El hub compartido no debe mostrar ningún badge de módulo en su encabezado.
  // Se acota al div MÁS INTERNO que contiene el h1: el locator anterior
  // (`main > div` primero) abarcaba todo el contenido, así que empezó a fallar
  // cuando el dashboard sumó el panel de "Mercado Inmobiliario" — panel que el
  // test siguiente justamente exige que exista. El test medía el encabezado,
  // no la página entera.
  const header = page
    .locator('main div')
    .filter({ has: page.getByRole('heading', { level: 1 }) })
    .last()
  await expect(header.getByText('Permisos', { exact: true })).toHaveCount(0)
  await expect(header.getByText('Mercado Inmobiliario', { exact: true })).toHaveCount(0)
})

test('el hub /dashboard es ancho y muestra el panel de Mercado con datos reales', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('Mercado Inmobiliario', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('UF hoy')).toBeVisible()
  await expect(page.getByText('Comunas c/ IPT')).toBeVisible()

  await page.getByRole('link', { name: /Pricing/ }).click()
  await page.waitForURL(/\/mercado-inmobiliario\/pricing/)
})

test('el sidebar colapsado mantiene el switcher funcional', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Colapsar sidebar' }).click()
  const switcherMercado = page.getByRole('button', { name: 'Mercado Inmobiliario' })
  await expect(switcherMercado).toBeVisible()
  await switcherMercado.click()
  await page.waitForURL(/\/mercado-inmobiliario\/pricing/)
})
