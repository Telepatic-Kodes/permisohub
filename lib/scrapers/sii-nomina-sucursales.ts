import JSZip from 'jszip'
import { reportError, reportWarning } from '@/lib/observability'

// ---------------------------------------------------------------------------
// Nómina nacional de direcciones del SII — fuente para detectar expansión de
// cadenas comerciales (nuevas sucursales) sin depender de scraping frágil de
// buscadores de tiendas (JS/mapa) ni de datos de patente comercial municipal
// (fragmentados en ~345 sistemas sin API centralizada, descartado por
// investigación de mercado del 1 ago 2026).
//
// Archivo real, verificado en vivo (1 ago 2026): descarga ~111MB (zip) con 2
// archivos TXT tab-delimited. Usamos solo PUB_NOM_SUCURSAL.txt (~55MB sin
// comprimir), columnas confirmadas por inspección directa:
//   RUT  DV  VIGENCIA  FECHA  TIPO_DIRECCION  CALLE  NUMERO  BLOQUE
//   DEPARTAMENTO  VILLA_POBLACION  CIUDAD  COMUNA  REGION
// Actualizado mensualmente por el SII (ver .planning/data-sources.yaml).
//
// Hallazgo importante de la misma verificación: el RUT público de la razón
// social (ej. "WALMART CHILE S.A.") NO siempre es el RUT que registra las
// tiendas reales — supermercados suelen operar bajo RUTs de subsidiarias
// operativas distintos del holding listado en bolsa. Walmart Chile S.A.
// (76042014-K) y SMU S.A. (76012676-4) solo traen 13 y 2 direcciones
// respectivamente — oficinas corporativas, no las ~370/~300 tiendas reales.
// Por eso CADENAS_RUT_CONOCIDOS marca esos casos 'needs-decision': se
// documentan pero NO se ingieren, para no tratar un puñado de oficinas como
// si fuera señal real de expansión de tiendas.
// ---------------------------------------------------------------------------

const SII_DIRECCIONES_URL = 'https://www.sii.cl/estadisticas/nominas/PUB_NOM_DIRECCIONES.zip'
const SUCURSAL_ENTRY_NAME = 'PUB_NOM_SUCURSAL.txt'

export interface CadenaRutConocido {
  rut: string
  dv: string
  cadena: string
  estado: 'activo' | 'needs-decision'
  nota?: string
}

// RUTs verificados en vivo el 1 ago 2026 contra PUB_NOMBRES_PJ.zip (nómina de
// razones sociales del SII) — no adivinados. Ampliar esta lista es la forma
// de cubrir más cadenas; cada entrada nueva debe verificarse de la misma
// forma (razón social exacta → RUT, y confirmar que el conteo de direcciones
// resultante sea plausible para el tamaño real de la cadena, no solo oficinas).
export const CADENAS_RUT_CONOCIDOS: CadenaRutConocido[] = [
  { rut: '90749000', dv: '9', cadena: 'Falabella', estado: 'activo' },
  { rut: '76433310', dv: '1', cadena: 'Cencosud Shopping', estado: 'activo' },
  {
    rut: '76042014',
    dv: 'K',
    cadena: 'Walmart Chile',
    estado: 'needs-decision',
    nota: 'RUT del holding — 13 direcciones son oficinas corporativas en Huechuraba, no las ~370 tiendas Líder/Ekono/Cuenta. Falta identificar el RUT de la razón social operativa real.',
  },
  {
    rut: '76012676',
    dv: '4',
    cadena: 'SMU',
    estado: 'needs-decision',
    nota: 'RUT del holding — 2 direcciones son oficinas corporativas, no las ~300 tiendas Unimarc/Alvi/Mayorista 10. Falta identificar el RUT operativo real.',
  },
]

export interface SucursalSII {
  rut: string
  dv: string
  cadena: string
  vigente: boolean
  fechaRegistro: string | null
  calle: string | null
  numero: string | null
  comuna: string | null
  region: string | null
}

/**
 * Descarga la nómina nacional de sucursales del SII y filtra solo los RUTs
 * con estado 'activo' en CADENAS_RUT_CONOCIDOS. Nunca lanza — cualquier fallo
 * (HTTP, zip corrupto, formato cambiado) degrada a un array vacío.
 */
export async function descargarSucursalesCadenas(): Promise<SucursalSII[]> {
  const rutsActivos = new Map(
    CADENAS_RUT_CONOCIDOS.filter((c) => c.estado === 'activo').map((c) => [c.rut, c.cadena])
  )

  try {
    const res = await fetch(SII_DIRECCIONES_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PermisoHub/1.0)' },
    })
    if (!res.ok) {
      reportWarning(`HTTP ${res.status} al descargar la nómina de direcciones`, {
        scope: 'scraper.sii-nomina-sucursales',
        extra: { status: res.status },
      })
      return []
    }

    const zipBuffer = await res.arrayBuffer()
    const zip = await JSZip.loadAsync(zipBuffer)
    const entry = zip.file(SUCURSAL_ENTRY_NAME)
    if (!entry) {
      reportWarning(`No se encontró "${SUCURSAL_ENTRY_NAME}" dentro del zip — posible cambio de formato del SII`, {
        scope: 'scraper.sii-nomina-sucursales',
      })
      return []
    }

    const contenido = await entry.async('string')
    const lineas = contenido.split('\n')
    const resultado: SucursalSII[] = []

    // Línea 0 es el header (RUT DV VIGENCIA FECHA TIPO_DIRECCION CALLE ...).
    for (let i = 1; i < lineas.length; i++) {
      const linea = lineas[i]
      if (!linea) continue
      const cols = linea.split('\t')
      const rut = cols[0]
      const cadena = rutsActivos.get(rut)
      if (!cadena) continue

      resultado.push({
        rut,
        dv: cols[1] ?? '',
        cadena,
        vigente: cols[2] === 'S',
        fechaRegistro: cols[3]?.trim() || null,
        calle: cols[5]?.trim() || null,
        numero: cols[6]?.trim() || null,
        comuna: cols[11]?.trim() || null,
        region: cols[12]?.trim() || null,
      })
    }

    return resultado
  } catch (err) {
    reportError(err, { scope: 'scraper.sii-nomina-sucursales' })
    return []
  }
}
