// Fuente: Portal IPT (MINVU), relanzado ago. 2025 por mandato del Art. 28
// undecies LGUC — API pública, sin autenticación, no documentada en ningún
// lado oficial. Patrón de consulta extraído en vivo del bundle JS de la app
// (componente InstrumentosTable) el 1 ago. 2026: el endpoint sin
// `paginated=true&page=&perPage=` cae en un query no paginado que hace
// timeout (504) — la paginación NO es opcional pese a no estar documentada.

const PORTAL_IPT_API_BASE = 'https://portalipt-api.minvu.cl'

export interface InstrumentoIptDocumento {
  url: string
  tipo: string
  nombre: string
}

export interface InstrumentoIptRaw {
  id: number
  codigo: number | null
  denominacion: string
  planificacion: string | null
  tipo: string | null
  region: string | null
  comunas: string[]
  clasificacion: string | null
  estado: string
  fechaInicioVigencia: string | null
  numeroDocumento: string | null
  documentos: InstrumentoIptDocumento[]
  updatedAt: string | null
}

interface InstrumentosIptResponse {
  meta: { total: number; perPage: number; currentPage: number; lastPage: number }
  data: InstrumentoIptRaw[]
}

// Best-effort — nunca lanza. Una página fallida se reporta al caller (que
// decide si reintentar o simplemente omitir esa página en la sincronización).
export async function buscarPaginaInstrumentosIPT(
  page: number,
  perPage: number,
): Promise<InstrumentosIptResponse | null> {
  try {
    const url = `${PORTAL_IPT_API_BASE}/instrumentos?paginated=true&page=${page}&perPage=${perPage}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) {
      console.warn(`[instrumentos-ipt] HTTP ${res.status} en página ${page}`)
      return null
    }
    return (await res.json()) as InstrumentosIptResponse
  } catch (err) {
    console.warn(`[instrumentos-ipt] Error al buscar página ${page}:`, err instanceof Error ? err.message : err)
    return null
  }
}

interface ComunaIptRaw {
  idComuna: number
  idProvincia: number
  nombre: string
  codigoCompuestoComunaINE: string
  activo: boolean
}

function normalizarNombreComuna(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (diacríticos combinantes tras NFD)
    .trim()
    .toUpperCase()
}

// Resuelve nombre de comuna (ej. "Las Condes", "Ñuñoa") al código INE que
// Portal IPT usa para filtrar (`?comuna=<código>`). Se consulta en vivo en
// vez de hardcodear un mapeo de las ~346 comunas de Chile — mismo criterio
// que el resto del proyecto: no adivinar/duplicar un dato que una fuente
// viva ya resuelve de forma confiable.
export async function resolverCodigoIneComuna(nombreComuna: string): Promise<string | null> {
  try {
    const res = await fetch(`${PORTAL_IPT_API_BASE}/comunas`)
    if (!res.ok) return null
    const comunas = (await res.json()) as ComunaIptRaw[]
    const objetivo = normalizarNombreComuna(nombreComuna)
    const match = comunas.find((c) => normalizarNombreComuna(c.nombre) === objetivo)
    return match?.codigoCompuestoComunaINE ?? null
  } catch (err) {
    console.warn(`[instrumentos-ipt] No se pudo resolver código INE para "${nombreComuna}":`, err instanceof Error ? err.message : err)
    return null
  }
}
