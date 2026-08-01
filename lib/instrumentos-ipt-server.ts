import { createServiceClient } from '@/lib/supabase/service'
import { COMUNAS_CHILE } from '@/lib/comunas-chile'
import {
  buscarPaginaInstrumentosIPT,
  resolverCodigoIneComuna,
  obtenerCatalogoComunasIPT,
  normalizarNombreComuna,
  type InstrumentoIptRaw,
} from '@/lib/scrapers/instrumentos-ipt'

// ---------------------------------------------------------------------------
// Área nueva (ago. 2026), fuera de la numeración de la fusión PROPRA·BI:
// estado legal real de Instrumentos de Planificación Territorial, vía Portal
// IPT (MINVU). Dataset global (sin workspace_id), sincronización nacional
// completa — a diferencia de zonificación (ArcGIS, ~19 comunas RM) o
// mercado_locales (Portalinmobiliario, 36 comunas RM), esta fuente es una
// API rápida y paginada que cubre las ~346 comunas de Chile desde el día 1.
// ---------------------------------------------------------------------------

const PER_PAGE = 100

export interface ResultadoSincronizacionIPT {
  paginasProcesadas: number
  instrumentosSincronizados: number
  errors: string[]
}

/**
 * Pagina TODOS los instrumentos de Portal IPT y hace upsert por ipt_id.
 * Corre secuencial (rápido: ~33 páginas a perPage=100 para ~3.256
 * instrumentos, cada fetch responde en cientos de ms) — sin necesidad de
 * concurrencia como en mercado_locales (ahí sí era necesaria: 200+
 * combinaciones comuna×operación×tipo contra un sitio sin paginar).
 */
export async function sincronizarInstrumentosIPT(): Promise<ResultadoSincronizacionIPT> {
  const admin = createServiceClient()
  const resultado: ResultadoSincronizacionIPT = { paginasProcesadas: 0, instrumentosSincronizados: 0, errors: [] }

  let page = 1
  let lastPage = 1

  do {
    const respuesta = await buscarPaginaInstrumentosIPT(page, PER_PAGE)
    if (!respuesta) {
      resultado.errors.push(`página ${page}: sin respuesta`)
      break // mejor detener que avanzar con huecos silenciosos en la paginación
    }

    lastPage = respuesta.meta.lastPage
    resultado.paginasProcesadas++

    const rows = respuesta.data.map((item: InstrumentoIptRaw) => ({
      ipt_id: item.id,
      codigo: item.codigo,
      denominacion: item.denominacion,
      planificacion: item.planificacion,
      tipo: item.tipo,
      region: item.region,
      comunas: item.comunas,
      clasificacion: item.clasificacion,
      estado: item.estado,
      fecha_inicio_vigencia: item.fechaInicioVigencia,
      numero_documento: item.numeroDocumento,
      documentos: item.documentos ?? [],
      fuente_actualizada_el: item.updatedAt,
      sincronizado_el: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      const { error } = await admin.from('instrumentos_ipt').upsert(rows, { onConflict: 'ipt_id', ignoreDuplicates: false })
      if (error) {
        resultado.errors.push(`página ${page}: upsert falló — ${error.message}`)
      } else {
        resultado.instrumentosSincronizados += rows.length
      }
    }

    page++
  } while (page <= lastPage)

  return resultado
}

export interface InstrumentoIPT {
  id: number
  codigo: number | null
  denominacion: string
  planificacion: string | null
  tipo: string | null
  region: string | null
  clasificacion: string | null
  estado: string
  fechaInicioVigencia: string | null
  documentos: { url: string; tipo: string; nombre: string }[]
  fuenteActualizadaEl: string | null
}

/**
 * Instrumentos que cubren la comuna dada (por nombre — ver
 * resolverCodigoIneComuna), ordenados con lo más relevante primero: nivel
 * Comunal antes que Intercomunal/Regional, instrumentos de origen antes que
 * modificaciones, vigentes antes que derogados/desistidos.
 */
export async function obtenerInstrumentosIptPorComuna(nombreComuna: string): Promise<InstrumentoIPT[]> {
  const codigoIne = await resolverCodigoIneComuna(nombreComuna)
  if (!codigoIne) return []

  const admin = createServiceClient()
  const { data, error } = await admin
    .from('instrumentos_ipt')
    .select('ipt_id, codigo, denominacion, planificacion, tipo, region, clasificacion, estado, fecha_inicio_vigencia, documentos, fuente_actualizada_el')
    .contains('comunas', [codigoIne])

  if (error || !data) return []

  const ordenPlanificacion: Record<string, number> = { Comunal: 0, Intercomunal: 1, Regional: 2 }
  const ordenClasificacion: Record<string, number> = { 'Instrumento de origen': 0, 'Modificación': 1 }
  const ordenEstado: Record<string, number> = { Vigente: 0, 'En Desarrollo': 1, Derogado: 2, Desistido: 3 }

  const filas = data.sort((a, b) => {
    const p = (ordenPlanificacion[a.planificacion ?? ''] ?? 9) - (ordenPlanificacion[b.planificacion ?? ''] ?? 9)
    if (p !== 0) return p
    const c = (ordenClasificacion[a.clasificacion ?? ''] ?? 9) - (ordenClasificacion[b.clasificacion ?? ''] ?? 9)
    if (c !== 0) return c
    return (ordenEstado[a.estado] ?? 9) - (ordenEstado[b.estado] ?? 9)
  })

  return filas.map((f) => ({
    id: f.ipt_id,
    codigo: f.codigo,
    denominacion: f.denominacion,
    planificacion: f.planificacion,
    tipo: f.tipo,
    region: f.region,
    clasificacion: f.clasificacion,
    estado: f.estado,
    fechaInicioVigencia: f.fecha_inicio_vigencia,
    documentos: (f.documentos ?? []) as { url: string; tipo: string; nombre: string }[],
    fuenteActualizadaEl: f.fuente_actualizada_el,
  }))
}

export interface ResumenInstrumentosIptComuna {
  vigentes: number
  total: number
}

/**
 * Resumen nacional — cuenta instrumentos por comuna (vigentes vs. total),
 * agregado en memoria desde instrumentos_ipt (no via SQL unnest: la tabla es
 * chica, ~3.256 filas, y así se evita otra función RPC solo para esto).
 * Clave del mapa: ComunaChile.id (el slug que ya usa el resto del proyecto),
 * resuelto desde el código INE vía el catálogo de comunas de Portal IPT —
 * usado por la página de listado de /municipios para mostrar un badge de
 * cobertura sin tener que resolver 345 comunas una por una.
 *
 * Paginado explícitamente con .range() — un .select() plano sobre 3.256
 * filas cae silenciosamente en el límite por defecto de PostgREST (1000
 * filas), lo que subcontaba comunas grandes (detectado en vivo: Las Condes
 * daba 56 en vez de 249 instrumentos reales).
 */
export async function obtenerResumenInstrumentosIptPorComunaId(): Promise<Record<string, ResumenInstrumentosIptComuna>> {
  const admin = createServiceClient()
  const TAMANO_PAGINA = 1000
  const porCodigoIne = new Map<string, ResumenInstrumentosIptComuna>()

  let desde = 0
  for (;;) {
    const { data, error } = await admin
      .from('instrumentos_ipt')
      .select('comunas, estado')
      .range(desde, desde + TAMANO_PAGINA - 1)
    if (error || !data) break

    for (const row of data) {
      for (const codigo of (row.comunas ?? []) as string[]) {
        const acc = porCodigoIne.get(codigo) ?? { vigentes: 0, total: 0 }
        acc.total++
        if (row.estado === 'Vigente') acc.vigentes++
        porCodigoIne.set(codigo, acc)
      }
    }

    if (data.length < TAMANO_PAGINA) break
    desde += TAMANO_PAGINA
  }

  const catalogo = await obtenerCatalogoComunasIPT()
  const nombrePorCodigoIne = new Map(catalogo.map((c) => [c.codigoCompuestoComunaINE, c.nombre]))
  const idPorNombreNormalizado = new Map(COMUNAS_CHILE.map((c) => [normalizarNombreComuna(c.nombre), c.id]))

  const resultado: Record<string, ResumenInstrumentosIptComuna> = {}
  for (const [codigoIne, resumen] of porCodigoIne) {
    const nombre = nombrePorCodigoIne.get(codigoIne)
    const comunaId = nombre ? idPorNombreNormalizado.get(normalizarNombreComuna(nombre)) : undefined
    if (comunaId) resultado[comunaId] = resumen
  }

  return resultado
}
