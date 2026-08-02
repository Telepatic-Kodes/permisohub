import { createServiceClient } from '@/lib/supabase/service'
import { obtenerValorUF } from '@/lib/scrapers/terrenos-common'
import { normalizarNombreComuna } from '@/lib/scrapers/instrumentos-ipt'
import { reportWarning } from '@/lib/observability'
import {
  MERCADO_LOCALES_COMUNA_SLUGS,
  upsertMercadoLocalesDesdeListado,
  TIPO_PROPIEDAD_DEFAULT,
  type OperacionMercadoLocal,
  type MercadoLocalListadoRaw,
  type TipoPropiedadComercial,
} from '@/lib/scrapers/mercado-locales-common'

// Reportes de Mercado recibe la comuna como texto libre (a diferencia de
// Pricing, que usa un <Select> sobre este mismo universo) — un typo o
// diferencia de mayúsculas/tildes ("providencia", "Las condes") no calzaba
// con el .eq('comuna', ...) exacto de abajo y caía en silencio a la banda
// citywide de respaldo. Resuelve cualquier variante normalizada al nombre
// canónico real antes de consultar; si no hay match conocido, se deja tal
// cual (mismo comportamiento que antes para nombres ya canónicos).
const COMUNA_CANONICA_POR_NORMALIZADA = new Map(
  Object.keys(MERCADO_LOCALES_COMUNA_SLUGS).map((nombre) => [normalizarNombreComuna(nombre), nombre]),
)

function resolverComunaCanonica(comuna: string): string {
  return COMUNA_CANONICA_POR_NORMALIZADA.get(normalizarNombreComuna(comuna)) ?? comuna
}

// ---------------------------------------------------------------------------
// Orquestación del pipeline de mercado de locales comerciales — fase 1 de la
// fusión PROPRA·BI → PermisoHub. Mirror funcional de lib/terrenos-server.ts +
// (del repo origen) lib/market-stats.ts, pero sobre datos GLOBALES (sin
// workspace_id): correrDescubrimientoMercadoLocales() NO recibe workspaceId,
// a diferencia de correrDescubrimientoTerrenos.
// ---------------------------------------------------------------------------

const OPERACIONES: OperacionMercadoLocal[] = ['arriendo', 'venta']

// Fase 7 (ago. 2026): la cobertura de comunas pasó de 16 a 36 (ver
// MERCADO_LOCALES_COMUNA_SLUGS) — con el loop secuencial original, el peor
// caso (varias comunas lentas agotando el timeout de 20s del fetch) podía
// superar el maxDuration=180s de la función serverless del cron. CONCURRENCIA
// acota el paralelismo real de comuna×operación por tanda, para mantener el
// tiempo total dentro del presupuesto sin lanzar todas las requests a la vez
// (que se vería como ráfaga ante Portalinmobiliario, sin rate-limiting propio
// documentado — ver hallazgo del benchmark de Fase 7).
const CONCURRENCIA = 10

async function enTandas<T, R>(items: T[], tamanoTanda: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = []
  for (let i = 0; i < items.length; i += tamanoTanda) {
    const tanda = items.slice(i, i + tamanoTanda)
    resultados.push(...(await Promise.all(tanda.map(fn))))
  }
  return resultados
}

// Bajo este tamaño de muestra, los percentiles de la comuna son demasiado
// ruidosos para confiar en ellos — el path de lectura cae al rollup
// citywide '__TODAS__'. Mismo umbral que el repo origen (MIN_COHORT_SIZE).
const MIN_COHORT_SIZE = 15

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface ResultadoDescubrimientoMercadoLocales {
  comunasBuscadas: number
  encontrados: number
  guardados: number
  dadosDeBaja: number
  errors: string[]
}

/**
 * Busca locales comerciales para todas las comunas de
 * MERCADO_LOCALES_COMUNA_SLUGS × ambas operaciones, y hace upsert
 * deduplicado en mercado_locales_listings. Sin workspaceId — este dataset es
 * global, no per-tenant.
 */
export async function correrDescubrimientoMercadoLocales(
  buscarLocalesComerciales: (comuna: string, operacion: OperacionMercadoLocal) => Promise<MercadoLocalListadoRaw[]>,
): Promise<ResultadoDescubrimientoMercadoLocales> {
  const comunas = Object.keys(MERCADO_LOCALES_COMUNA_SLUGS)
  const pares = comunas.flatMap((comuna) => OPERACIONES.map((operacion) => ({ comuna, operacion })))
  const resultado: ResultadoDescubrimientoMercadoLocales = {
    comunasBuscadas: 0,
    encontrados: 0,
    guardados: 0,
    dadosDeBaja: 0,
    errors: [],
  }

  await enTandas(pares, CONCURRENCIA, async ({ comuna, operacion }) => {
    resultado.comunasBuscadas++
    try {
      const items = await buscarLocalesComerciales(comuna, operacion)
      resultado.encontrados += items.length
      if (items.length === 0) return

      const summary = await upsertMercadoLocalesDesdeListado(comuna, operacion, items)
      resultado.guardados += summary.nuevos + summary.actualizados
      resultado.dadosDeBaja += summary.dadosDeBaja
    } catch (err) {
      resultado.errors.push(`${comuna}/${operacion}: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  return resultado
}

/**
 * Recalcula y persiste las bandas P25/mediana/P75 del día para cada
 * comuna×operación cubierta, más un rollup citywide '__TODAS__' por
 * operación — llama a la función SQL calcular_bandas_mercado_locales() vía
 * RPC (percentile_cont no tiene equivalente directo en supabase-js).
 *
 * Fase 8: acepta tipoPropiedad/comunas opcionales para reusar esta misma
 * función desde el cron de tipos adicionales (oficina/bodega/industrial) sin
 * duplicar la lógica — el cron diario original la sigue llamando sin opts,
 * comportamiento idéntico (local_comercial, las 36 comunas).
 */
export async function computarYPersistirBandasMercadoLocales(
  ufHoy: number,
  opts: { tipoPropiedad?: TipoPropiedadComercial; comunas?: string[] } = {},
): Promise<{ filasEscritas: number }> {
  const supabase = createServiceClient()
  const statsDate = hoyIso()
  const tipoPropiedad = opts.tipoPropiedad ?? TIPO_PROPIEDAD_DEFAULT
  const comunas = opts.comunas ?? Object.keys(MERCADO_LOCALES_COMUNA_SLUGS)

  const targets = OPERACIONES.flatMap((operacion) =>
    [...comunas, null].map((comuna) => ({ comuna, operacion })), // null → rollup '__TODAS__'
  )

  const resultados = await enTandas(targets, CONCURRENCIA, async ({ comuna, operacion }) => {
    const { data, error } = await supabase.rpc('calcular_bandas_mercado_locales', {
      p_comuna: comuna,
      p_operacion: operacion,
      p_uf_valor: ufHoy,
      p_tipo_propiedad: tipoPropiedad,
    })
    if (error) throw new Error(`calcular_bandas_mercado_locales falló para ${comuna ?? '__TODAS__'}/${operacion}/${tipoPropiedad}: ${error.message}`)

    const raw = Array.isArray(data) ? data[0] : data

    const { error: upsertError } = await supabase.from('mercado_locales_stats_diarias').upsert(
      {
        stats_date: statsDate,
        comuna: comuna ?? '__TODAS__',
        tipo_propiedad: tipoPropiedad,
        operacion,
        muestra_n: raw?.muestra_n ?? 0,
        mediana_uf: raw?.mediana_uf ?? null,
        p25_uf: raw?.p25_uf ?? null,
        p75_uf: raw?.p75_uf ?? null,
        muestra_area_n: raw?.muestra_area_n ?? 0,
        mediana_uf_m2: raw?.mediana_uf_m2 ?? null,
        p25_uf_m2: raw?.p25_uf_m2 ?? null,
        p75_uf_m2: raw?.p75_uf_m2 ?? null,
        uf_valor_usado: ufHoy,
        capturado_el: new Date().toISOString(),
      },
      { onConflict: 'stats_date,comuna,tipo_propiedad,operacion', ignoreDuplicates: false },
    )
    if (upsertError) throw new Error(`upsert de mercado_locales_stats_diarias falló: ${upsertError.message}`)
    return 1
  })

  return { filasEscritas: resultados.reduce((a, b) => a + b, 0) }
}

/**
 * Fase 8: busca oficina/bodega/industrial para las comunas indicadas ×
 * ambas operaciones, y hace upsert — mismo patrón de tandas concurrentes que
 * correrDescubrimientoMercadoLocales, corre desde un cron/ruta separado para
 * no sumar su presupuesto de tiempo/requests al del cron original de
 * local_comercial.
 */
export async function correrDescubrimientoTiposComercialesAdicionales(
  comunas: string[],
  tipos: TipoPropiedadComercial[],
  buscarPropiedadComercial: (
    comuna: string,
    operacion: OperacionMercadoLocal,
    tipoPropiedad: TipoPropiedadComercial,
  ) => Promise<MercadoLocalListadoRaw[]>,
): Promise<ResultadoDescubrimientoMercadoLocales> {
  const pares = tipos.flatMap((tipoPropiedad) =>
    comunas.flatMap((comuna) => OPERACIONES.map((operacion) => ({ comuna, operacion, tipoPropiedad }))),
  )
  const resultado: ResultadoDescubrimientoMercadoLocales = {
    comunasBuscadas: 0,
    encontrados: 0,
    guardados: 0,
    dadosDeBaja: 0,
    errors: [],
  }

  await enTandas(pares, CONCURRENCIA, async ({ comuna, operacion, tipoPropiedad }) => {
    resultado.comunasBuscadas++
    try {
      const items = await buscarPropiedadComercial(comuna, operacion, tipoPropiedad)
      resultado.encontrados += items.length
      if (items.length === 0) return

      const summary = await upsertMercadoLocalesDesdeListado(comuna, operacion, items, tipoPropiedad)
      resultado.guardados += summary.nuevos + summary.actualizados
      resultado.dadosDeBaja += summary.dadosDeBaja
    } catch (err) {
      resultado.errors.push(`${comuna}/${operacion}/${tipoPropiedad}: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  return resultado
}

export interface BandasMercadoLocal {
  comuna: string
  operacion: OperacionMercadoLocal
  statsDate: string
  muestraN: number
  medianaUf: number | null
  p25Uf: number | null
  p75Uf: number | null
  muestraAreaN: number
  medianaUfM2: number | null
  p25UfM2: number | null
  p75UfM2: number | null
  ufValorUsado: number
  usoFallback: boolean
  muestraNComuna: number
}

type FilaStats = {
  comuna: string
  operacion: string
  stats_date: string
  muestra_n: number
  mediana_uf: number | null
  p25_uf: number | null
  p75_uf: number | null
  muestra_area_n: number
  mediana_uf_m2: number | null
  p25_uf_m2: number | null
  p75_uf_m2: number | null
  uf_valor_usado: number
}

function aBandas(fila: FilaStats, usoFallback: boolean, muestraNComuna: number): BandasMercadoLocal {
  return {
    comuna: fila.comuna,
    operacion: fila.operacion as OperacionMercadoLocal,
    statsDate: fila.stats_date,
    muestraN: fila.muestra_n,
    medianaUf: fila.mediana_uf,
    p25Uf: fila.p25_uf,
    p75Uf: fila.p75_uf,
    muestraAreaN: fila.muestra_area_n,
    medianaUfM2: fila.mediana_uf_m2,
    p25UfM2: fila.p25_uf_m2,
    p75UfM2: fila.p75_uf_m2,
    ufValorUsado: fila.uf_valor_usado,
    usoFallback,
    muestraNComuna,
  }
}

/**
 * Lee la última banda persistida para una comuna×operación, cayendo al
 * rollup '__TODAS__' cuando la muestra de la comuna es menor a
 * MIN_COHORT_SIZE (o cuando aún no hay ninguna fila para esa comuna).
 */
export async function obtenerBandasMercadoLocales(
  comunaEntrada: string,
  operacion: OperacionMercadoLocal,
  tipoPropiedad: TipoPropiedadComercial = TIPO_PROPIEDAD_DEFAULT,
): Promise<BandasMercadoLocal | null> {
  const comuna = resolverComunaCanonica(comunaEntrada)
  const supabase = createServiceClient()

  const { data: filaComuna } = await supabase
    .from('mercado_locales_stats_diarias')
    .select('*')
    .eq('comuna', comuna)
    .eq('operacion', operacion)
    .eq('tipo_propiedad', tipoPropiedad)
    .order('stats_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (filaComuna && filaComuna.muestra_n >= MIN_COHORT_SIZE) {
    return aBandas(filaComuna as FilaStats, false, filaComuna.muestra_n)
  }

  const { data: filaCiudad } = await supabase
    .from('mercado_locales_stats_diarias')
    .select('*')
    .eq('comuna', '__TODAS__')
    .eq('operacion', operacion)
    .eq('tipo_propiedad', tipoPropiedad)
    .order('stats_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!filaCiudad) return null
  return aBandas(filaCiudad as FilaStats, true, filaComuna?.muestra_n ?? 0)
}

/**
 * Serie histórica de mediana UF/m² para sparkline (KpiCard de Reportes de
 * Mercado). El motor de bandas corre a diario desde el 1 ago 2026 — hoy solo
 * hay 1 día de historia real por comuna, así que esto devuelve un array de
 * 0-1 puntos hasta que se acumulen más corridas. Nunca se infla ni se
 * inventa historia: KpiCard ya degrada con gracia (sin sparkline) si recibe
 * menos de 2 puntos.
 */
export async function obtenerHistorialMedianaUfM2(
  comunaEntrada: string,
  operacion: OperacionMercadoLocal,
  tipoPropiedad: TipoPropiedadComercial = TIPO_PROPIEDAD_DEFAULT,
  dias = 30,
): Promise<number[]> {
  const comuna = resolverComunaCanonica(comunaEntrada)
  const supabase = createServiceClient()

  // order ascending + limit traía los `dias` MÁS ANTIGUOS (Postgres aplica
  // ORDER BY antes de LIMIT) — una vez que el historial supera `dias` filas,
  // el sparkline queda congelado para siempre en esa ventana inicial en vez
  // de reflejar movimiento reciente. Se pide descendente (más nuevo primero)
  // y se revierte en memoria para mantener el orden cronológico esperado.
  const { data } = await supabase
    .from('mercado_locales_stats_diarias')
    .select('mediana_uf_m2, stats_date')
    .eq('comuna', comuna)
    .eq('operacion', operacion)
    .eq('tipo_propiedad', tipoPropiedad)
    .order('stats_date', { ascending: false })
    .limit(dias)

  if (!data) return []
  return data
    .reverse()
    .map((f) => f.mediana_uf_m2)
    .filter((v): v is number => v !== null)
}

export interface OportunidadMercadoLocal {
  id: string
  titulo: string
  url: string
  comuna: string
  precioMonto: number
  precioMoneda: string
  superficieM2: number | null
  precioUfNormalizado: number
  precioUfM2Normalizado: number | null
  reasonCodes: string[]
}

/**
 * Fuente única de verdad para el scoring de "oportunidad" — extraída del
 * loop de obtenerOportunidadesMercadoLocales() para que la ficha de detalle
 * (Fase 13) y los comparables sugeridos puedan reproducir EXACTAMENTE los
 * mismos reasonCodes que la lista, en vez de reimplementar esta lógica y
 * arriesgar que ambas vistas diverjan con el tiempo.
 *
 * below_p25_ufm2 y below_p25_uf son mutuamente excluyentes a propósito
 * (else if, no dos ifs independientes) — preservado tal cual del código
 * original, NO "corregido" a checks independientes.
 */
export function evaluarOportunidad(params: {
  precioUf: number
  precioUfM2: number | null
  cohortP25Uf: number | null
  cohortP25UfM2: number | null
  historialReciente: { precio_monto: number; capturado_el: string }[]
}): string[] {
  const { precioUf, precioUfM2, cohortP25Uf, cohortP25UfM2, historialReciente } = params
  const reasonCodes: string[] = []

  if (precioUfM2 !== null && cohortP25UfM2 !== null && precioUfM2 <= cohortP25UfM2) {
    reasonCodes.push('below_p25_ufm2')
  } else if (cohortP25Uf !== null && precioUf <= cohortP25Uf) {
    reasonCodes.push('below_p25_uf')
  }

  if (historialReciente.length >= 2) {
    const last = historialReciente[historialReciente.length - 1]
    const prev = historialReciente[historialReciente.length - 2]
    if (last.precio_monto < prev.precio_monto) reasonCodes.push('price_drop_7d')
  }

  return reasonCodes
}

/**
 * Detección de oportunidades a tiempo de lectura (sin tabla precomputada) —
 * compara cada listing activo contra la banda P25 ya persistida de su
 * cohorte, más un escaneo de bajas de precio en los últimos 7 días sobre
 * mercado_locales_historial_precio. Port directo de getOpportunities del
 * repo origen (lib/market-stats.ts).
 */
const PAGE_SIZE = 1000
const MAX_PAGINAS_LISTINGS = 5 // tope de seguridad: 5.000 listings activos como mucho por corrida
const CHUNK_IN_LISTING_IDS = 200 // .in() con miles de uuids arma una URL GET demasiado larga

export async function obtenerOportunidadesMercadoLocales(
  operacion: OperacionMercadoLocal,
  opts: { comuna?: string; limit?: number; tipoPropiedad?: TipoPropiedadComercial } = {},
): Promise<OportunidadMercadoLocal[]> {
  const limit = opts.limit ?? 30
  const tipoPropiedad = opts.tipoPropiedad ?? TIPO_PROPIEDAD_DEFAULT
  const supabase = createServiceClient()

  // Acotado a los últimos 10 días (el cron escribe ~37 filas/día — 1 por
  // comuna+'__TODAS__' — así que 10 días cubre de sobra "la más reciente por
  // comuna" incluso si el cron se saltó un día) en vez de traer TODO el
  // historial acumulado sin filtro: sin este corte, una vez que el historial
  // supera 1000 filas (~27 días), el cap por defecto de PostgREST empezaba a
  // truncar en un orden no garantizado y algunas comunas podían quedar sin
  // su fila más reciente en `latestByComuna`.
  const diezDiasAtras = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: cohortRows, error: cohortError } = await supabase
    .from('mercado_locales_stats_diarias')
    .select('*')
    .eq('operacion', operacion)
    .eq('tipo_propiedad', tipoPropiedad)
    .gte('stats_date', diezDiasAtras)

  if (cohortError) {
    reportWarning('obtenerOportunidadesMercadoLocales: fallo leyendo cohortes — se continúa sin bandas', {
      scope: 'mercado-locales.oportunidades',
      extra: { operacion, tipoPropiedad, error: cohortError.message },
    })
  }

  const latestByComuna = new Map<string, FilaStats>()
  for (const row of (cohortRows ?? []) as FilaStats[]) {
    const existing = latestByComuna.get(row.comuna)
    if (!existing || row.stats_date > existing.stats_date) latestByComuna.set(row.comuna, row)
  }
  const cityCohort = latestByComuna.get('__TODAS__')

  // Paginado explícito en vez de una sola query sin límite: PostgREST corta
  // en 1000 filas por defecto, en un orden no garantizado — sin esto, la
  // llamada sin `comuna` (dashboard) perdía ~18% de los 1223 listings
  // activos reales al momento de esta corrección, de forma distinta en cada
  // llamada. Tope de MAX_PAGINAS_LISTINGS como backstop de seguridad, no un
  // corte silencioso: si se alcanza, queda una advertencia real en Sentry.
  const listings: { id: string; titulo: string; url: string; comuna: string; precio_monto: number | null; precio_moneda: string | null; superficie_m2: number | null }[] = []
  for (let pagina = 0; pagina < MAX_PAGINAS_LISTINGS; pagina++) {
    let listingsQuery = supabase
      .from('mercado_locales_listings')
      .select('id, titulo, url, comuna, precio_monto, precio_moneda, superficie_m2')
      .eq('status', 'activo')
      .eq('operacion', operacion)
      .eq('tipo_propiedad', tipoPropiedad)
      .order('id', { ascending: true })
      .range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE - 1)
    if (opts.comuna) listingsQuery = listingsQuery.eq('comuna', opts.comuna)

    const { data: pageData, error: listingsError } = await listingsQuery
    if (listingsError) {
      reportWarning('obtenerOportunidadesMercadoLocales: fallo leyendo listings activos', {
        scope: 'mercado-locales.oportunidades',
        extra: { operacion, tipoPropiedad, comuna: opts.comuna, pagina, error: listingsError.message },
      })
      break
    }
    listings.push(...(pageData ?? []))
    if (!pageData || pageData.length < PAGE_SIZE) break
    if (pagina === MAX_PAGINAS_LISTINGS - 1) {
      reportWarning('obtenerOportunidadesMercadoLocales: tope de paginación alcanzado — pueden quedar listings activos sin evaluar', {
        scope: 'mercado-locales.oportunidades',
        extra: { operacion, tipoPropiedad, comuna: opts.comuna, listingsLeidos: listings.length },
      })
    }
  }

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const listingIds = listings.map((l) => l.id)

  // .in() con hasta miles de uuids arma una URL GET que puede exceder el
  // límite del request-line y fallar entero — se trocea en tandas chicas.
  const historyByListing = new Map<string, { precio_monto: number; capturado_el: string }[]>()
  for (let i = 0; i < listingIds.length; i += CHUNK_IN_LISTING_IDS) {
    const lote = listingIds.slice(i, i + CHUNK_IN_LISTING_IDS)
    const { data: loteHistory, error: historyError } = await supabase
      .from('mercado_locales_historial_precio')
      .select('listing_id, precio_monto, capturado_el')
      .in('listing_id', lote)
      .gte('capturado_el', sevenDaysAgoIso)
      .order('capturado_el', { ascending: true })

    if (historyError) {
      reportWarning('obtenerOportunidadesMercadoLocales: fallo leyendo historial de precio — price_drop_7d no se detecta en este lote', {
        scope: 'mercado-locales.oportunidades',
        extra: { operacion, tipoPropiedad, loteDesde: i, error: historyError.message },
      })
      continue
    }

    for (const row of loteHistory ?? []) {
      const arr = historyByListing.get(row.listing_id) ?? []
      arr.push(row)
      historyByListing.set(row.listing_id, arr)
    }
  }

  const results: OportunidadMercadoLocal[] = []
  for (const listing of listings) {
    if (listing.precio_monto === null) continue
    if (listing.precio_moneda !== 'UF' && listing.precio_moneda !== 'CLP') continue

    const cohort = (listing.comuna ? latestByComuna.get(listing.comuna) : undefined) ?? cityCohort
    if (!cohort) continue

    const ufRate = cohort.uf_valor_usado
    const precioMonto = listing.precio_monto as number
    const precioUf = listing.precio_moneda === 'UF' ? precioMonto : precioMonto / ufRate
    const superficieM2 = listing.superficie_m2 as number | null
    const precioUfM2 = superficieM2 && superficieM2 > 0 ? precioUf / superficieM2 : null

    const reasonCodes = evaluarOportunidad({
      precioUf,
      precioUfM2,
      cohortP25Uf: cohort.p25_uf,
      cohortP25UfM2: cohort.p25_uf_m2,
      historialReciente: historyByListing.get(listing.id as string) ?? [],
    })

    if (reasonCodes.length > 0) {
      results.push({
        id: listing.id as string,
        titulo: listing.titulo as string,
        url: listing.url as string,
        comuna: listing.comuna as string,
        precioMonto,
        precioMoneda: listing.precio_moneda as string,
        superficieM2,
        precioUfNormalizado: precioUf,
        precioUfM2Normalizado: precioUfM2,
        reasonCodes,
      })
    }
  }

  results.sort((a, b) => (a.precioUfM2Normalizado ?? a.precioUfNormalizado) - (b.precioUfM2Normalizado ?? b.precioUfNormalizado))
  return results.slice(0, limit)
}

export { obtenerValorUF }
