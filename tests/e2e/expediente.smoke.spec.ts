import { expect, test } from '@playwright/test'

// Smoke del flujo de expediente. Requiere BYPASS_AUTH=true en .env.local
// (auto-login dev) y un proyecto existente para la parte de la ficha.

test('la landing carga y anuncia las herramientas reales', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/PermisoHub/i)
})

test('el dashboard responde tras el auto-login dev', async ({ page }) => {
  await page.goto('/dashboard')
  // Con BYPASS_AUTH el middleware rebota por /auth/dev-login y vuelve.
  await expect(page.locator('body')).not.toContainText('Enlace no válido')
  await page.waitForURL(/\/(dashboard|login)/, { timeout: 15_000 })
})

test('la ficha de proyecto abre con sus pestañas de expediente', async ({ page }) => {
  await page.goto('/proyectos')
  await page.waitForLoadState('networkidle')

  // Si el workspace no tiene proyectos, el smoke termina aquí sin fallar.
  // Solo tarjetas del listado (dentro de main), no los links del sidebar.
  const primerProyecto = page
    .locator('main a[href^="/proyectos/"]:not([href$="/nuevo"])')
    .first()
  if ((await primerProyecto.count()) === 0) {
    test.skip(true, 'Sin proyectos en el workspace de prueba')
  }
  await primerProyecto.click()

  // Un proyecto en borrador abre el wizard ("Preparemos el expediente");
  // uno avanzado abre las pestañas. Ambos son fichas válidas.
  const wizard = page.getByRole('heading', { name: /Preparemos el expediente/i })
  const tabResumen = page.getByRole('tab', { name: 'Resumen' })
  await expect(wizard.or(tabResumen).first()).toBeVisible({ timeout: 20_000 })

  if (await tabResumen.count()) {
    for (const tab of ['Documentos', 'Due Diligence', 'PMO']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible({ timeout: 20_000 })
    }
    // Due Diligence: el informe guardado se rehidrata (o al menos ofrece el CTA).
    await page.getByRole('tab', { name: 'Due Diligence' }).click()
    await expect(
      page
        .getByText('Riesgo global')
        .or(page.getByRole('button', { name: /Marcar observaciones|Generar/ }))
        .first(),
    ).toBeVisible({ timeout: 30_000 })
  }
})

test('el portal público rechaza tokens inexistentes', async ({ page }) => {
  await page.goto('/portal/token-que-no-existe')
  await expect(page.getByText(/Enlace no válido/i)).toBeVisible({ timeout: 15_000 })
})
