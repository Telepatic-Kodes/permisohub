import { createServiceClient } from '@/lib/supabase/service'
import { recordSourceRun } from '@/lib/observability'
import { descargarSucursalesCadenas, CADENAS_RUT_CONOCIDOS } from '@/lib/scrapers/sii-nomina-sucursales'
import { normalizarNombreComuna } from '@/lib/scrapers/instrumentos-ipt'
import { geocodeDireccion } from '@/lib/geocoding'

export interface ResultadoIngestaCadenas {
  totalEncontradas: number
  nuevasDirecciones: number
}

/**
 * Orquesta la ingesta mensual de sucursales de cadenas conocidas: descarga la
 * nómina del SII, detecta direcciones que no existían en nuestra propia
 * captura anterior (no depende de que el SII marque "nuevo" — nosotros
 * llevamos nuestro propio historial), y upsertea por clave natural
 * (rut, calle, numero, comuna).
 */
export async function correrIngestaCadenasSucursales(): Promise<ResultadoIngestaCadenas> {
  const supabase = createServiceClient()
  const sucursales = await descargarSucursalesCadenas()

  if (sucursales.length === 0) {
    await recordSourceRun({
      sourceId: 'sii-nomina-sucursales',
      status: 'error',
      errorMessage: 'Descarga vacía — ver reportWarning/reportError de sii-nomina-sucursales.ts para la causa',
    })
    return { totalEncontradas: 0, nuevasDirecciones: 0 }
  }

  const { data: existentes, error: errorLectura } = await supabase
    .from('cadenas_sucursales')
    .select('rut, calle, numero, comuna')

  if (errorLectura) {
    await recordSourceRun({ sourceId: 'sii-nomina-sucursales', status: 'error', errorMessage: errorLectura.message })
    throw errorLectura
  }

  const clavesExistentes = new Set(
    (existentes ?? []).map((e) => `${e.rut}|${e.calle}|${e.numero}|${e.comuna}`)
  )

  const nuevas = sucursales.filter(
    (s) => !clavesExistentes.has(`${s.rut}|${s.calle ?? ''}|${s.numero ?? ''}|${s.comuna ?? ''}`)
  )

  const ahora = new Date().toISOString()

  // Deduplicar por clave natural ANTES de upsertear: el SII trae más de una
  // fila para la misma (rut, calle, numero, comuna) cuando difieren en un
  // campo que no forma parte de nuestra clave (ej. distintas oficinas/
  // departamentos en la misma dirección) — Postgres no permite que un
  // ON CONFLICT DO UPDATE afecte la misma fila dos veces en un solo statement
  // (error 21000). Se prefiere la fila vigente si hay más de una para la
  // misma clave.
  const filasPorClave = new Map<string, ReturnType<typeof mapearFila>>()
  function mapearFila(s: (typeof sucursales)[number]) {
    return {
      rut: s.rut,
      dv: s.dv,
      cadena: s.cadena,
      vigente: s.vigente,
      fecha_registro: s.fechaRegistro,
      calle: s.calle ?? '',
      numero: s.numero ?? '',
      comuna: s.comuna ?? '',
      region: s.region,
      ultima_vez_visto_el: ahora,
    }
  }
  for (const s of sucursales) {
    const clave = `${s.rut}|${s.calle ?? ''}|${s.numero ?? ''}|${s.comuna ?? ''}`
    const existente = filasPorClave.get(clave)
    if (!existente || (!existente.vigente && s.vigente)) {
      filasPorClave.set(clave, mapearFila(s))
    }
  }
  const filas = Array.from(filasPorClave.values())

  const { error: errorUpsert } = await supabase
    .from('cadenas_sucursales')
    .upsert(filas, { onConflict: 'rut,calle,numero,comuna' })

  if (errorUpsert) {
    await recordSourceRun({ sourceId: 'sii-nomina-sucursales', status: 'error', errorMessage: errorUpsert.message })
    throw errorUpsert
  }

  await recordSourceRun({ sourceId: 'sii-nomina-sucursales', status: 'ok', rowCount: sucursales.length })

  return { totalEncontradas: sucursales.length, nuevasDirecciones: nuevas.length }
}

export interface ResumenExpansionCadena {
  cadena: string
  sucursalesActivas: number
  comunas: string[]
  masReciente: { calle: string; comuna: string; fechaRegistro: string | null } | null
}

/**
 * Resumen por cadena para el panel de expansión — solo cadenas 'activo' (las
 * 'needs-decision' como Walmart/SMU no tienen datos ingeridos, ver
 * CADENAS_RUT_CONOCIDOS).
 */
export async function obtenerResumenExpansionCadenas(): Promise<ResumenExpansionCadena[]> {
  const supabase = createServiceClient()
  const cadenasActivas = CADENAS_RUT_CONOCIDOS.filter((c) => c.estado === 'activo').map((c) => c.cadena)

  const { data, error } = await supabase
    .from('cadenas_sucursales')
    .select('cadena, calle, comuna, fecha_registro')
    .eq('vigente', true)
    .in('cadena', cadenasActivas)
    .order('fecha_registro', { ascending: false })

  if (error || !data) return []

  const porCadena = new Map<string, typeof data>()
  for (const fila of data) {
    const lista = porCadena.get(fila.cadena) ?? []
    lista.push(fila)
    porCadena.set(fila.cadena, lista)
  }

  return cadenasActivas
    .filter((cadena) => porCadena.has(cadena))
    .map((cadena) => {
      const filas = porCadena.get(cadena)!
      const comunas = Array.from(new Set(filas.map((f) => f.comuna).filter(Boolean)))
      const masReciente = filas[0]
        ? { calle: filas[0].calle, comuna: filas[0].comuna, fechaRegistro: filas[0].fecha_registro }
        : null
      return { cadena, sucursalesActivas: filas.length, comunas, masReciente }
    })
}

export interface SucursalReciente {
  cadena: string
  calle: string
  comuna: string
  region: string | null
  fechaRegistro: string | null
}

/**
 * Feed plano de las sucursales más recientemente registradas entre todas las
 * cadenas activas, para mostrar "aperturas recientes" en un solo listado
 * (en vez de un resumen por cadena). `fechaRegistro` viene del propio SII
 * (columna FECHA) — útil como señal desde la primera corrida, sin depender
 * de acumular nuestro propio historial mes a mes.
 */
export async function obtenerSucursalesRecientes(limit = 10): Promise<SucursalReciente[]> {
  const supabase = createServiceClient()
  const cadenasActivas = CADENAS_RUT_CONOCIDOS.filter((c) => c.estado === 'activo').map((c) => c.cadena)

  const { data, error } = await supabase
    .from('cadenas_sucursales')
    .select('cadena, calle, comuna, region, fecha_registro')
    .eq('vigente', true)
    .in('cadena', cadenasActivas)
    .order('fecha_registro', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((f) => ({
    cadena: f.cadena,
    calle: f.calle,
    comuna: f.comuna,
    region: f.region,
    fechaRegistro: f.fecha_registro,
  }))
}

export interface SenalExpansionComuna {
  cadena: string
  fechaRegistro: string | null
}

/**
 * Cruza un conjunto de comunas (ej. las de una lista de oportunidades) contra
 * las sucursales de cadenas vigentes, para mostrar la señal directamente
 * donde se toma la decisión (Oportunidades), no solo en el panel dedicado
 * /mercado-inmobiliario/cadenas — un dato correcto que nadie ve en el
 * momento de decidir no cambia ninguna decisión.
 *
 * `mercado_locales_listings.comuna` viene con mayúscula/minúscula y tildes
 * ("Las Condes", "Peñalolén"); `cadenas_sucursales.comuna` viene tal cual el
 * SII lo entrega, en mayúsculas y sin tildes ("LAS CONDES", "PENALOLEN") —
 * normalizamos ambos lados con normalizarNombreComuna() (ya usado para el
 * mismo problema en instrumentos-ipt.ts) antes de cruzar, o el match nunca
 * ocurriría en silencio.
 *
 * Devuelve como máximo 1 señal por comuna (la más reciente) — el objetivo es
 * un indicio de demanda, no un listado exhaustivo de sucursales.
 */
export async function obtenerSenalesExpansionPorComuna(
  comunas: string[]
): Promise<Map<string, SenalExpansionComuna>> {
  const resultado = new Map<string, SenalExpansionComuna>()
  if (comunas.length === 0) return resultado

  const supabase = createServiceClient()
  const cadenasActivas = CADENAS_RUT_CONOCIDOS.filter((c) => c.estado === 'activo').map((c) => c.cadena)
  const comunasNormalizadas = new Map(comunas.map((c) => [normalizarNombreComuna(c), c]))

  const { data, error } = await supabase
    .from('cadenas_sucursales')
    .select('cadena, comuna, fecha_registro')
    .eq('vigente', true)
    .in('cadena', cadenasActivas)
    .order('fecha_registro', { ascending: false })

  if (error || !data) return resultado

  for (const fila of data) {
    const comunaOriginal = comunasNormalizadas.get(normalizarNombreComuna(fila.comuna))
    if (!comunaOriginal || resultado.has(comunaOriginal)) continue // ya tiene su señal más reciente
    resultado.set(comunaOriginal, { cadena: fila.cadena, fechaRegistro: fila.fecha_registro })
  }

  return resultado
}

export interface CadenaGeocodificada {
  cadena: string
  lat: number
  lng: number
  direccionLabel: string
}

/**
 * Geocodifica on-demand las sucursales VIGENTES de una comuna que todavía no
 * tienen lat/lng, persiste el resultado en la fila (cache-through — NUNCA
 * vuelve a geocodificar una fila con lat/lng ya poblados), y retorna todas
 * las filas de la comuna con coordenadas (ya cacheadas + recién geocodificadas
 * en esta llamada). Nunca lanza — una fila que falla su geocoding simplemente
 * no aparece en el resultado, mismo contrato que geocodeDireccion().
 *
 * Nota de diseño: usa normalizarNombreComuna() en JS después de traer todas
 * las filas activas, mismo patrón ya aceptado en obtenerSenalesExpansionPorComuna()
 * — no un `.eq('comuna', ...)` directo, porque `cadenas_sucursales.comuna`
 * viene en MAYÚSCULAS sin tildes del SII.
 */
export async function obtenerCadenasGeocodificadasPorComuna(
  comuna: string
): Promise<CadenaGeocodificada[]> {
  const supabase = createServiceClient()
  const cadenasActivas = CADENAS_RUT_CONOCIDOS.filter((c) => c.estado === 'activo').map((c) => c.cadena)

  const { data: filas, error } = await supabase
    .from('cadenas_sucursales')
    .select('id, cadena, calle, numero, comuna, lat, lng')
    .eq('vigente', true)
    .in('cadena', cadenasActivas)

  if (error || !filas) return []

  const comunaNormalizada = normalizarNombreComuna(comuna)
  const filasDeLaComuna = filas.filter((f) => normalizarNombreComuna(f.comuna) === comunaNormalizada)

  const resultado: CadenaGeocodificada[] = []
  for (const fila of filasDeLaComuna) {
    if (fila.lat != null && fila.lng != null) {
      resultado.push({ cadena: fila.cadena, lat: fila.lat, lng: fila.lng, direccionLabel: `${fila.calle} ${fila.numero}` })
      continue
    }
    // No geocodificada todavía — geocodificar UNA vez, persistir, luego usar.
    const geo = await geocodeDireccion(`${fila.calle} ${fila.numero}`, fila.comuna)
    if (!geo.ok || geo.lat === undefined || geo.lng === undefined) continue

    await supabase
      .from('cadenas_sucursales')
      .update({ lat: geo.lat, lng: geo.lng, geocodificado_el: new Date().toISOString() })
      .eq('id', fila.id)

    resultado.push({
      cadena: fila.cadena,
      lat: geo.lat,
      lng: geo.lng,
      direccionLabel: geo.displayName ?? `${fila.calle} ${fila.numero}`,
    })
  }
  return resultado
}
