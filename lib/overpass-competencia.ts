import { fetchWithTimeout } from '@/lib/scraper'

// ---------------------------------------------------------------------------
// Overpass API — competidores REALES (nombre/tag/coordenadas) para el motor
// de Cabida Comercial (Fase 18, COMPE-02/COMPE-03). Módulo NUEVO, separado
// de lib/terrenos-ubicacion.ts a propósito: ese archivo está scoped al
// dominio Terrenos (enriquecerTerreno(), "out count" agregado) — este
// archivo sirve al dominio Mercado Inmobiliario / Cabida Comercial, que
// necesita el detalle por-POI (nombre, tag, coordenadas), no solo un
// conteo. Mismo criterio ya documentado en ARCHITECTURE.md para esta fase.
//
// THROTTLE INDEPENDIENTE (tradeoff consciente, no un descuido): este módulo
// tiene su PROPIA instancia de lastRequestAt, no comparte la de
// terrenos-ubicacion.ts. Las llamadas de competencia son gatilladas por
// click de usuario (no por un cron/backfill masivo), así que el riesgo real
// de colisión de quota entre ambos módulos es bajo — y acoplar los
// throttles de dos dominios distintos por un caso de baja probabilidad no
// vale la complejidad.
// ---------------------------------------------------------------------------

let lastRequestAt = 0
const MIN_INTERVAL_MS = 5000
const RATE_LIMIT_BACKOFF_MS = 20_000

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed))
  }
  lastRequestAt = Date.now()
}

// Radio fijo generoso (Open Question 3, 18-RESEARCH.md) — cubre la
// extensión de una isócrona de 15 min caminando/auto en cualquier
// dirección. El filtrado de precisión real contra el polígono de la
// isócrona pasa DESPUÉS, vía turf.booleanPointInPolygon (ver
// obtenerCompetidoresOverpass).
const RADIO_COMPETENCIA_M = 3000

// Señal explícita de "el servicio está temporalmente no disponible" — mismo
// comportamiento que OverpassUnavailableError en terrenos-ubicacion.ts,
// redeclarada acá (no importada) para mantener independencia de dominio.
export class OverpassUnavailableError extends Error {
  constructor(reason: string) {
    super(`Overpass no disponible: ${reason}`)
    this.name = 'OverpassUnavailableError'
  }
}

// Tipo crudo del elemento Overpass con "out center tags": nodes traen
// lat/lon directo; ways solo traen center:{lat,lon} (el centroide de la
// geometría de la vía/área — necesario porque "out center" no expande la
// geometría completa, solo su centro).
interface OverpassElement {
  type: 'node' | 'way'
  lat?: number // presente en node
  lon?: number // presente en node
  center?: { lat: number; lon: number } // presente en way (con "out center")
  tags?: { shop?: string; name?: string; brand?: string }
}

function construirQuery(lat: number, lng: number, radioM: number): string {
  // Cambio mecánico clave respecto a terrenos-ubicacion.ts: "out center
  // tags" en vez de "out count" — esto retorna coordenadas Y tags por
  // elemento; "out count" los descarta por diseño. shop=convenience se
  // agrega acá (ausente en la query original), requerido por COMPE-03 para
  // detectar competidores de formato minimarket.
  return `[out:json][timeout:20];
(
  node["shop"~"^(supermarket|convenience|mall|department_store)$"](around:${radioM},${lat},${lng});
  way["shop"~"^(supermarket|convenience|mall|department_store)$"](around:${radioM},${lat},${lng});
)->.competidores;
.competidores out center tags;`
}

async function consultarOverpass(lat: number, lng: number, radioM: number): Promise<Response> {
  const query = construirQuery(lat, lng, radioM)

  return fetchWithTimeout(
    'https://overpass-api.de/api/interpreter',
    {
      method: 'POST',
      // Mismo pitfall ya documentado en terrenos-ubicacion.ts: el
      // User-Agent por defecto de fetchWithTimeout ('Mozilla/5.0
      // (compatible; PermisoHub/1.0)') es rechazado con 406 por el WAF de
      // Apache de Overpass — el patrón "(compatible; ...)" calza con firmas
      // de bots falsos. Overpass pide un UA honesto con contacto.
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'PermisoHub/1.0 (+https://permisohub.cl)',
      },
      body: `data=${encodeURIComponent(query)}`,
    },
    20_000,
  )
}
