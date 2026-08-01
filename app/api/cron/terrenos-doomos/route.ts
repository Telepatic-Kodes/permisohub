import { validateCronSecret } from '@/lib/scraper'
import { correrDescubrimientoTerrenosFuente } from '@/lib/terrenos-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 280

// Ver app/api/cron/terrenos-portalinmobiliario/route.ts — mismo patrón, una
// fuente por ruta/cron.
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultados = await correrDescubrimientoTerrenosFuente('doomos')

  return Response.json({ ok: true, timestamp: new Date().toISOString(), resultados })
}
