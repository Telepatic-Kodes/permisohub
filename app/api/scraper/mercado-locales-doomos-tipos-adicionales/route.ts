import { validateCronSecret } from '@/lib/scraper'
import { recordSourceRun } from '@/lib/observability'
import { saludDeCorrida } from '@/lib/salud-fuentes'
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

  // source_id PROPIO, no el del cron de local_comercial: son universos
  // distintos (3 tipos × 36 comunas × 2 operaciones vs. local_comercial solo)
  // y corren por separado. Compartir id haría que la "última corrida" de la
  // página alternara entre dos cosas que no se pueden comparar entre sí.
  const salud = saludDeCorrida({
    encontrados: descubrimiento.encontrados,
    guardados: descubrimiento.guardados,
    comunasBuscadas: descubrimiento.comunasBuscadas,
    fallosDeFuente: descubrimiento.fallosDeFuente,
    errors: descubrimiento.errors,
  })
  await recordSourceRun({
    sourceId: 'mercado-locales-doomos-tipos-adicionales',
    status: salud.status,
    rowCount: descubrimiento.encontrados,
    detail: salud.detail,
    errorMessage: salud.errorMessage,
  })

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
