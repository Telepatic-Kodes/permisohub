import { validateCronSecret } from '@/lib/scraper'
import { correrDescubrimientoTerrenosFuente } from '@/lib/terrenos-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 280

// Una fuente por ruta/cron (ver comentario en correrDescubrimientoTerrenosFuente
// para por qué: las 5 juntas en un solo request excedían 280s incluso con 1
// workspace). Horario escalonado en vercel.json para no golpear Overpass
// (rate-limit compartido de terrenos-ubicacion.ts) con las 5 a la vez.
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultados = await correrDescubrimientoTerrenosFuente('portalinmobiliario')

  return Response.json({ ok: true, timestamp: new Date().toISOString(), resultados })
}
