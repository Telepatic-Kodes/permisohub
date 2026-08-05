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

  // Esperar a que la tabla pinte antes de contar. `networkidle` no alcanza:
  // el listado hidrata y pinta las filas después, así que contar de una daba
  // 0 y el test se AUTO-SALTEABA en silencio (visto en vivo: una corrida
  // "passed", la siguiente "skipped", sin cambiar nada). Un test que se saltea
  // solo protege tan poco como uno que pasa sin afirmar nada — y encima no se
  // nota, porque el reporte no sale en rojo.
  try {
    await primero.waitFor({ state: 'attached', timeout: 15_000 })
  } catch {
    test.skip(true, 'sin terrenos en la base — nada que abrir')
    return
  }

  await primero.click()
  await page.waitForURL(/\/terrenos\/[0-9a-f-]{36}/)
  await page.waitForLoadState('networkidle')

  // Primero esperar a que SALGA del estado de carga, con holgura: la ficha
  // encadena varios fetches del lado del cliente (zonificación, demografía,
  // isócrona real) y en dev pasa de los 5s por defecto de expect. Sin esta
  // espera el test falla intermitente con "la ficha no renderizó", que se lee
  // como crash cuando en realidad solo estaba cargando.
  await expect(page.getByText('Cargando terreno…')).toHaveCount(0, { timeout: 30_000 })

  // Recién ahora la aserción POSITIVA: que exista contenido real. Chequear
  // solo la AUSENCIA del texto de carga pasaría igual con una página en 500,
  // donde tampoco está ese texto.
  await expect(
    page.getByRole('heading').first(),
    'la ficha no renderizó — probablemente 500 o crash de render'
  ).toBeVisible()
  assertSano(ctx, '/terrenos/[id]')
})

test('detalle de oportunidad abre y recorre TODOS los tabs, sin 5xx ni errores', async ({ page }) => {
  const ctx = observar(page)

  await page.goto('/mercado-inmobiliario/oportunidades')
  await page.waitForLoadState('networkidle')

  // Mismo criterio que el test de terreno: esperar a que la fila exista antes
  // de clickear. Contar de una devolvía 0 con el listado a medio pintar, y el
  // click sobre nada dejaba a waitForURL esperando hasta agotar el timeout de
  // 60s — que se reporta como "timeout" y parece lentitud de la app, no un
  // defecto del test.
  // Se exige href con UUID, no solo el prefijo: el listado también linkea
  // sub-rutas como /oportunidades/comparar, y clickear ESA dejaba a
  // waitForURL esperando una ficha que nunca llegaba. Idéntico al caso de
  // expediente.smoke con /proyectos/zonificacion — el listado y sus
  // herramientas comparten prefijo, así que el prefijo no alcanza como filtro.
  const candidatas = page.locator('a[href^="/mercado-inmobiliario/oportunidades/"]')
  try {
    await candidatas.first().waitFor({ state: 'attached', timeout: 15_000 })
  } catch {
    test.skip(true, 'sin oportunidades en la base — nada que abrir')
    return
  }
  let primera: ReturnType<typeof candidatas.nth> | null = null
  const total = await candidatas.count()
  for (let i = 0; i < total; i++) {
    const href = await candidatas.nth(i).getAttribute('href')
    if (href && /\/oportunidades\/[0-9a-f-]{36}$/.test(href)) {
      primera = candidatas.nth(i)
      break
    }
  }
  if (!primera) {
    test.skip(true, 'sin fichas de oportunidad en el listado')
    return
  }

  await primera.click()
  await page.waitForURL(/\/oportunidades\/[0-9a-f-]{36}/, { timeout: 30_000 })
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
