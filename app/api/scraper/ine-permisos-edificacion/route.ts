import { validateCronSecret } from '@/lib/scraper'
import { correrIngestaPermisosEdificacionIne } from '@/lib/ine-permisos-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Manual — el INE no ha publicado años nuevos en este servicio desde la
// verificación (1 ago 2026, cobertura 2010-2021), así que no amerita cron
// propio todavía. Re-correr manualmente si INE publica un año nuevo.
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultado = await correrIngestaPermisosEdificacionIne()

  return Response.json({
    ok: resultado.filasAgregadas > 0,
    timestamp: new Date().toISOString(),
    ...resultado,
  })
}
