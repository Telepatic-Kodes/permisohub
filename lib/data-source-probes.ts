import { obtenerIsocrona } from '@/lib/isocrona'
import { obtenerPoblacionEnPoligono } from '@/lib/censo-manzana-server'
import { geocodeDireccion } from '@/lib/geocoding'
import { obtenerSenalesUbicacion } from '@/lib/terrenos-ubicacion'

// Probes sintéticos de las fuentes externas que viven en el CAMINO CRÍTICO de
// un request de usuario — no en un cron. recordSourceRun() ya cubría las
// fuentes pull (un scraper corre, deja fila ok/error); estas otras se invocan
// dentro de la request y su degradación se reparte como latencia entre
// usuarios reales, sin dejar rastro en ninguna tabla.
//
// El disparador concreto (05-08): la ficha de terreno tardaba 10,4 s contra
// 204 ms sin coordenadas, y el único detector fue un test que falló por
// timeout. El caché que se agregó ese mismo día bajó eso a 340 ms, pero al
// mismo tiempo dejó de generar muestras naturales de disponibilidad — mientras
// más alto el hit rate, más ciega queda la señal. De ahí que el probe pase de
// "sería lindo tener" a única fuente de esa medición.
//
// -------------------------------------------------------------------------
// DOS REGLAS QUE HACEN LA DIFERENCIA ENTRE UN PROBE ÚTIL Y UN VERDE FALSO
// -------------------------------------------------------------------------
//
// 1. Usar el CLIENTE REAL, no un fetch propio. Un probe con su propio HTTP
//    puede estar verde mientras el parser de la app está roto — mediría un
//    servicio que la app no consume de esa forma.
//
// 2. Afirmar sobre el CONTENIDO, no sobre el HTTP 200. Los dos clientes más
//    importantes de acá degradan en silencio a propósito:
//      - obtenerIsocrona() NUNCA falla: ante Valhalla caído devuelve un
//        círculo equivalente marcado metodo:'circulo_equivalente'. Un probe
//        que solo mire "¿devolvió geometría?" daría verde en un outage total.
//      - obtenerPoblacionEnPoligono() contra el FeatureServer equivocado
//        responde 200 con features:[] (ver 17-RESEARCH.md, Pitfall 3) — un
//        "0 personas" indistinguible de un dato real.
//    Por eso cada probe verifica el marcador de degradación / el volumen
//    mínimo esperado, no el status code.
//
// -------------------------------------------------------------------------
// FUERA DE ALCANCE, A PROPÓSITO (no es un olvido)
// -------------------------------------------------------------------------
//
// - sii-lookup-get (zeus.sii.cl): su parser vive dentro de
//   app/api/sii/lookup/route.ts, detrás de auth + rate limit. Un probe
//   tendría que duplicar el scraping (dos fuentes de verdad: el probe podría
//   dar verde con el parser real roto) o autenticarse. Lo honesto es extraer
//   ese scraper a lib/ primero; hasta entonces esta fuente NO está cubierta.
// - macro-indicadores-cron (mindicador.cl): es fuente pull con cron diario
//   propio; lo que le falta no es un probe sino una llamada a recordSourceRun()
//   en app/api/cron/noticias-macro/route.ts.
// - Frescura de ingesta ("¿hace cuánto que esta fuente no trae datos?"): es
//   otra pregunta y merece su propio semáforo. Mezclarla acá haría que un
//   scraper semanal se viera rojo todos los días.

export interface Probe {
  /** Debe existir en .planning/data-sources.yaml — lo valida el chequeo 5 de check-data-sources.mjs. */
  sourceId: string
  nombre: string
  /**
   * Mediana de latencia (ms) por sobre la cual la fuente se considera
   * degradada aunque responda bien. Calibrados contra medición real del
   * 05-08, con holgura ~4x sobre el valor observado: la idea es detectar un
   * cambio de régimen, no el jitter normal de una instancia comunitaria.
   */
  umbralLatenciaMs: number
  /**
   * Intentos antes de declarar fallo (default 2). Sube solo con evidencia:
   * Overpass está en 3 porque en la verificación en vivo del 05-08 devolvió
   * 504 en DOS intentos seguidos separados por 2 s, y minutos después
   * respondió normal en 1.971 ms. Con 2 intentos, ese hipo habría sido un
   * 'caido' — y una alerta que se equivoca seguido deja de leerse.
   */
  intentos?: number
  /** Pausa entre intentos (default PAUSA_REINTENTO_MS). Por fuente, porque no todas se recuperan al mismo ritmo. */
  pausaReintentoMs?: number
  /** Nunca debe lanzar por su cuenta; correrProbe() igual lo protege. */
  ejecutar: () => Promise<{ ok: boolean; detalle: string }>
}

// Punto fijo urbano y denso (Plaza Ñuñoa). Fijo a propósito: si el probe
// variara de ubicación, una caída de latencia sería indistinguible de "hoy
// tocó un punto más fácil".
const PUNTO_PROBE = { lat: -33.4553, lng: -70.5967 }

// Cuadrado de ~900 m sobre Providencia. Literal y NO derivado de la isócrona
// del probe anterior: si dependiera de Valhalla, un outage de Valhalla se
// propagaría como un falso rojo del censo.
const POLIGONO_PROBE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.615, -33.43],
      [-70.605, -33.43],
      [-70.605, -33.422],
      [-70.615, -33.422],
      [-70.615, -33.43],
    ],
  ],
}

/** Chile continental — sanity check grueso del geocoder, no precisión. */
const BBOX_CHILE = { latMin: -56, latMax: -17, lngMin: -76, lngMax: -66 }

export const PROBES: Probe[] = [
  {
    sourceId: 'isocrona-valhalla',
    nombre: 'Valhalla — isócrona peatonal 10 min',
    umbralLatenciaMs: 4000,
    ejecutar: async () => {
      const r = await obtenerIsocrona({ ...PUNTO_PROBE, minutos: 10, modo: 'caminando' })
      // La afirmación que importa: obtenerIsocrona() siempre devuelve algo.
      // 'circulo_equivalente' ES el modo de falla, no una alternativa válida.
      if (r.metodo !== 'red_vial') {
        return { ok: false, detalle: `degradó a ${r.metodo} — el proveedor no respondió una isócrona real` }
      }
      const vertices =
        r.geometria.type === 'Polygon'
          ? r.geometria.coordinates[0].length
          : r.geometria.coordinates[0][0].length
      if (vertices < 8) {
        return { ok: false, detalle: `isócrona sospechosamente simple (${vertices} vértices)` }
      }
      return { ok: true, detalle: `${r.proveedor}, ${vertices} vértices` }
    },
  },
  {
    sourceId: 'ine-censo-2017-manzana',
    nombre: 'ArcGIS INE — manzanas Censo 2017 en polígono de Providencia',
    umbralLatenciaMs: 6000,
    ejecutar: async () => {
      const r = await obtenerPoblacionEnPoligono(POLIGONO_PROBE)
      if (!r.ok) return { ok: false, detalle: r.error ?? 'consulta no exitosa' }
      // Cero manzanas en 900 m de Providencia NO es un dato: es el síntoma
      // exacto de estar apuntando al FeatureServer que solo cubre Atacama.
      if (r.manzanasIntersectadas === 0) {
        return { ok: false, detalle: 'respondió 200 pero con 0 manzanas — ¿FeatureServer equivocado?' }
      }
      return {
        ok: true,
        detalle: `${r.manzanasIntersectadas} manzanas, ${r.totalPersonas} personas (${r.comunasTocadas.join(', ')})`,
      }
    },
  },
  {
    sourceId: 'geocoding-nominatim',
    nombre: 'Nominatim — geocoding de dirección conocida',
    // Medido en vivo el 05-08: 52 ms (consulta fija, muy probablemente
    // cacheada del lado de Nominatim). 2 s deja ~40x de holgura y sigue
    // siendo mucho menos que el throttle de 1,1 s que el propio cliente se
    // impone — o sea, por sobre esto la latencia ya domina el request.
    umbralLatenciaMs: 2000,
    ejecutar: async () => {
      const r = await geocodeDireccion('Avenida Providencia 1234', 'Providencia')
      if (!r.ok || r.lat === undefined || r.lng === undefined) {
        return { ok: false, detalle: r.error ?? 'sin coordenadas' }
      }
      const dentro =
        r.lat >= BBOX_CHILE.latMin && r.lat <= BBOX_CHILE.latMax &&
        r.lng >= BBOX_CHILE.lngMin && r.lng <= BBOX_CHILE.lngMax
      if (!dentro) {
        return { ok: false, detalle: `coordenadas fuera de Chile (${r.lat}, ${r.lng})` }
      }
      return { ok: true, detalle: `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)} — ${r.comunaDetectada ?? 'sin comuna'}` }
    },
  },
  {
    sourceId: 'terrenos-ubicacion-overpass',
    nombre: 'Overpass — señales de ubicación en punto urbano',
    // El más alto de los cuatro: Overpass da 2 slots por IP y el cliente ya
    // tiene 5 s de piso de throttle + backoff en 429. Un umbral bajo acá
    // reportaría como degradación lo que es su comportamiento normal.
    // Medido en vivo el 05-08: 1.971 ms cuando responde bien.
    umbralLatenciaMs: 20000,
    intentos: 3,
    ejecutar: async () => {
      const r = await obtenerSenalesUbicacion(PUNTO_PROBE.lat, PUNTO_PROBE.lng)
      if (r === null) return { ok: false, detalle: 'respuesta vacía o no parseable' }
      return {
        ok: true,
        detalle: `${r.anchorsComercialesCercanos} anchors, avenida principal: ${r.cercaAvenidaPrincipal}`,
      }
    },
  },
]

export interface ResultadoProbe {
  sourceId: string
  nombre: string
  ok: boolean
  /** Latencia del ÚLTIMO intento — la que ve un usuario cuando el servicio responde. */
  durationMs: number | null
  /**
   * Intentos que hicieron falta. Se reporta aparte porque durationMs solo
   * describe el último: un probe que necesitó 2 intentos y 18 s de reloj se
   * vería idéntico a uno que anduvo a la primera en 2,4 s. Medido en vivo el
   * 05-08 con Overpass, que ante un 429 hace 20 s de backoff interno.
   */
  intentosUsados: number
  /** Reloj total de correrProbe(), incluyendo intentos fallidos y pausas. */
  totalMs: number
  detalle: string
  umbralLatenciaMs: number
}

const INTENTOS_DEFAULT = 2
const PAUSA_REINTENTO_MS = 3000

/**
 * Corre un probe midiendo latencia, con reintentos ante fallo.
 *
 * Los reintentos existen para que la política de clasificación pueda tratar
 * un 'error' como señal real: con probes diarios, exigir dos días
 * consecutivos de fallo para alertar sería alertar 24 h tarde; reintentar
 * dentro de la misma corrida distingue un blip de un outage sin esa demora.
 *
 * La latencia que se reporta es la del ÚLTIMO intento. Cuando el probe
 * termina ok esa es la buena (el intento que efectivamente funcionó); cuando
 * termina en fallo, esa duración es "cuánto tardó en fallar" y por eso
 * medianaLatencia() la descarta explícitamente.
 *
 * Nunca lanza — un probe que revienta es un probe que falló, no una corrida
 * de salud que se cae entera y deja a las otras fuentes sin medir.
 */
export async function correrProbe(probe: Probe): Promise<ResultadoProbe> {
  const maxIntentos = probe.intentos ?? INTENTOS_DEFAULT
  const inicioTotal = Date.now()
  let ultimo: { ok: boolean; detalle: string; durationMs: number } | null = null
  let intentosUsados = 0

  for (let intento = 1; intento <= maxIntentos; intento++) {
    intentosUsados = intento
    const inicio = Date.now()
    try {
      const r = await probe.ejecutar()
      ultimo = { ...r, durationMs: Date.now() - inicio }
    } catch (err) {
      ultimo = {
        ok: false,
        detalle: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        durationMs: Date.now() - inicio,
      }
    }
    if (ultimo.ok) break
    if (intento < maxIntentos) {
      await new Promise((resolve) => setTimeout(resolve, probe.pausaReintentoMs ?? PAUSA_REINTENTO_MS))
    }
  }

  const detalleBase = ultimo?.detalle ?? 'el probe no llegó a ejecutarse'

  return {
    sourceId: probe.sourceId,
    nombre: probe.nombre,
    ok: ultimo?.ok ?? false,
    durationMs: ultimo?.durationMs ?? null,
    intentosUsados,
    totalMs: Date.now() - inicioTotal,
    // El conteo de intentos se anexa al detalle SOLO cuando hubo más de uno:
    // así queda en la serie persistida (que es donde se ve la tendencia) sin
    // ensuciar el caso normal. Un "ok" que necesitó 2 intentos no puede
    // guardarse igual que uno que anduvo a la primera.
    detalle: intentosUsados > 1 ? `${detalleBase} [${intentosUsados} intentos]` : detalleBase,
    umbralLatenciaMs: probe.umbralLatenciaMs,
  }
}
