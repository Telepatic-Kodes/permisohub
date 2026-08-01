import { validateCronSecret } from '@/lib/scraper'
import { sincronizarInstrumentosIPT } from '@/lib/instrumentos-ipt-server'

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

  return Response.json({
    ok: resultado.errors.length === 0,
    timestamp: new Date().toISOString(),
    ...resultado,
  })
}
