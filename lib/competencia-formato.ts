import type {
  UbicacionCabida,
  CompetidorDetectado,
  ResultadoCompetenciaFormato,
  FormatoComercial,
  NivelConfianza,
} from '@/lib/cabida-comercial'
import { obtenerCompetidoresOverpass } from '@/lib/overpass-competencia'
import { obtenerCadenasGeocodificadasPorComuna } from '@/lib/cadenas-sucursales-server'
import { obtenerCompetidoresSeedList } from '@/lib/strip-power-centers-chile'
import * as turf from '@turf/turf'

const NIVEL_ORDEN: Record<NivelConfianza, number> = { baja: 0, media: 1, alta: 2 }
const TOPE_CONFIANZA_GLOBAL: NivelConfianza = 'media' // v1.7: coberturaConocida es SIEMPRE false — nunca 'alta' a nivel global

const ES_FORMATO_SUPER_MINI = (formato: FormatoComercial) =>
  formato === 'supermercado' || formato === 'minimarket'

// Fragmentos de disclosure citando explícitamente el id de la entrada de
// data-sources.yaml correspondiente — grep-eables, un solo lugar para editar
// si el gap alguna vez se resuelve (ej. Unimarc entra al roster SII).
const DISCLOSURE_GAP_SUPER_MINI =
  'Unimarc no está en el roster SII (ver data-sources.yaml → sii-nomina-sucursales-holdings-sin-tiendas)'
const DISCLOSURE_GAP_STRIP_POWER =
  'Grupo Patio y Más Center no tienen ningún activo nombrado en la lista curada (ver data-sources.yaml → strip-power-centers-chile-seed)'

function construirDisclosure(formato: FormatoComercial, count: number): string {
  const prefijo =
    count === 0
      ? 'No se encontraron competidores en el área de influencia, pero'
      : `Se encontraron ${count} competidor${count === 1 ? '' : 'es'} en el área de influencia, pero`

  const gap = ES_FORMATO_SUPER_MINI(formato) ? DISCLOSURE_GAP_SUPER_MINI : DISCLOSURE_GAP_STRIP_POWER
  return `${prefijo} la cobertura de la fuente es parcial: ${gap}. Un conteo bajo o cero NO confirma ausencia de competencia.`
}

/**
 * Función PURA — no hace fetch/I/O. Recibe competidores ya resueltos por las
 * 3 fuentes (Overpass, seed list, SII geocodificado — ver Plan 18-06) y
 * produce el resultado final con confianza degradada. COMPE-05: nunca deja
 * que competidores.length === 0 se lea como "confirmado: sin competencia".
 */
export function calcularResultadoCompetencia(
  competidores: CompetidorDetectado[],
  formato: FormatoComercial
): ResultadoCompetenciaFormato {
  const confianzaGlobal: NivelConfianza =
    competidores.length === 0
      ? 'baja'
      : (() => {
          const minima = competidores.reduce(
            (min, c) => (NIVEL_ORDEN[c.confianza] < NIVEL_ORDEN[min] ? c.confianza : min),
            competidores[0].confianza
          )
          return NIVEL_ORDEN[minima] > NIVEL_ORDEN[TOPE_CONFIANZA_GLOBAL] ? TOPE_CONFIANZA_GLOBAL : minima
        })()

  return {
    formato,
    competidores,
    coberturaConocida: false, // v1.7: ambas fuentes (roster SII, seed list strip/power) tienen gaps documentados para los 4 formatos — nunca true
    confianzaGlobal,
    disclosure: construirDisclosure(formato, competidores.length),
    consultadoEl: new Date().toISOString(),
  }
}

const RADIO_COMPETENCIA_DEFAULT_M = 3000
const RADIO_MATCH_CADENA_SII_M = 150 // distancia máxima para considerar que un POI OSM y una fila SII geocodificada son la MISMA tienda física

/**
 * Orquestador ASYNC (Plan 18-06) — compone las 3 fuentes ya construidas en
 * waves anteriores (Overpass, seed list strip/power, geocoding SII) en un
 * único ResultadoCompetenciaFormato por formato. Standalone: no depende de
 * lib/cabida-comercial-server.ts (todavía no existe, Fase 16), a propósito —
 * es la pieza que un futuro obtenerAnalisisCabidaComercial() simplemente va
 * a importar y llamar (ver Plan 18-07).
 *
 * NOTA throttle: obtenerCompetidoresOverpass() (este archivo) y
 * lib/terrenos-ubicacion.ts mantienen instancias de throttle INDEPENDIENTES
 * a propósito — tradeoff aceptado, ver comentario de cabecera en
 * lib/overpass-competencia.ts (Pitfall 2, 18-RESEARCH.md).
 */
export async function obtenerCompetenciaPorFormato(
  ubicacion: UbicacionCabida,
  formato: FormatoComercial,
  isocronaGeometria?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null,
  radioM: number = RADIO_COMPETENCIA_DEFAULT_M
): Promise<ResultadoCompetenciaFormato> {
  let competidores: CompetidorDetectado[]

  if (formato === 'strip_center' || formato === 'power_center') {
    competidores = obtenerCompetidoresSeedList(formato, ubicacion, radioM, isocronaGeometria)
  } else {
    // supermercado / minimarket — Overpass y geocoding SII son DOS recursos
    // externos independientes (Overpass API vs Nominatim) con throttles
    // independientes: correrlos en paralelo, no secuencial (anti-patrón
    // documentado en 18-RESEARCH.md, mismo criterio que
    // app/api/zonificacion/lookup/route.ts ya usa).
    const [todosOsm, cadenasGeocodificadas] = await Promise.all([
      obtenerCompetidoresOverpass(ubicacion.lat, ubicacion.lng, isocronaGeometria),
      obtenerCadenasGeocodificadasPorComuna(ubicacion.comuna),
    ])

    const deEsteFormato = todosOsm.filter((c) => c.formato === formato)

    // Cruce espacial: para cada POI OSM, buscar la sucursal SII geocodificada
    // más cercana dentro de RADIO_MATCH_CADENA_SII_M — si hay match, sustituir
    // el nombre/tag genérico por el nombre real de cadena y subir confianza
    // individual a 'alta' (corroboración independiente, ver Pitfall 3 de
    // PITFALLS.md: "exigir corroboración con al menos una señal independiente
    // antes de alcanzar confianza ALTA").
    competidores = deEsteFormato.map((poi) => {
      const puntoPoi = turf.point([poi.lng, poi.lat])
      let mejorMatch: { cadena: string; distanciaM: number } | null = null
      for (const c of cadenasGeocodificadas) {
        const d = turf.distance(puntoPoi, turf.point([c.lng, c.lat]), { units: 'meters' })
        if (d <= RADIO_MATCH_CADENA_SII_M && (!mejorMatch || d < mejorMatch.distanciaM)) {
          mejorMatch = { cadena: c.cadena, distanciaM: d }
        }
      }
      if (!mejorMatch) return poi
      return { ...poi, nombre: mejorMatch.cadena, fuente: 'sii_geocodificado' as const, confianza: 'alta' as const }
    })
  }

  return calcularResultadoCompetencia(competidores, formato)
}
