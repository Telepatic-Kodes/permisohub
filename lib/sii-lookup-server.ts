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
