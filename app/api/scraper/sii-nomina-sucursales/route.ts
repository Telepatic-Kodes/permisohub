import { validateCronSecret } from '@/lib/scraper'
import { correrIngestaCadenasSucursales } from '@/lib/cadenas-sucursales-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Corre mensual (ver vercel.json) — el SII actualiza esta nómina una vez al
// mes, correr más seguido no aporta datos nuevos.
export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resultado = await correrIngestaCadenasSucursales()

  return Response.json({
    ok: resultado.totalEncontradas > 0,
    timestamp: new Date().toISOString(),
    ...resultado,
  })
}
