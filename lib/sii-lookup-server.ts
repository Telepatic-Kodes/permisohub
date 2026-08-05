// Server-only. Dos cosas viven acá:
//
//   1. consultarRolEnSII() — el scraping y parseo del SII, extraído de
//      app/api/sii/lookup/route.ts el 05-08 para que la ruta Y el probe de
//      salud consuman LA MISMA función. Un probe con su propia copia del
//      parser puede estar verde mientras el parser real está roto, que es
//      exactamente el modo de falla que este subsistema existe para evitar.
//
//      Se extrajo DESDE la ruta, no reconstruido a partir de lo que uno cree
//      que la ruta hace: ese error ya se cometió una vez en lib/sii-lookup.ts
//      (lookupSIIByRol declaraba `{ ok, data }` con el rol adentro de data
//      cuando la ruta lo devuelve arriba), y produjo tres funciones muertas
//      que había que borrar.
//
//   2. buscarDatosSIIPorRol() — cliente HTTP hacia la ruta interna, para las
//      rutas de IA (tasación, due-diligence-propiedad).
//
// NO reemplaza lib/sii-lookup.ts (ese es el wrapper client-safe de SIIEnricher).

import { fetchWithTimeout, extractBetween, stripTags, ScraperUnavailableError } from '@/lib/scraper'

/** Exactamente la forma del campo `data` de /api/sii/lookup — el rol va afuera. */
export interface DatosSIIParseados {
  direccion_normalizada: string
  region: string
  comuna: string
  destino: string
  avaluo_fiscal_clp: number | null
  avaluo_fiscal_uf: number | null
  superficie_terreno_m2: number | null
  superficie_construida_m2: number | null
}

export interface ConsultaRolSII {
  ok: boolean
  /** Normalizado a "manzana-predio". Presente incluso cuando ok es false. */
  rol: string
  data?: DatosSIIParseados
  error?: string
}

/** "1234-56" o "1234" → { manzana: "1234", predio: "56"|"000" }. */
export function normalizarRolSII(rolRaw: string): { manzana: string; predio: string; rolNorm: string } {
  const [manzana, predio] = rolRaw.includes('-') ? rolRaw.split('-') : [rolRaw, '000']
  return { manzana, predio, rolNorm: `${manzana}-${predio}` }
}

// "1.234.567" → 1234567
function parseChileanNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseM2(raw: string): number | null {
  const match = raw.match(/([\d.,]+)\s*m?²?/i)
  if (!match) return null
  return parseChileanNumber(match[1])
}

/**
 * Consulta un rol en el SII y parsea la ficha. Sin auth ni rate limit: eso es
 * responsabilidad de la ruta, no del scraping — y es justamente lo que hacía
 * imposible ponerle un probe (un chequeo sintético no tiene sesión).
 *
 * Tres desenlaces DISTINTOS, que antes eran dos:
 *
 *   - lanza ScraperUnavailableError → el SII no respondió (red, HTTP no-2xx).
 *   - `{ ok: false, error }`        → respondió, pero no se parseó NINGÚN
 *     campo identificatorio. Antes esto devolvía `ok: true` con direccion:'',
 *     comuna:'' y todos los números en null — o sea "cambió el markup del SII"
 *     y "esta propiedad no tiene datos" se veían idénticos, y la ficha
 *     mostraba campos vacíos como si fueran el dato real.
 *   - `{ ok: true, data }`          → parseó al menos un campo identificatorio.
 */
// ---------------------------------------------------------------------------
// ENDPOINT DE REEMPLAZO — capturado en vivo el 05-08, listo para migrar.
//
// El CGI que usa la función de abajo está MUERTO: zeus.sii.cl/avalu_cgi/br/
// responde 403 al directorio, y tanto erc0000.sh como dbr_menu.sh dan 404. No
// es un parámetro mal armado, se fue toda la familia. El SII migró a una SPA
// (www4.sii.cl/mapasui) con API JSON detrás.
//
//   POST https://www4.sii.cl/mapasui/services/data/mapasFacadeService/getPredioNacional
//   {
//     "metaData": {
//       "namespace": "cl.sii.sdi.lob.bbrr.mapas.data.api.interfaces.MapasFacadeService/getPredioNacional",
//       "conversationId": "<string no vacío>",
//       "transactionId":  "<string no vacío>"
//     },
//     "data": { "predio": { "comuna": "15103", "manzana": "14", "predio": "345" }, "servicios": [] }
//   }
//
// SIN AUTENTICACIÓN: conversationId/transactionId los genera el cliente y solo
// se valida que no estén vacíos (la app oficial manda "UNAUTHENTICATED-CALL<ip>"
// y un UUID). Verificado con valores inventados: HTTP 200, errors: null, datos
// completos. No hace falta el handshake de settingsService/obtenerNuevaAut.
//
// Respuesta verificada para Providencia 1234 LC 1 (rol 14-345):
//   { rol, direccion, nombreComuna, destinoDescripcion, valorTotal: 198346511,
//     valorAfecto, valorExento, supTerreno: 0, supConsMt2: 0, medidaSupConst: "m²" }
//   Rol inexistente → HTTP 200 con data:null y errors:null (distingue "no
//   encontrado" de "error", a diferencia del CGI viejo).
//
// TRES COSAS QUE NO SON UN CAMBIO DE URL, y por las que esto no se migró en
// el acto:
//
//   1. supTerreno/supConsMt2 vienen en 0, NO en null. Mapearlos directo
//      persistiría "0 m²" como si fuera una medición — la misma confusión que
//      esta base de código viene corrigiendo (ver duration_ms en la migración
//      20260814, y gapScore 0 vs null). Hay que decidir explícitamente si el 0
//      de esta API significa "sin dato" y convertirlo.
//   2. No trae avalúo en UF, solo valorTotal en pesos. avaluo_fiscal_uf tendría
//      que calcularse con la UF del día o quedar en null declarado.
//   3. La comuna usa un CÓDIGO PROPIO DEL SII, no el de INE: Providencia es
//      15103, no 13123. Hace falta un mapeo; la lista completa (347 comunas
//      con {codigo, nombre}) sale de
//      POST mapasFacadeService/listComunas, el mismo estilo de payload.
// ---------------------------------------------------------------------------
export async function consultarRolEnSII(rolRaw: string, region = '13'): Promise<ConsultaRolSII> {
  const { manzana, predio, rolNorm } = normalizarRolSII(rolRaw)

  const url =
    `https://zeus.sii.cl/avalu_cgi/br/erc0000.sh` +
    `?RGN=${region}&MNZ=${manzana.padStart(4, '0')}&PRD=${predio.padStart(3, '0')}`

  let response: Response
  try {
    response = await fetchWithTimeout(url, {}, 15_000)
  } catch (err) {
    throw new ScraperUnavailableError('SII', err instanceof Error ? err.message : String(err))
  }
  if (!response.ok) {
    throw new ScraperUnavailableError('SII', `HTTP ${response.status} para rol ${rolNorm}`)
  }

  const html = await response.text()
  const campo = (marcador: string): string => {
    const raw = extractBetween(html, marcador, '</TD>')
    return raw ? stripTags(raw) : ''
  }

  const data: DatosSIIParseados = {
    direccion_normalizada: campo('DIRECCIÓN</TD>'),
    region: campo('REGIÓN</TD>'),
    comuna: campo('COMUNA</TD>'),
    destino: campo('DESTINO</TD>'),
    avaluo_fiscal_clp: parseChileanNumber(campo('AVALÚO FISCAL TOTAL</TD>').replace('$', '')),
    avaluo_fiscal_uf: parseChileanNumber(campo('AVALÚO FISCAL TOTAL UF</TD>').replace('UF', '')),
    superficie_terreno_m2: parseM2(campo('SUP.TERRENO</TD>')),
    superficie_construida_m2: parseM2(campo('SUP.CONSTRUIDA</TD>')),
  }

  // Los tres campos que SIEMPRE trae una ficha real. Que los tres salgan
  // vacíos no es un predio sin datos: es que no estamos leyendo una ficha.
  if (!data.direccion_normalizada && !data.comuna && !data.region) {
    return {
      ok: false,
      rol: rolNorm,
      error: `El SII respondió pero no se parseó ningún campo de la ficha del rol ${rolNorm} (¿rol inexistente, o cambió el markup?)`,
    }
  }

  return { ok: true, rol: rolNorm, data }
}

export interface SIILookupServerData {
  rol: string
  direccion_normalizada: string
  comuna: string
  destino: string
  avaluo_fiscal_clp: number | null
  avaluo_fiscal_uf: number | null
  superficie_terreno_m2: number | null
  superficie_construida_m2: number | null
}

// Best-effort/no lanza — si el SII no responde o el rol no existe, quien
// llama debe seguir sin cruce fiscal (mismo criterio que buscarDatosSII en
// app/api/tasacion/route.ts, del cual se extrajo esta función).
export async function buscarDatosSIIPorRol(
  rol: string,
  cookieHeader: string | null,
): Promise<SIILookupServerData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    // La ruta interna ya acota el fetch al SII (fetchWithTimeout, 15s), pero
    // nada acotaba este salto propio — un self-request colgado se comía el
    // maxDuration completo de Tasación/Due Diligence (120s) antes de que
    // saliera un solo token del stream.
    const res = await fetch(`${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(rol)}`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; rol?: string; data?: Omit<SIILookupServerData, 'rol'> }
    if (!json.ok || !json.data) return null
    return { ...json.data, rol: json.rol ?? rol }
  } catch (err) {
    console.warn('[sii-lookup-server] SII lookup falló (best-effort, continúa sin cruce fiscal):', err instanceof Error ? err.message : err)
    return null
  }
}
