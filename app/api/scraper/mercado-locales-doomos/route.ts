import { validateCronSecret } from '@/lib/scraper'
import { buscarLocalesComerciales } from '@/lib/scrapers/doomos'
import {
  correrDescubrimientoMercadoLocales,
  computarYPersistirBandasMercadoLocales,
  obtenerValorUF,
  saludDeCorrida,
} from '@/lib/mercado-locales-server'
import { recordSourceRun } from '@/lib/observability'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

// Segunda fuente de mercado_locales_listings (04-08) — mismo patrón que
// app/api/scraper/mercado-locales/route.ts (Portalinmobiliario), en cron
// SEPARADO para no sumar su presupuesto de tiempo/requests al de la fuente
// original (mismo criterio que mercado-locales-tipos-adicionales). Las
// bandas P25/mediana/P75 se recalculan sobre TODAS las fuentes juntas
// (calcular_bandas_mercado_locales no filtra por fuente), así que
// computarYPersistirBandasMercadoLocales corre igual acá — ejecutarla dos
// veces al día (una vez por fuente) es redundante pero inofensivo, nunca
// deja una banda a medio recalcular.
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const descubrimiento = await correrDescubrimientoMercadoLocales(buscarLocalesComerciales)
    const uf = await obtenerValorUF()
    const stats = await computarYPersistirBandasMercadoLocales(uf)

    // El estado sale de saludDeCorrida(), no de "llegamos hasta acá sin
    // lanzar": una corrida puede terminar entera y limpia y aun así no haber
    // podido consultar la fuente en ningún par comuna×operación.
    const salud = saludDeCorrida(descubrimiento)
    await recordSourceRun({
      sourceId: 'mercado-locales-doomos',
      status: salud.status,
      rowCount: descubrimiento.encontrados,
      detail: salud.detail,
      errorMessage: salud.errorMessage,
    })

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...descubrimiento,
      stats,
    })
  } catch (err) {
    await recordSourceRun({
      sourceId: 'mercado-locales-doomos',
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
