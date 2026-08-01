import { fetchWithTimeout } from '@/lib/scraper'
import type { NoticiaMercadoRaw } from './noticias-common'

// ---------------------------------------------------------------------------
// Port de lib/scrapers/cmf-hechos-esenciales.ts (repo origen PROPRA·BI) —
// fase 2 de la fusión. La CMF (Comisión para el Mercado Financiero) publica
// "Hechos Esenciales" — divulgaciones de eventos materiales que toda empresa
// que cotiza en Chile está legalmente obligada a informar — como una tabla
// HTML plana renderizada en servidor, actualizada cada minuto, sin RSS/API.
// Es la única fuente del pipeline de noticias que no es un medio de prensa:
// es la página de transparencia pública de un regulador financiero, así que
// no aplica el mismo riesgo de ToS que un scraper de portal inmobiliario.
// ---------------------------------------------------------------------------

const CMF_HECHOS_URL = 'https://www.cmfchile.cl/institucional/hechos/hechos_portada.php'

// Emisores mall/landlord de retail que interesan acá — se matchean por
// nombre exacto de entidad CMF (mayúsculas, tal como la CMF lo muestra), no
// por RUT, porque la tabla solo muestra el nombre.
const RELEVANT_ENTITIES = [
  'PARQUE ARAUCO S.A.',
  'CENCOSUD SHOPPING S.A.',
  'CENCOSUD S.A.',
  'PLAZA S.A.',
  'FALABELLA S.A.',
  'SMU S.A.',
  'WALMART CHILE S.A.',
  'BTG PACTUAL RENTA COMERCIAL FONDO DE INVERSION',
]

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

// Resuelve el offset UTC real de America/Santiago para una fecha dada — el
// origen hardcodeaba "-04:00" (horario estándar de Chile), lo que queda mal
// durante el horario de verano (-03:00). Sin dependencias nuevas:
// Intl.DateTimeFormat con timeZoneName:'shortOffset' ya resuelve el offset
// correcto para esa fecha específica según las reglas vigentes de IANA.
function resolverOffsetSantiago(fechaUtcAprox: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    timeZoneName: 'shortOffset',
  }).formatToParts(fechaUtcAprox)
  const offsetPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-4'
  // formatToParts da algo como "GMT-4" o "GMT-3" — normalizar a "-04:00"/"-03:00".
  const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!match) return '-04:00'
  const [, signo, horasRaw, minutosRaw] = match
  return `${signo}${horasRaw.padStart(2, '0')}:${minutosRaw ?? '00'}`
}

// El href de descarga de la CMF trae un parámetro "t" que es un timestamp de
// cache-busting — cambia en cada carga de la página aunque sea el MISMO
// documento (verificado en vivo: dos scrapes con 2 minutos de diferencia
// dieron el mismo "s567"/"secuencia" pero un "t" distinto). Usar el href
// crudo como dedup key (noticias_mercado.url) rompía la deduplicación por
// completo — cada corrida insertaba el mismo hecho esencial de nuevo. Se
// normaliza quitando "t" antes de usarlo como identidad del documento.
function normalizarUrlDocumentoCmf(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete('t')
    return u.toString()
  } catch {
    return url
  }
}

// Formato propio de la CMF: "DD/MM/YYYY HH:MM:SS"
function parseCmfDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, ss] = m
  // Aproximación inicial en UTC solo para resolver qué offset de Santiago
  // aplica en esa fecha (DST sí/no) — luego se reconstruye con el offset real.
  const aproximado = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`)
  const offset = resolverOffsetSantiago(aproximado)
  const date = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offset}`)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Parser regex hand-rolled, mismo trade-off que noticias-rss.ts y
 * lib/scrapers/portalinmobiliario.ts — la estructura de la tabla es angosta
 * y verificada en vivo, no vale la pena una dependencia de parsing HTML
 * nueva para cuatro columnas.
 */
export async function scrapearCmfHechosEsenciales(): Promise<NoticiaMercadoRaw[]> {
  const res = await fetchWithTimeout(CMF_HECHOS_URL, {}, 15_000)
  if (!res.ok) throw new Error(`CMF Hechos Esenciales fetch falló (${res.status})`)

  const html = await res.text()
  const rowRegex =
    /<tr>\s*<td>(.*?)<\/td>\s*<td>[\s\S]*?<a href="([^"]+)"[^>]*class="mime_pdf">([^<]*)<\/a>[\s\S]*?<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/g

  const items: NoticiaMercadoRaw[] = []
  for (const match of html.matchAll(rowRegex)) {
    const [, dateRaw, href, docNumRaw, entityRaw, materiaRaw] = match
    const entity = decodeEntities(entityRaw)
    if (!RELEVANT_ENTITIES.includes(entity.toUpperCase())) continue

    const materia = decodeEntities(materiaRaw)
    const documentNumber = decodeEntities(docNumRaw)

    const urlAbsoluta = href.startsWith('http') ? href : `https://www.cmfchile.cl${href}`

    items.push({
      fuente: 'CMF',
      fuenteTipo: 'scrape',
      url: normalizarUrlDocumentoCmf(urlAbsoluta),
      titulo: `${entity}: ${materia}`,
      resumen: `Hecho esencial N° ${documentNumber}`,
      publicadoEl: parseCmfDate(dateRaw),
    })
  }
  return items
}
