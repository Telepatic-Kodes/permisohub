import { validateCronSecret } from '@/lib/scraper'
import { sincronizarInstrumentosIPT } from '@/lib/instrumentos-ipt-server'
import { recordSourceRun } from '@/lib/observability'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Sincronización nacional completa (~3.256 instrumentos, ~33 páginas a
// perPage=100) — a diferencia de mercado-locales/zonificación, Portal IPT es
// una API paginada rápida sin necesidad de concurrencia ni acotar cobertura.
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultado = await sincronizarInstrumentosIPT()

  await recordSourceRun({
    sourceId: 'instrumentos-ipt',
    status: resultado.errors.length === 0 ? 'ok' : 'error',
    rowCount: resultado.instrumentosSincronizados,
    errorMessage: resultado.errors.length > 0 ? resultado.errors.join('; ') : undefined,
  })

  return Response.json({
    ok: resultado.errors.length === 0,
    timestamp: new Date().toISOString(),
    ...resultado,
  })
}
