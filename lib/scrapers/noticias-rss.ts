import { fetchWithTimeout } from '@/lib/scraper'
import type { NoticiaMercadoRaw } from './noticias-common'

// ---------------------------------------------------------------------------
// Port de lib/rss.ts (repo origen PROPRA·BI) — fase 2 de la fusión.
//
// Lista curada de feeds RSS a revisar a diario.
//
// Ronda 1 (original, en el origen): se verificó con curl cada candidato de
// feed directo de medio (Diario Financiero, La Tercera/Pulso, Emol,
// BioBioChile, El Mostrador, CChC, CBRE Chile, Colliers Chile, JLL Chile,
// PlataformaUrbana, mercadoinmobiliario.cl, economiaynegocios.cl). Resultado:
// todos dieron 404, redirigieron a HTML en vez de un feed, fueron bloqueados
// por Cloudflare (CBRE/Colliers), o devolvieron error de BD (PlataformaUrbana)
// — ninguno sirve un feed RSS/Atom público funcional.
//
// Dos feeds SÍ devolvieron XML RSS válido en la ronda 1 pero se excluyeron:
//   - news.google.com/rss/search?q=... — funciona, pero el copyright del
//     propio feed de Google restringe su uso a "renderizar resultados de
//     Google News dentro de un lector de feeds personal, para uso personal
//     no comercial" — este es un producto comercial, así que conectarlo
//     violaría los términos de Google. Requiere una decisión explícita, no
//     un data source activado por defecto.
//   - plataformaarquitectura.cl/cl/rss (ArchDaily Chile) — feed válido, pero
//     sus ítems son fichas de proyectos de arquitectura individuales, no
//     noticias de mercado/precio/vacancia — demasiado fuera de tema.
//
// Ronda 2: América Retail cambió de dominio (america-retail.com →
// americaretail-malls.com), algo que la ronda 1 nunca revisó — el dominio
// nuevo sirve un feed RSS de WordPress funcional. Su categoría "malls Chile"
// mezcla noticias de retail que no son de bienes raíces (concesionarios,
// lanzamientos de moda, embajadores de marca) con señales reales de mercado
// inmobiliario comercial (M&A, expansión de operadores) — ver
// isRelevantSignal() más abajo, que filtra la ingesta de este feed específico
// en vez de confiar en cada ítem como haría un feed acotado por tema.
//
// Sigue bloqueado/sin feed: CBRE Chile, Colliers Chile (Cloudflare 403), JLL
// Chile, Cámara de Centros Comerciales Chile (inalcanzable, puede ser
// transitorio — reintentar más adelante).
export const RSS_SOURCES: string[] = ['https://americaretail-malls.com/category/malls/chile-malls/feed/']

// Operadores de mall/strip center que efectivamente se siguen — mencionar
// cualquiera de estos alcanza como señal, ya que son los actores específicos
// que esta feature existe para vigilar (a diferencia de "retail" en general,
// de lo que el feed de América Retail está lleno). Excluye deliberadamente
// retailers genéricos (Walmart, Falabella) cuyo nombre solo casi siempre es
// sobre productos/precios, no sobre bienes raíces — esos necesitan además un
// match de CRE_SIGNAL_KEYWORDS.
const CRE_ACTOR_NAMES = [
  'parque arauco', 'mallplaza', 'mall plaza', 'plaza s.a.', 'grupo plaza',
  'cencosud shopping', 'más center', 'mascenter', 'open plaza', 'arauco premium',
]

// Vocabulario específico de bienes raíces comerciales — excluye
// deliberadamente "retail" a secas (presente en casi todos los artículos de
// un feed de noticias retail, inútil como filtro) y verbos genéricos como
// "inaugura"/"expansión"/"abre sus puertas" — probados contra el feed real y
// dan falsos positivos en concesionarios de autos y marcas de moda haciendo
// cualquier cosa. Señal real de CRE sin match de actor necesita un sustantivo
// específico, no un verbo genérico.
const CRE_SIGNAL_KEYWORDS = [
  'centro comercial', 'strip center', 'local comercial', 'locales comerciales', 'espacio comercial',
  'arriendo de locales', 'arrienda locales', 'vacancia', 'ocupación de locales',
  'adquisición', 'adquiere', 'compra de activos', 'vende sus activos', 'fusión', 'portafolio inmobiliario',
  'cap rate', 'renta comercial',
]

/**
 * Filtro de relevancia para feeds que mezclan señal real de CRE con
 * noticias de retail no relacionadas — a diferencia de tagNoticia() (que
 * solo etiqueta para filtrado de UI y nunca excluye nada), esto decide si
 * un ítem se ingiere o no. Aplicar solo a feeds probadamente ruidosos (ver
 * comentario de RSS_SOURCES) — un feed acotado por tema no debería
 * necesitar esto.
 */
export function isRelevantSignal(title: string, summary: string | null): boolean {
  const haystack = `${title} ${summary ?? ''}`.toLowerCase()
  return CRE_ACTOR_NAMES.some((a) => haystack.includes(a)) || CRE_SIGNAL_KEYWORDS.some((k) => haystack.includes(k))
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Entidades numéricas (ej. &#8230; para "…") — el feed de América Retail
    // las usa para caracteres tipográficos fuera del set básico de arriba.
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .trim()
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!match) return null
  const value = decodeXmlEntities(match[1])
  return value.length > 0 ? value : null
}

function extractLink(block: string): string | null {
  // RSS 2.0: <link>https://...</link>. Atom: <link href="https://..."/>
  const rssLink = extractTag(block, 'link')
  if (rssLink && rssLink.startsWith('http')) return rssLink
  const atomLink = block.match(/<link[^>]*href=["']([^"']+)["']/i)
  return atomLink ? atomLink[1] : null
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// El feed de WordPress de América Retail trae HTML crudo (<p>, <a>, <hr>)
// dentro de <description>, más un footer de plugin de "posts relacionados"
// con merge-tags sin resolver (%%POSTTITLE%%, %%BLOGNAME%%, %%AUTHORNAME%%).
// Se limpian ambos para que la página renderice texto plano en vez de markup
// literal.
function cleanSummary(raw: string | null): string | null {
  if (!raw) return null
  const noTemplateJunk = raw.replace(/%%[A-Z]+%%/g, '')
  const noTags = noTemplateJunk.replace(/<[^>]+>/g, ' ')
  const collapsed = noTags.replace(/\s+/g, ' ').trim()
  if (collapsed.length === 0) return null
  return collapsed.length > 400 ? `${collapsed.slice(0, 400)}…` : collapsed
}

/**
 * Parser RSS/Atom hand-rolled — evita agregar una dependencia nueva de XML
 * para lo que, a esta escala, es un puñado de feeds bien formados. No es un
 * parser XML de propósito general.
 */
export async function ingestarFeedRss(url: string, fuenteLabel?: string): Promise<NoticiaMercadoRaw[]> {
  const res = await fetchWithTimeout(url, {}, 10_000)
  if (!res.ok) throw new Error(`RSS fetch falló (${res.status}): ${url}`)

  const xml = await res.text()
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml)
  const itemTag = isAtom ? 'entry' : 'item'
  const blocks = xml.match(new RegExp(`<${itemTag}[^>]*>[\\s\\S]*?</${itemTag}>`, 'gi')) ?? []

  const channelTitle = extractTag(xml, 'title')
  const fuente = fuenteLabel ?? channelTitle ?? new URL(url).hostname

  const items: NoticiaMercadoRaw[] = []
  for (const block of blocks) {
    const titulo = extractTag(block, 'title')
    const link = extractLink(block)
    if (!titulo || !link) continue

    const resumen = cleanSummary(extractTag(block, 'description') ?? extractTag(block, 'summary'))
    const pubDateRaw = extractTag(block, 'pubDate') ?? extractTag(block, 'published') ?? extractTag(block, 'updated')

    if (!isRelevantSignal(titulo, resumen)) continue

    items.push({
      fuente,
      fuenteTipo: 'rss',
      url: link,
      titulo,
      resumen,
      publicadoEl: parseDate(pubDateRaw),
    })
  }
  return items
}
