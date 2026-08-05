import { validateCronSecret } from '@/lib/scraper'
import { buscarLocalesComerciales } from '@/lib/scrapers/portalinmobiliario'
import {
  correrDescubrimientoMercadoLocales,
  computarYPersistirBandasMercadoLocales,
  obtenerValorUF,
} from '@/lib/mercado-locales-server'
import { recordSourceRun } from '@/lib/observability'
import { saludDeCorrida } from '@/lib/salud-fuentes'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

// A diferencia de app/api/scraper/portalinmobiliario/route.ts (terrenos, per
// workspace), esta ruta NO recibe workspaceId — mercado_locales_listings es
// un dataset global, igual para cualquier workspace autenticado (ver
// supabase/migrations/20260802_mercado_locales_listings.sql).
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
      sourceId: 'mercado-locales-portalinmobiliario',
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
      sourceId: 'mercado-locales-portalinmobiliario',
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
