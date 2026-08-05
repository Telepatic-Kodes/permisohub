import { expect, test, type Page } from '@playwright/test'

// ---------------------------------------------------------------------------
// Smoke de las rutas de DETALLE. Requiere BYPASS_AUTH=true en .env.local.
//
// POR QUÉ EXISTE: el 04-08, extender un gráfico al tab Posicionamiento rompió
// /mercado-inmobiliario/oportunidades/[id] con un 500 — se le pasaba una
// función (`formatValor`) desde un Server Component a un Client Component,
// ilegal en RSC. `tsc --noEmit` pasó limpio y los 302 tests unitarios también:
// TypeScript no tiene forma de expresar "este valor no sobrevive la
// serialización RSC". Solo lo cazó abrir la página en un navegador.
//
// De ahí el diseño de estos tests: no alcanza con afirmar que un texto
// aparece. Hay que afirmar (a) que la respuesta HTTP no es 5xx y (b) que no
// hubo errores de consola — que es como se manifiesta esa clase de bug.
//
// Las rutas de detalle se alcanzan navegando desde el listado y clickeando el
// primer ítem, en vez de hardcodear IDs: no depende de que un registro
// concreto siga existiendo en la base, y de paso ejercita el flujo real.
// ---------------------------------------------------------------------------

/** Ruido conocido del entorno de dev, sin relación con el código de la app. */
const RUIDO_ESPERADO = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[HMR\]/i,
  /was preloaded using link preload/i,
  /Warning: .*validateDOMNesting/i,
]

function esRuido(texto: string): boolean {
  return RUIDO_ESPERADO.some((re) => re.test(texto))
}

/**
 * Engancha los colectores ANTES de navegar y devuelve las listas, que se van
 * llenando durante la navegación.
 */
function observar(page: Page) {
  const erroresConsola: string[] = []
  const respuestasServidor: string[] = []

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const texto = msg.text()
    if (!esRuido(texto)) erroresConsola.push(texto)
  })

  page.on('pageerror', (err) => {
    erroresConsola.push(`pageerror: ${err.message}`)
  })

  page.on('response', (res) => {
    // Solo documentos y llamadas a la API propia — no assets ni terceros.
    const url = res.url()
    const esPropia = url.includes('localhost') || url.startsWith('/')
    if (esPropia && res.status() >= 500) {
      respuestasServidor.push(`${res.status()} ${url}`)
    }
  })

  return { erroresConsola, respuestasServidor }
}

function assertSano(
  ctx: { erroresConsola: string[]; respuestasServidor: string[] },
  ruta: string
) {
  expect(ctx.respuestasServidor, `${ruta} devolvió 5xx`).toEqual([])
  expect(ctx.erroresConsola, `${ruta} tiró errores de consola`).toEqual([])
}

// ── Listados: baratos y cubren el grueso de la navegación ──────────────────

const LISTADOS = [
  '/dashboard',
  '/terrenos',
  '/mercado-inmobiliario/oportunidades',
  '/mercado-inmobiliario/pricing',
  '/proyectos',
]

for (const ruta of LISTADOS) {
  test(`listado sin 5xx ni errores de consola: ${ruta}`, async ({ page }) => {
    const ctx = observar(page)
    const res = await page.goto(ruta)

    expect(res?.status(), `${ruta} no respondió 200`).toBeLessThan(400)
    await page.waitForLoadState('networkidle')
    assertSano(ctx, ruta)
  })
}

// ── Detalle: donde efectivamente rompió ────────────────────────────────────

test('detalle de terreno abre desde el listado, sin 5xx ni errores', async ({ page }) => {
  const ctx = observar(page)

  await page.goto('/terrenos')
  await page.waitForLoadState('networkidle')

  // Se excluye /terrenos/nuevo por href y no por texto: el link de "Nuevo" del
  // sidebar no siempre expone esa palabra como texto accesible.
  const primero = page.locator('a[href^="/terrenos/"]:not([href="/terrenos/nuevo"])').first()
  if ((await primero.count()) === 0) {
    test.skip(true, 'sin terrenos en la base — nada que abrir')
    return
  }

  await primero.click()
  await page.waitForURL(/\/terrenos\/[0-9a-f-]{36}/)
  await page.waitForLoadState('networkidle')

  // Aserción POSITIVA: que exista contenido real de la ficha. Chequear solo
  // la AUSENCIA de "Cargando terreno…" pasaría igual con una página en 500,
  // donde tampoco está ese texto.
  await expect(
    page.getByRole('heading').first(),
    'la ficha no renderizó — probablemente 500 o crash de render'
  ).toBeVisible()
  await expect(page.getByText('Cargando terreno…')).toHaveCount(0)
  assertSano(ctx, '/terrenos/[id]')
})

test('detalle de oportunidad abre y recorre TODOS los tabs, sin 5xx ni errores', async ({ page }) => {
  const ctx = observar(page)

  await page.goto('/mercado-inmobiliario/oportunidades')
  await page.waitForLoadState('networkidle')

  const primera = page.locator('a[href^="/mercado-inmobiliario/oportunidades/"]').first()
  if ((await primera.count()) === 0) {
    test.skip(true, 'sin oportunidades en la base — nada que abrir')
    return
  }

  await primera.click()
  await page.waitForURL(/\/oportunidades\/[0-9a-f-]{36}/)
  await page.waitForLoadState('networkidle')

  // Aserción POSITIVA antes de cualquier bucle. La primera versión de este
  // test recorría los tabs con `if (count === 0) continue` y llamaba a
  // assertSano SOLO adentro del bucle: cuando la página tiraba 500 no había
  // ningún tab, las tres iteraciones hacían continue y el test pasaba sin
  // evaluar una sola aserción. Un smoke que puede pasar por no hacer nada es
  // peor que no tenerlo, porque además da confianza.
  await expect(
    page.getByRole('tab', { name: 'Posicionamiento' }),
    'la ficha no renderizó sus tabs — probablemente 500 o crash de render'
  ).toBeVisible()

  assertSano(ctx, '/oportunidades/[id] · carga inicial')

  // Recorrer los tabs es el punto: el 500 del 04-08 vivía dentro de
  // Posicionamiento, y un smoke que solo abriera la página sin tocarlos igual
  // lo habría dejado pasar si el tab por defecto fuera otro.
  for (const tab of ['Posicionamiento', 'Historial', 'Comparables']) {
    await page.getByRole('tab', { name: tab }).click()
    await page.waitForLoadState('networkidle')
    assertSano(ctx, `/oportunidades/[id] · tab ${tab}`)
  }
})
