// Server-only. Dos cosas viven acá:
//
//   1. consultarRolEnSII() — la consulta al SII y la normalización de su
//      respuesta, extraída de app/api/sii/lookup/route.ts el 05-08 para que la
//      ruta Y el probe de salud consuman LA MISMA función. Un probe con su
//      propia copia puede estar verde mientras el camino real está roto, que es
//      exactamente el modo de falla que este subsistema existe para evitar.
//
//   2. buscarDatosSIIPorRol() — cliente HTTP hacia la ruta interna, para las
//      rutas de IA (tasación, due-diligence-propiedad).
//
// NO reemplaza lib/sii-lookup.ts (ese es el wrapper client-safe de SIIEnricher).
//
// =============================================================================
// MIGRACIÓN AL ENDPOINT NUEVO — hecha el 06-08. Lo que sigue es el resultado de
// tres días de investigación; está acá y no en un informe porque quien vuelva a
// tocar esto lo necesita a mano.
//
// EL CGI VIEJO ESTÁ MUERTO. zeus.sii.cl/avalu_cgi/br/ responde 403 al directorio
// y 404 a erc0000.sh y dbr_menu.sh: se fue toda la familia, no es un parámetro
// mal armado. El SII migró a una SPA (www4.sii.cl/mapasui) con API JSON detrás.
// El scraping de HTML que vivía acá se borró en esta misma migración: ya no
// había nada que parsear.
//
// SIN AUTENTICACIÓN. conversationId/transactionId los genera el cliente y solo
// se valida que no vengan vacíos (la app oficial manda "UNAUTHENTICATED-CALL<ip>"
// y un UUID). Verificado con valores inventados. No hace falta el handshake de
// settingsService/obtenerNuevaAut.
//
// LO QUE SE PIERDE, y por qué no hubo alternativa:
//
//   - SUPERFICIES. supTerreno y supConsMt2 vienen SIEMPRE en 0. Evidencia: 14
//     predios, 3 comunas (Providencia, La Florida, Pirque), 6 destinos
//     (ESTACIONAMIENTO, BODEGA, OFICINA, COMERCIO, HABITACIONAL, SALUD), tanto
//     unidades en edificio como lotes con terreno propio.
//     LA HIPÓTESIS QUE SE PROBÓ Y FALLÓ, para que nadie la repita: se sospechó
//     que los ceros eran copropiedad (para una unidad el terreno es bien común,
//     así que 0 sería el dato correcto). Se testeó con una casa en villa de La
//     Florida —HABITACIONAL, urbana, lote propio, rol 1112-6— y dio 0 igual que
//     un estacionamiento.
//     Explicación que sí queda en pie, sin efecto para nosotros: la ficha
//     oficial muestra "0 m²" al visitante anónimo, y la app manda un `tokenARSII`
//     (cookie ARSII_AVA_RECURSO) que no tenemos. Es plausible que las
//     superficies solo se pueblen para el contribuyente dueño, autenticado.
//     DESCARTADO como origen alternativo: getDatosCsa son sectores agrícolas y
//     getDatosAh son áreas homogéneas (devuelve valorUnitario y rangoSuperficie
//     DEL ÁREA, no del predio).
//     Por eso superficie_terreno_m2 y superficie_construida_m2 SE ELIMINARON de
//     todo el camino del SII (esta interfaz, SIIData, el enricher y el prompt de
//     Tasación) en vez de dejarse en null. Un campo estructuralmente vacío no es
//     un dato faltante, es código muerto que hace creer que algún día llega. Las
//     columnas de la BD siguen existiendo: las llena el arquitecto a mano, que
//     ahora es su única fuente.
//
// LO QUE SE GANA, que el CGI no daba:
//   - lat/lng del predio. OJO: en la respuesta del SII, `ubicacionX` es la
//     LATITUD e `ubicacionY` la LONGITUD, al revés de lo que sugieren los
//     nombres. No es interpretación nuestra: así lo usa su propio
//     detalle-controller.js, y cuadra con las coordenadas reales.
//   - Rol inexistente → HTTP 200 con data:null, en vez del HTML ambiguo del CGI.
//   - Disponibles y sin consumidor todavía (por eso no se mapean): `ubicacion`
//     (URBANA/RURAL), `valorAfecto`/`valorExento` por separado, `ah` (código de
//     área homogénea, insumo de Tasación vía getDatosAh) y `periodo` (a qué
//     reavalúo corresponde el dato — el CGI nunca lo dijo).
//
// EL AVALÚO EN UF SE CALCULA, no viene. El endpoint solo entrega pesos. Se
// convierte con la UF del día (lib/uf-server.ts, caché 24h y constante de
// respaldo), así que el campo se conserva en vez de perderse.
//
// RATE LIMIT — el riesgo operacional de este módulo. ~40 requests en ~3 minutos
// devolvieron `HTTP 429: Se ha superado el límite de conexiones permitidas`, y
// el bloqueo NO cedió en más de una hora (5 sondas, una cada 10 min, sin header
// Retry-After). El texto además dice que las consultas recurrentes infringen las
// condiciones de uso del sitio.
// Por qué igual es viable: todo el consumo del SII en esta app es BAJO DEMANDA y
// por registro — creación de proyecto, enriquecer-sii de una propiedad,
// Tasación, Due Diligence. No hay ni hubo nunca un cron que barra la cartera; se
// verificó contra vercel.json y contra todos los usos de rol_sii. Un barrido es
// justamente lo que NO se puede agregar acá: se auto-bloquearía en la primera
// corrida y dejaría sin SII a los usuarios interactivos, que salen por la misma
// IP.
//
// CÓMO SEGUIR INVESTIGANDO SIN GASTAR CUOTA: los estáticos de la SPA no están
// rate-limited (responden 200 con la API bloqueada), así que el contrato se lee
// del código del propio SII en vez de adivinarlo a fuerza de requests:
//   /mapasui/common/js/services.js               → los 17 métodos del facade
//   /mapasui/common/_content/js/*-controller.js  → la forma de cada payload
//   /mapasui/common/_content/detalle-predio.html → qué campos muestra la ficha
// Y para encontrar roles reales sin picar manzanas al azar: getPrediosDireccion
// devuelve TODOS los roles de una calle en UNA request (2.992 para Froilán Roa
// en La Florida). Buscar por dirección y luego pedir detalle cuesta 2 requests;
// adivinar cuesta decenas y gatilla el 429.
// =============================================================================

import { fetchWithTimeout, ScraperUnavailableError, ScraperRateLimitedError } from '@/lib/scraper'
import { codigosSIIPorComuna } from '@/lib/comunas-sii'
import { obtenerUfActual } from '@/lib/uf-server'

const ENDPOINT = 'https://www4.sii.cl/mapasui/services/data/mapasFacadeService/getPredioNacional'
const NAMESPACE =
  'cl.sii.sdi.lob.bbrr.mapas.data.api.interfaces.MapasFacadeService/getPredioNacional'

/** Exactamente la forma del campo `data` de /api/sii/lookup — el rol va afuera. */
export interface DatosSIIParseados {
  direccion_normalizada: string
  comuna: string
  destino: string
  avaluo_fiscal_clp: number | null
  /** Calculado con la UF del día; null si no vino el avalúo en pesos. */
  avaluo_fiscal_uf: number | null
  lat: number | null
  lng: number | null
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

/** Solo los campos que consumimos. El SII devuelve bastantes más. */
interface PredioSII {
  direccion?: string | null
  nombreComuna?: string | null
  destinoDescripcion?: string | null
  valorTotal?: number | null
  /** LATITUD, pese al nombre. */
  ubicacionX?: number | null
  /** LONGITUD, pese al nombre. */
  ubicacionY?: number | null
}

/**
 * Una consulta al SII para un (comuna, manzana, predio).
 *
 * Devuelve null cuando el predio no existe — que el SII distingue limpiamente
 * de un error respondiendo HTTP 200 con data:null.
 */
async function pedirPredio(
  codigoComuna: string,
  manzana: string,
  predio: string,
): Promise<PredioSII | null> {
  const body = JSON.stringify({
    metaData: { namespace: NAMESPACE, conversationId: 'permisohub', transactionId: `permisohub-${codigoComuna}` },
    data: { predio: { comuna: codigoComuna, manzana, predio }, servicios: [] },
  })

  let response: Response
  try {
    response = await fetchWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Accept: '*/*' NO es descuido, es obligatorio. El servidor del SII
          // devuelve HTTP 500 ante un Accept que no incluya */* — verificado el
          // 06-08: 'application/json' → 500, 'text/html,application/xhtml+xml'
          // → 500, '*/*' → 200, 'application/json, */*' → 200. Y el default de
          // fetchWithTimeout es justamente 'text/html,...', así que hay que
          // pisarlo o toda consulta falla.
          // Costó encontrarlo porque los tests con stub pasaban perfecto: el
          // payload era correcto, lo que rompía era un header que agregaba el
          // helper. Solo apareció al llamar al SII de verdad.
          Accept: '*/*',
        },
        body,
      },
      15_000,
    )
  } catch (err) {
    throw new ScraperUnavailableError('SII', err instanceof Error ? err.message : String(err))
  }

  // El 429 se distingue ANTES de mirar el body, y no por prolijidad: la página
  // de bloqueo es HTML, así que leerla como JSON falla con un mensaje que no
  // menciona el bloqueo, y el 429 se termina reportando como "el SII cambió el
  // formato" o como "este predio no existe". Ambas conclusiones ya se sacaron
  // por error durante la investigación.
  if (response.status === 429) throw new ScraperRateLimitedError('SII')
  if (!response.ok) throw new ScraperUnavailableError('SII', `HTTP ${response.status}`)

  let json: { data?: PredioSII | null }
  try {
    json = (await response.json()) as { data?: PredioSII | null }
  } catch (err) {
    throw new ScraperUnavailableError('SII', `respuesta no es JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  return json.data ?? null
}

/**
 * Consulta un rol en el SII. Sin auth ni rate limit propios: eso es
 * responsabilidad de la ruta, no de la consulta — y es justamente lo que hacía
 * imposible ponerle un probe (un chequeo sintético no tiene sesión).
 *
 * `comuna` es el NOMBRE tal como lo usa la app ("Providencia", "La Florida").
 * El SII pide un código propio suyo y el mapeo vive en lib/comunas-sii.ts.
 *
 * Tres desenlaces distintos:
 *   - lanza ScraperRateLimitedError → nos bloquearon (HTTP 429).
 *   - lanza ScraperUnavailableError → el SII no respondió (red, HTTP no-2xx).
 *   - `{ ok: false, error }`        → respondió y el rol no existe en esa
 *     comuna, o la comuna no tiene código SII. No es lo mismo que un fallo, y
 *     por eso no lanza.
 *   - `{ ok: true, data }`          → predio encontrado.
 */
export async function consultarRolEnSII(rolRaw: string, comuna: string): Promise<ConsultaRolSII> {
  const { manzana, predio, rolNorm } = normalizarRolSII(rolRaw)

  // Santiago son TRES códigos (13101, más 13134/13135 que son subdivisiones
  // internas del SII con predios propios), así que esto itera. Para las otras
  // 346 comunas el arreglo trae un solo elemento y se resuelve en una request.
  const codigos = codigosSIIPorComuna(comuna)
  if (codigos.length === 0) {
    return {
      ok: false,
      rol: rolNorm,
      error: `No hay código SII para la comuna "${comuna}". Revisa el nombre, o la comuna no está en el padrón del SII.`,
    }
  }

  for (const codigo of codigos) {
    const p = await pedirPredio(codigo, manzana, predio)
    if (!p) continue

    // El avalúo en UF se calcula, no viene. Solo se pide la UF si hay avalúo
    // que convertir — está cacheada 24h, pero no hay razón para tocarla si no.
    let avaluoUf: number | null = null
    const avaluoClp = typeof p.valorTotal === 'number' ? p.valorTotal : null
    if (avaluoClp !== null) {
      const uf = await obtenerUfActual()
      avaluoUf = Math.round((avaluoClp / uf.valor) * 100) / 100
    }

    return {
      ok: true,
      rol: rolNorm,
      data: {
        direccion_normalizada: p.direccion?.trim() ?? '',
        // El nombre que devuelve el SII, no el de entrada: para Santiago puede
        // ser "SANTIAGO OESTE", y decir dónde está realmente el predio es más
        // útil que devolver el nombre que ya nos habían dado.
        comuna: p.nombreComuna?.trim() ?? comuna,
        destino: p.destinoDescripcion?.trim() ?? '',
        avaluo_fiscal_clp: avaluoClp,
        avaluo_fiscal_uf: avaluoUf,
        lat: typeof p.ubicacionX === 'number' ? p.ubicacionX : null,
        lng: typeof p.ubicacionY === 'number' ? p.ubicacionY : null,
      },
    }
  }

  return {
    ok: false,
    rol: rolNorm,
    error: `El SII no tiene un predio con rol ${rolNorm} en ${comuna}.`,
  }
}

export interface SIILookupServerData {
  rol: string
  direccion_normalizada: string
  comuna: string
  destino: string
  avaluo_fiscal_clp: number | null
  avaluo_fiscal_uf: number | null
  lat: number | null
  lng: number | null
}

// Best-effort/no lanza — si el SII no responde o el rol no existe, quien
// llama debe seguir sin cruce fiscal (mismo criterio que buscarDatosSII en
// app/api/tasacion/route.ts, del cual se extrajo esta función).
export async function buscarDatosSIIPorRol(
  rol: string,
  comuna: string,
  cookieHeader: string | null,
): Promise<SIILookupServerData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    // La ruta interna ya acota el fetch al SII (fetchWithTimeout, 15s), pero
    // nada acotaba este salto propio — un self-request colgado se comía el
    // maxDuration completo de Tasación/Due Diligence (120s) antes de que
    // saliera un solo token del stream.
    const params = new URLSearchParams({ rol, comuna })
    const res = await fetch(`${baseUrl}/api/sii/lookup?${params.toString()}`, {
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
