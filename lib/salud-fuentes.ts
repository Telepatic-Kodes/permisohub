// Clasificación de salud de una fuente externa a partir de su historial de
// probes. Módulo PURO a propósito: sin fetch, sin Supabase, sin Date.now() —
// todo entra por parámetro. Es la única parte de este subsistema que decide
// "esto amerita despertarte", así que es la que tiene que ser testeable de
// verdad y la que conviene discutir por separado del plumbing.
//
// Lo consumen dos lados: la ruta cron (para decidir si alerta a Sentry) y la
// página /admin/salud-datos (para pintar el semáforo). Misma función en los
// dos = imposible que el semáforo diga verde mientras la alerta dice rojo.

export type EstadoSalud = 'ok' | 'lento' | 'caido' | 'sin_datos'

export interface MedicionProbe {
  ok: boolean
  /** null = no se midió. NO es 0. Ver comentario de duration_ms en la migración. */
  durationMs: number | null
  /** ISO. Se asume orden descendente (más reciente primero) al clasificar. */
  ranAt: string
}

/**
 * Cuántas mediciones mirar hacia atrás para la mediana de latencia.
 * Con un probe diario esto es "la última semana laboral": suficiente para que
 * un pico aislado no dispare, corto para que una degradación sostenida no
 * tarde un mes en aparecer.
 */
export const VENTANA_LATENCIA = 5

export function medianaLatencia(mediciones: MedicionProbe[]): number | null {
  // Solo mediciones con latencia REAL. Un probe fallido no aporta latencia
  // (su duración es "cuánto tardó en fallar", que no es lo mismo que cuánto
  // tarda el servicio cuando funciona) y un null tampoco.
  const valores = mediciones
    .filter((m) => m.ok && m.durationMs !== null)
    .map((m) => m.durationMs as number)
    .sort((a, b) => a - b)

  if (valores.length === 0) return null
  const medio = Math.floor(valores.length / 2)
  return valores.length % 2 === 1 ? valores[medio] : Math.round((valores[medio - 1] + valores[medio]) / 2)
}

/**
 * Estado de una fuente dado su historial de probes (más reciente primero).
 *
 * La política, explícita para que se pueda discutir:
 *
 * - Historial vacío → 'sin_datos', NUNCA 'ok'. "No lo medí" y "lo medí y está
 *   bien" son cosas distintas; colapsarlas es exactamente el bug que produce
 *   un tablero todo verde el día que el probe dejó de correr.
 * - Último probe fallido → 'caido'. Un solo fallo alcanza porque el probe ya
 *   reintenta internamente (ver correrProbe en lib/data-source-probes.ts):
 *   cuando llega acá, un 'error' significa dos fallos seguidos, no un blip.
 * - Último probe ok pero la MEDIANA de la ventana supera el umbral → 'lento'.
 *   Mediana y no último valor: un pico aislado en una instancia comunitaria
 *   es normal, una mediana degradada es un cambio de régimen.
 *
 * Trade-off consciente: esto detecta "el servicio responde mal", NO "el dato
 * que devuelve está mal". Un Valhalla que responde rápido con geometrías
 * basura sale 'ok' acá — esa clase de fallo la tiene que atrapar la aserción
 * de contenido dentro de cada probe, no esta función.
 */
export function clasificarSalud(historial: MedicionProbe[], umbralLatenciaMs: number): EstadoSalud {
  if (historial.length === 0) return 'sin_datos'
  if (!historial[0].ok) return 'caido'

  const mediana = medianaLatencia(historial.slice(0, VENTANA_LATENCIA))
  if (mediana !== null && mediana > umbralLatenciaMs) return 'lento'

  return 'ok'
}

/** Solo 'caido' y 'lento' ameritan despertar a alguien. */
export function ameritaAlerta(estado: EstadoSalud): boolean {
  return estado === 'caido' || estado === 'lento'
}

// ---------------------------------------------------------------------------
// Salud de una corrida de INGESTA (scraper/cron), no de un probe.
//
// Vive en el mismo módulo que clasificarSalud() porque responde la misma
// familia de pregunta —"¿esto que parece sano lo es?"— y porque la
// alternativa era que terrenos-server importara la política desde
// mercado-locales-server, acoplando dos dominios que no se conocen.
// ---------------------------------------------------------------------------

export interface SaludDeCorrida {
  status: 'ok' | 'error'
  detail: string
  errorMessage?: string
}

/**
 * Forma mínima que necesita saludDeCorrida(). Estructural a propósito: la
 * cumplen tanto ResultadoDescubrimientoMercadoLocales como el resultado del
 * pipeline de terrenos, que son tipos distintos con la misma pregunta detrás
 * ("¿esta corrida trajo algo, y lo que no trajo fue porque no había o porque
 * no pude preguntar?"). Una sola política para los dos.
 */
export interface CorridaDescubrimiento {
  encontrados: number
  guardados: number
  comunasBuscadas: number
  fallosDeFuente: number
  errors: string[]
}

/**
 * Traduce una corrida de descubrimiento a lo que se persiste en
 * data_source_runs. Pura y compartida por las 4 rutas de mercado-locales,
 * para que no puedan divergir en qué consideran "una corrida sana".
 *
 * Tres condiciones de error, las tres apuntando al mismo agujero:
 *
 *  1. `encontrados === 0` CON fallos de fuente. Cero filas por sí solo puede
 *     ser legítimo; cero filas porque no se pudo consultar la fuente no lo es,
 *     y hasta el 05-08 se archivaban idénticos (`status: 'ok', row_count: 0`).
 *  2. Más de la mitad de los pares comuna×operación inalcanzables, aunque el
 *     resto haya traído filas. Sin esto, una corrida con 70 de 72 pares caídos
 *     que igual guarda algo se vería sana.
 *  3. Cero resultados en TODO un universo grande, aunque no se haya registrado
 *     ni un fallo. Esta se agregó después de las otras dos, corriendo la ruta
 *     real: Portalinmobiliario devolvía 200 en los 72 pares (redirigido a su
 *     página de verificación de cuenta) y la corrida salía `ok` con
 *     `fallosDeFuente: 0`, porque técnicamente nada había fallado. Un mercado
 *     vivo que esta madrugada trajo 2.408 filas no tiene cero publicaciones en
 *     72 pares comuna×operación; una sola comuna vacía sí es plausible, y por
 *     eso el umbral y no un `=== 0` a secas.
 *
 * Deliberadamente NO marca error ante fallos aislados: con 72 pares, un
 * timeout suelto es esperable, y una alerta que salta todos los días deja de
 * leerse. Ese caso queda en `detail`, que es la serie donde se ve si los
 * fallos aislados están creciendo.
 */
export function saludDeCorrida(resultado: CorridaDescubrimiento): SaludDeCorrida {
  const { encontrados, guardados, comunasBuscadas, fallosDeFuente, errors } = resultado
  const detail = `${encontrados} encontrados, ${guardados} guardados, ${fallosDeFuente}/${comunasBuscadas} pares sin respuesta de la fuente`

  const cieloRaso = encontrados === 0 && fallosDeFuente > 0
  const mayoriaCaida = fallosDeFuente > comunasBuscadas / 2
  const universoVacio = encontrados === 0 && comunasBuscadas >= UNIVERSO_MINIMO_PARA_EXIGIR_RESULTADOS

  if (cieloRaso || mayoriaCaida || universoVacio) {
    const errorMessage = cieloRaso
      ? `Cero resultados con ${fallosDeFuente} pares sin respuesta — la fuente no se pudo consultar, no es que no haya publicaciones. Primeros: ${errors.slice(0, 3).join(' | ')}`
      : mayoriaCaida
        ? `${fallosDeFuente} de ${comunasBuscadas} pares sin respuesta. Primeros: ${errors.slice(0, 3).join(' | ')}`
        : `Cero resultados en ${comunasBuscadas} pares sin que nadie reportara un fallo — la fuente respondió, pero no devolvió nada parseable (¿cambió el markup, o es un bloqueo suave que responde 200?).`

    return { status: 'error', detail, errorMessage }
  }

  return { status: 'ok', detail }
}

/**
 * Bajo este tamaño de universo, cero resultados es plausible de verdad (una
 * comuna chica sin locales publicados, un tipo de propiedad poco común). Por
 * encima, cero significa que algo se rompió: el pipeline cubre 36 comunas × 2
 * operaciones y ninguna corrida sana ha bajado de las centenas.
 */
const UNIVERSO_MINIMO_PARA_EXIGIR_RESULTADOS = 8
