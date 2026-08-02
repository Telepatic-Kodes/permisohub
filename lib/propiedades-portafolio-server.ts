import { createServiceClient } from '@/lib/supabase/service'
import { obtenerBandasMercadoLocales, type BandasMercadoLocal } from '@/lib/mercado-locales-server'
import { buscarDatosSIIPorRol } from '@/lib/sii-lookup-server'
import type { OperacionMercadoLocal, TipoPropiedadComercial } from '@/lib/scrapers/mercado-locales-common'
import { obligacionesAplicables, calcularEstadoObligacion, type ObligacionConEstado } from '@/lib/obligaciones-regulatorias'
import { calcularCapRate, type CapRateResultado } from '@/lib/calculadora-inversion'

export interface PropiedadPortafolio {
  id: string
  direccion: string
  comuna: string
  tipoPropiedad: TipoPropiedadComercial
  superficieM2: number | null
  operacion: OperacionMercadoLocal
  precioActualUf: number | null
  rolSii: string | null
  notas: string | null
  fechaVencimientoContrato: string | null
  tieneAscensor: boolean
  tieneGas: boolean
  siiDestino: string | null
  siiAvaluoFiscalUf: number | null
  siiConsultadoEl: string | null
  reajusteAplica: boolean
  reajustePeriodicidadMeses: number | null
  reajusteFechaUltimo: string | null
  createdAt: string
}

export interface ComparacionMercado {
  medianaUfM2: number | null
  muestraN: number
  usoFallback: boolean
  variacionPct: number | null // (precioActualUfM2 - medianaUfM2) / medianaUfM2 * 100
  veredicto: 'bajo_mercado' | 'a_mercado' | 'sobre_mercado' | 'sin_dato'
}

const UMBRAL_A_MERCADO_PCT = 10 // dentro de ±10% se considera "a mercado", no un desvío real

/**
 * Compara el precio actual de una propiedad del portafolio contra la banda
 * de mercado real (mismo motor que /mercado-inmobiliario/pricing) — a
 * diferencia de Pricing, acá la pregunta no es "¿a qué precio publico?" sino
 * "¿mi arriendo/precio YA vigente está desalineado del mercado?". Requiere
 * superficie_m2 para poder comparar en UF/m² (la única unidad comparable
 * entre propiedades de tamaños distintos).
 *
 * `bandasPrefetch` permite que el caller (`compararPortafolioConMercado`)
 * comparta una sola consulta de bandas entre propiedades con la misma
 * comuna+operación+tipo, en vez de repetirla por cada propiedad.
 */
export async function compararConMercado(
  prop: PropiedadPortafolio,
  bandasPrefetch?: BandasMercadoLocal | null,
): Promise<ComparacionMercado> {
  if (!prop.superficieM2 || !prop.precioActualUf) {
    return { medianaUfM2: null, muestraN: 0, usoFallback: false, variacionPct: null, veredicto: 'sin_dato' }
  }

  const bandas = bandasPrefetch !== undefined ? bandasPrefetch : await obtenerBandasMercadoLocales(prop.comuna, prop.operacion, prop.tipoPropiedad)
  if (!bandas || bandas.medianaUfM2 === null) {
    return { medianaUfM2: null, muestraN: bandas?.muestraN ?? 0, usoFallback: bandas?.usoFallback ?? false, variacionPct: null, veredicto: 'sin_dato' }
  }

  const precioActualUfM2 = prop.precioActualUf / prop.superficieM2
  const variacionPct = ((precioActualUfM2 - bandas.medianaUfM2) / bandas.medianaUfM2) * 100

  let veredicto: ComparacionMercado['veredicto'] = 'a_mercado'
  if (variacionPct <= -UMBRAL_A_MERCADO_PCT) veredicto = 'bajo_mercado'
  else if (variacionPct >= UMBRAL_A_MERCADO_PCT) veredicto = 'sobre_mercado'

  return {
    medianaUfM2: bandas.medianaUfM2,
    muestraN: bandas.muestraAreaN,
    usoFallback: bandas.usoFallback,
    variacionPct,
    veredicto,
  }
}

/**
 * Versión en lote de compararConMercado: una sola consulta de bandas por
 * cada combinación distinta de comuna+operación+tipo presente en el
 * portafolio, en vez de una por propiedad — un fondo con 30 propiedades en
 * 3 comunas hacía hasta 60 consultas a mercado_locales_stats_diarias donde
 * bastan 3.
 */
export async function compararPortafolioConMercado(propiedades: PropiedadPortafolio[]): Promise<Map<string, ComparacionMercado>> {
  const bandasCache = new Map<string, Promise<BandasMercadoLocal | null>>()

  function bandasPara(p: PropiedadPortafolio): Promise<BandasMercadoLocal | null> {
    const key = `${p.comuna}|${p.operacion}|${p.tipoPropiedad}`
    if (!bandasCache.has(key)) {
      bandasCache.set(key, obtenerBandasMercadoLocales(p.comuna, p.operacion, p.tipoPropiedad))
    }
    return bandasCache.get(key)!
  }

  const resultado = new Map<string, ComparacionMercado>()
  await Promise.all(
    propiedades.map(async (p) => {
      const bandas = p.superficieM2 && p.precioActualUf ? await bandasPara(p) : null
      resultado.set(p.id, await compararConMercado(p, bandas))
    }),
  )
  return resultado
}

/**
 * Cap Rate de una propiedad del portafolio, delegando la fórmula (ya
 * probada en la Calculadora de Mercado Inmobiliario) a `calcularCapRate` de
 * lib/calculadora-inversion.ts — acá solo se resuelven los dos datos que ya
 * vive Mi Cartera:
 *
 * - `precioActualUf` como renta mensual: solo aplica a propiedades en
 *   `arriendo` (en `venta` ese campo es un precio de referencia, no una
 *   renta, así que no hay NOI que calcular).
 * - `siiAvaluoFiscalUf` como proxy del "precio de venta"/valorización: el
 *   portafolio no tiene un campo propio de "valor de mercado" de la
 *   propiedad, así que se usa el avalúo fiscal SII ya enriquecido (mismo
 *   dato que ya se muestra en la ficha tras "Consultar SII").
 *
 * Ambos montos están en UF y NO se convierten a CLP: el cap rate es un
 * ratio (renta/precio), así que es unit-invariant — el resultado es el
 * mismo si ambos números están en UF, en CLP o en cualquier otra unidad
 * consistente entre sí.
 *
 * Si falta cualquiera de los dos datos, devuelve null — nunca se fabrica
 * un cap rate con un supuesto por default (ej. asumir un avalúo o una
 * renta): una propiedad en venta, o sin avalúo SII consultado aún, simplemente
 * no tiene cap rate mostrable todavía.
 */
export function calcularCapRatePropiedad(prop: PropiedadPortafolio): CapRateResultado | null {
  if (prop.operacion !== 'arriendo') return null
  if (prop.precioActualUf === null || prop.precioActualUf === undefined) return null
  if (prop.siiAvaluoFiscalUf === null || prop.siiAvaluoFiscalUf === undefined) return null

  return calcularCapRate({ rentaMensual: prop.precioActualUf, precioVenta: prop.siiAvaluoFiscalUf })
}

export async function obtenerPropiedadesPortafolio(workspaceId: string): Promise<PropiedadPortafolio[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('propiedades_portafolio')
    .select('id, direccion, comuna, tipo_propiedad, superficie_m2, operacion, precio_actual_uf, rol_sii, notas, fecha_vencimiento_contrato, tiene_ascensor, tiene_gas, sii_destino, sii_avaluo_fiscal_uf, sii_consultado_el, reajuste_aplica, reajuste_periodicidad_meses, reajuste_fecha_ultimo, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((f) => ({
    id: f.id,
    direccion: f.direccion,
    comuna: f.comuna,
    tipoPropiedad: f.tipo_propiedad as TipoPropiedadComercial,
    superficieM2: f.superficie_m2,
    operacion: f.operacion as OperacionMercadoLocal,
    precioActualUf: f.precio_actual_uf,
    rolSii: f.rol_sii,
    notas: f.notas,
    fechaVencimientoContrato: f.fecha_vencimiento_contrato,
    tieneAscensor: f.tiene_ascensor,
    tieneGas: f.tiene_gas,
    siiDestino: f.sii_destino,
    siiAvaluoFiscalUf: f.sii_avaluo_fiscal_uf,
    siiConsultadoEl: f.sii_consultado_el,
    reajusteAplica: f.reajuste_aplica,
    reajustePeriodicidadMeses: f.reajuste_periodicidad_meses,
    reajusteFechaUltimo: f.reajuste_fecha_ultimo,
    createdAt: f.created_at,
  }))
}

// Palabras clave por tipo declarado — el destino que devuelve el SII es
// texto libre ("OFICINA", "LOCAL COMERCIAL", "BODEGAJE", "HABITACION
// PARTICULAR", etc.), así que el cruce es heurístico por keyword, no una
// clasificación exacta. Cuando el destino no calza con NINGÚN tipo conocido
// (ambiguo — ej. "SITIO NO EDIFICADO"), se devuelve null en vez de forzar un
// mismatch falso positivo.
const KEYWORDS_POR_TIPO: Record<TipoPropiedadComercial, string[]> = {
  local_comercial: ['COMERCIO', 'COMERCIAL', 'TIENDA', 'LOCAL'],
  oficina: ['OFICINA'],
  bodega: ['BODEGA', 'ALMACENAJE'],
  industrial: ['INDUSTRIA', 'INDUSTRIAL', 'FABRICA', 'GALPON'],
}

export function destinoSiiCoincideConTipo(destinoSii: string, tipo: TipoPropiedadComercial): boolean | null {
  const destino = destinoSii.toUpperCase()
  const tiposQueCoinciden = (Object.keys(KEYWORDS_POR_TIPO) as TipoPropiedadComercial[]).filter((t) =>
    KEYWORDS_POR_TIPO[t].some((kw) => destino.includes(kw)),
  )

  if (tiposQueCoinciden.length === 0) return null // ambiguo — ningún tipo conocido calza
  if (tiposQueCoinciden.length === 1) return tiposQueCoinciden[0] === tipo

  // El destino calza con MÁS de un tipo (ej. "BODEGA Y LOCAL COMERCIAL"): si
  // el tipo declarado es uno de ellos, es genuinamente ambiguo — declarar
  // "coincide" acá sería ocultar un posible mismatch real. Si el tipo
  // declarado no está entre los que calzan, sí es una señal de mismatch.
  return tiposQueCoinciden.includes(tipo) ? null : false
}

export interface EnriquecimientoSII {
  destino: string
  avaluoFiscalUf: number | null
  coincideTipo: boolean | null
}

/**
 * Consulta el SII por rol (mismo lookup ya usado en producción por Tasación
 * y Due Diligence) — best-effort, no lanza: si el SII no responde o el rol
 * no existe, devuelve null. NO persiste — quien llama (la ruta, con su
 * cliente de sesión scoped por RLS) decide cómo y si escribir el resultado,
 * mismo criterio de separación que el resto de este archivo.
 */
export async function consultarSII(
  rolSii: string,
  tipoPropiedad: TipoPropiedadComercial,
  cookieHeader: string | null,
): Promise<EnriquecimientoSII | null> {
  const datos = await buscarDatosSIIPorRol(rolSii, cookieHeader)
  if (!datos) return null

  return {
    destino: datos.destino,
    avaluoFiscalUf: datos.avaluo_fiscal_uf,
    coincideTipo: destinoSiiCoincideConTipo(datos.destino, tipoPropiedad),
  }
}

/**
 * Estado de cada obligación regulatoria aplicable a cada propiedad del
 * portafolio (filtradas por tieneAscensor/tieneGas), cruzada con lo que el
 * usuario haya registrado en propiedad_obligaciones. Una propiedad sin
 * ningún registro aún devuelve todas sus obligaciones aplicables en estado
 * 'sin_registro', nunca vacío — el punto del checklist es precisamente
 * mostrar lo que falta declarar.
 *
 * Una sola consulta con `.in('propiedad_id', ...)` para todo el portafolio
 * en vez de una por propiedad — un fondo con 30 propiedades hacía 30
 * consultas idénticas en forma.
 */
export async function obtenerObligacionesPortafolio(propiedades: PropiedadPortafolio[]): Promise<Map<string, ObligacionConEstado[]>> {
  const resultado = new Map<string, ObligacionConEstado[]>()
  if (propiedades.length === 0) return resultado

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('propiedad_obligaciones')
    .select('propiedad_id, obligacion_slug, fecha_ultimo_cumplimiento')
    .in('propiedad_id', propiedades.map((p) => p.id))

  const registradoPorPropiedad = new Map<string, Map<string, string | null>>()
  for (const row of data ?? []) {
    if (!registradoPorPropiedad.has(row.propiedad_id)) registradoPorPropiedad.set(row.propiedad_id, new Map())
    registradoPorPropiedad.get(row.propiedad_id)!.set(row.obligacion_slug, row.fecha_ultimo_cumplimiento)
  }

  const hoy = new Date()
  for (const p of propiedades) {
    const registrado = registradoPorPropiedad.get(p.id) ?? new Map<string, string | null>()
    resultado.set(
      p.id,
      obligacionesAplicables(p.tieneAscensor, p.tieneGas).map((o) => calcularEstadoObligacion(o, registrado.get(o.slug) ?? null, hoy)),
    )
  }
  return resultado
}
