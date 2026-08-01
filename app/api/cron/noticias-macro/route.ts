import { validateCronSecret } from '@/lib/scraper'
import { correrIngestaNoticias } from '@/lib/noticias-server'
import { fetchMacroData, persistirSnapshotMacro } from '@/lib/indicadores-macro'
import { reportError } from '@/lib/observability'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const macro = await fetchMacroData()
    await persistirSnapshotMacro(macro)
    const noticias = await correrIngestaNoticias()

    return Response.json({ ok: true, timestamp: new Date().toISOString(), macro, noticias })
  } catch (err) {
    reportError(err, { scope: 'cron.noticias-macro' })
    return Response.json(
      { ok: false, error: 'noticias-macro falló antes de completar', timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
