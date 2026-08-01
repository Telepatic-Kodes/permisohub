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
//
// Investigación de seguimiento (1 ago 2026, mismo día): se identificaron las
// razones sociales operativas reales cruzando PUB_NOMBRES_PJ.zip (nómina de
// razones sociales) contra los nombres de marca públicos de cada grupo:
//   - Walmart Chile: "ADMINISTRADORA DE SUPERMERCADOS HIPER LIMITADA"
//     (Hipermercado Líder) y "...EXPRESS LIMITADA" (Líder Express) — ambas
//     registradas el mismo día (02-03-2011, la reestructuración corporativa
//     de Walmart tras la compra de D&S), 122/142 direcciones, distribución
//     nacional real (Arica a Puerto Montt), 108/104 vigentes. Alta confianza.
//   - SMU: smu.cl/inversionistas confirma "filiales Unimarc, Alvi y Super10"
//     pero no publica RUTs — se encontraron candidatos por coincidencia
//     exacta de nombre de marca: "ALVI SUPERMERCADO MAYORISTA S.A." (86
//     direcciones, 53 comunas) y "SUPER 10 S.A." (111 direcciones, 62
//     comunas). Confianza media-alta (nombre de marca coincide exactamente
//     con lo que SMU declara públicamente, pero sin RUT oficial publicado
//     para confirmar 1:1). Unimarc —la marca más grande de SMU, mayoría de
//     sus ~300 tiendas— NO se encontró como razón social propia; puede
//     operar bajo un nombre no obvio, o estar repartido en RUTs regionales
//     (se encontraron indicios de eso: "MAYORISTA 10 VINA DEL MAR LIMITADA",
//     "...TEMUCO LIMITADA", "...CENTRAL LIMITADA" — subsidiarias por región,
//     no una nacional única). Queda needs-decision: cobertura de SMU es
//     parcial (Alvi + Super10), no incluye Unimarc.
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
  { rut: '76134941', dv: '4', cadena: 'Walmart Chile (Hipermercado Líder)', estado: 'activo' },
  { rut: '76134946', dv: '5', cadena: 'Walmart Chile (Líder Express)', estado: 'activo' },
  { rut: '76029743', dv: '7', cadena: 'SMU (Alvi)', estado: 'activo' },
  { rut: '76012833', dv: '3', cadena: 'SMU (Super10)', estado: 'activo' },
  // Nota: el RUT holding de Walmart Chile S.A. (76042014-K) ya NO aparece acá
  // — fue investigado y resuelto (1 ago 2026, ver comentario arriba): las
  // tiendas reales están bajo 76134941-4/76134946-5, ya activas. Se excluye
  // del array (no solo needs-decision) porque mostrarlo confundiría el panel
  // de "cadenas pendientes" con algo que ya no está pendiente.
  {
    rut: '76012676',
    dv: '4',
    cadena: 'SMU (RUT holding — parcialmente resuelto, ver Alvi/Super10 arriba)',
    estado: 'needs-decision',
    nota: 'RUT del holding — 2 direcciones son oficinas corporativas. PARCIALMENTE RESUELTO (1 ago 2026): Alvi (76029743-7) y Super10 (76012833-3) ya activos arriba. Unimarc —la marca más grande de SMU— sigue sin identificar: no aparece como razón social propia en la nómina del SII; indicios de que opera bajo RUTs regionales ("Mayorista 10 <ciudad> Limitada") en vez de uno nacional único. Cobertura de SMU queda parcial hasta resolver esto.',
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
