import type {
  CompetidorDetectado,
  ResultadoCompetenciaFormato,
  FormatoComercial,
  NivelConfianza,
} from '@/lib/cabida-comercial'

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
