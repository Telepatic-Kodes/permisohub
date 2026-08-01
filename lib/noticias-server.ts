import { RSS_SOURCES, ingestarFeedRss } from '@/lib/scrapers/noticias-rss'
import { scrapearCmfHechosEsenciales } from '@/lib/scrapers/noticias-cmf'
import { scrapearParqueAraucoNoticias } from '@/lib/scrapers/noticias-parque-arauco'
import { upsertNoticiasMercado, type UpsertNoticiasSummary } from '@/lib/scrapers/noticias-common'

// ---------------------------------------------------------------------------
// Orquestación del pipeline de noticias — fase 2 de la fusión PROPRA·BI →
// PermisoHub. Mirror de lib/mercado-locales-server.ts: RSS (paralelo) → CMF
// → Parque Arauco, cada fuente con su propio try/catch (una que falle no
// tumba las demás) — mismo aislamiento que runDailyNewsIngest() en el
// origen. Sin tabla de auditoría: resultado en memoria, devuelto como JSON
// por la ruta cron.
// ---------------------------------------------------------------------------

interface ResultadoFuente extends Partial<UpsertNoticiasSummary> {
  encontradas: number
  error?: string
}

export interface ResultadoIngestaNoticias {
  rss: (ResultadoFuente & { url: string })[]
  cmf: ResultadoFuente
  parqueArauco: ResultadoFuente
}

async function ingestarFuente(nombre: string, buscar: () => Promise<Parameters<typeof upsertNoticiasMercado>[0]>): Promise<ResultadoFuente> {
  try {
    const items = await buscar()
    const summary = await upsertNoticiasMercado(items)
    return { encontradas: items.length, ...summary }
  } catch (err) {
    return { encontradas: 0, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function correrIngestaNoticias(): Promise<ResultadoIngestaNoticias> {
  const rss = await Promise.all(
    RSS_SOURCES.map(async (url) => ({
      url,
      ...(await ingestarFuente(url, () => ingestarFeedRss(url))),
    })),
  )

  const cmf = await ingestarFuente('CMF', scrapearCmfHechosEsenciales)
  const parqueArauco = await ingestarFuente('Parque Arauco (IR)', scrapearParqueAraucoNoticias)

  return { rss, cmf, parqueArauco }
}
