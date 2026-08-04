import { validateCronSecret } from '@/lib/scraper'
import { buscarLocalesComerciales } from '@/lib/scrapers/doomos'
import { MERCADO_LOCALES_COMUNA_SLUGS, type TipoPropiedadComercial } from '@/lib/scrapers/mercado-locales-common'
import {
  correrDescubrimientoTiposComercialesAdicionales,
  computarYPersistirBandasMercadoLocales,
  obtenerValorUF,
} from '@/lib/mercado-locales-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

// oficina/bodega/industrial de Doomos, mismo criterio de cron separado que
// mercado-locales-tipos-adicionales (Portalinmobiliario) — ver ese archivo.
const TIPOS_ADICIONALES: TipoPropiedadComercial[] = ['oficina', 'bodega', 'industrial']

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const comunas = Object.keys(MERCADO_LOCALES_COMUNA_SLUGS)
  const descubrimiento = await correrDescubrimientoTiposComercialesAdicionales(
    comunas,
    TIPOS_ADICIONALES,
    buscarLocalesComerciales,
  )

  const uf = await obtenerValorUF()
  let filasEscritas = 0
  for (const tipoPropiedad of TIPOS_ADICIONALES) {
    const stats = await computarYPersistirBandasMercadoLocales(uf, { tipoPropiedad, comunas })
    filasEscritas += stats.filasEscritas
  }

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    tipos: TIPOS_ADICIONALES,
    ...descubrimiento,
    stats: { filasEscritas },
  })
}
