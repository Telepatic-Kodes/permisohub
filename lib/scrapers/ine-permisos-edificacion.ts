import { reportError, reportWarning } from '@/lib/observability'

// ---------------------------------------------------------------------------
// Permisos de edificación del INE — servicio oficial CRF_PE_AGOL (cuenta
// "publicaciones_geodatos", la misma que publica los Censos 2017/2024),
// verificado en vivo el 1 ago 2026 tras descartar el espejo del Observatorio
// de Ciudades UC (mismo dato, pero republicado bajo CC BY-NC 4.0 — no
// comercial, inservible para un SaaS pagado). El servicio oficial del INE
// (accessInformation: "Geografía INE - 2023") no trae esa restricción: la
// licencia real es CC BY-SA 4.0 (ver ine.gob.cl/terminos-de-uso-y-licencia-de-datos-abiertos),
// que SÍ permite uso comercial, exigiendo solo atribución ("Fuente: INE,
// [producto], actualizado [año]") y que cualquier ADAPTACIÓN del dataset en
// sí se comparta bajo la misma licencia — no aplica a usar el dato agregado
// como insumo de un informe generado, solo a redistribuir el dataset
// geográfico. Atribuir siempre "INE" donde se muestre este dato.
//
// Cobertura real (verificada consultando la capa, e ingesta completa a la
// tabla): 2010–2022, 121 comunas (capitales regionales/provinciales +
// comunas >50.000 habitantes, no las 346). El INE no ha publicado años más
// recientes en este servicio — es HISTÓRICO, nunca presentar como actividad
// "actual" o "reciente".
//
// 135.338 permisos individuales a nivel nacional — en vez de traer cada
// punto, se pide el agregado directo a ArcGIS vía groupByFieldsForStatistics
// (soportado y verificado con una consulta real), muchísimo más liviano que
// paginar 135k filas para luego agregar acá.

const INE_PERMISOS_QUERY_URL =
  'https://services5.arcgis.com/hUyD8u3TeZLKPe4T/arcgis/rest/services/CRF_PE_AGOL/FeatureServer/0/query'

export interface PermisoEdificacionAgregado {
  comuna: string
  anio: number
  usoDestino: string
  nPermisos: number
  superficieTotalM2: number
  unidadesTotal: number
}

interface ArcGISStatsFeature {
  attributes: {
    GLOSA_COMUNA: string | null
    'AÑO': number | null // epoch ms (esriFieldTypeDate)
    USO_DESTINO: string | null
    n_permisos: number | null
    sup_total: number | null
    unidades_total: number | null
  }
}

interface ArcGISStatsResponse {
  features?: ArcGISStatsFeature[]
  error?: { message?: string }
}

const PAGE_SIZE = 2000 // maxRecordCount real del servicio, verificado en vivo

async function fetchPage(offset: number): Promise<ArcGISStatsResponse | null> {
  const params = new URLSearchParams({
    where: '1=1',
    groupByFieldsForStatistics: 'GLOSA_COMUNA,AÑO,USO_DESTINO',
    outStatistics: JSON.stringify([
      { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'n_permisos' },
      { statisticType: 'sum', onStatisticField: 'SUPERFICIE', outStatisticFieldName: 'sup_total' },
      { statisticType: 'sum', onStatisticField: 'CANTIDAD_UNIDAD', outStatisticFieldName: 'unidades_total' },
    ]),
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    orderByFields: 'GLOSA_COMUNA,AÑO,USO_DESTINO',
    f: 'json',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  const res = await fetch(`${INE_PERMISOS_QUERY_URL}?${params.toString()}`, {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PermisoHub/1.0)' },
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) {
    reportWarning(`HTTP ${res.status} al consultar el servicio del INE (offset ${offset})`, {
      scope: 'scraper.ine-permisos-edificacion',
      extra: { status: res.status, offset },
    })
    return null
  }

  return (await res.json()) as ArcGISStatsResponse
}

/**
 * Descarga el agregado nacional (comuna × año × uso_destino) del servicio
 * oficial del INE, paginando por `resultOffset` — el servicio agrupa 4.243
 * combinaciones reales pero solo entrega 2000 por consulta (maxRecordCount
 * verificado en vivo). Nunca lanza — cualquier fallo (HTTP, formato
 * cambiado) degrada al agregado parcial ya descargado, nunca a un throw.
 */
export async function descargarPermisosEdificacionIne(): Promise<PermisoEdificacionAgregado[]> {
  const resultado: PermisoEdificacionAgregado[] = []

  try {
    let offset = 0
    for (;;) {
      const data = await fetchPage(offset)
      if (!data) break

      if (data.error) {
        reportWarning(`ArcGIS devolvió un error (offset ${offset}): ${data.error.message ?? 'sin detalle'}`, {
          scope: 'scraper.ine-permisos-edificacion',
        })
        break
      }

      const features = data.features ?? []
      for (const f of features) {
        const a = f.attributes
        if (!a.GLOSA_COMUNA || !a['AÑO'] || !a.USO_DESTINO) continue

        resultado.push({
          comuna: a.GLOSA_COMUNA.trim(),
          anio: new Date(a['AÑO']).getUTCFullYear(),
          usoDestino: a.USO_DESTINO.trim(),
          nPermisos: a.n_permisos ?? 0,
          superficieTotalM2: a.sup_total ?? 0,
          unidadesTotal: a.unidades_total ?? 0,
        })
      }

      if (features.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
  } catch (err) {
    reportError(err, { scope: 'scraper.ine-permisos-edificacion', extra: { filasHastaElFallo: resultado.length } })
  }

  return resultado
}
