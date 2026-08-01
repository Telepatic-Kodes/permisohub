import { validateCronSecret } from '@/lib/scraper'
import { buscarTerrenos } from '@/lib/scrapers/chilepropiedades'
import { correrDescubrimientoTerrenos } from '@/lib/terrenos-server'
import { COMUNAS_CON_ZONIFICACION } from '@/lib/scrapers/terrenos-common'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspaceId')
  if (!workspaceId) {
    return Response.json({ error: 'Parámetro "workspaceId" requerido' }, { status: 400 })
  }

  const results = await correrDescubrimientoTerrenos(COMUNAS_CON_ZONIFICACION, buscarTerrenos, workspaceId, 'chilepropiedades')

  return Response.json({ ok: true, timestamp: new Date().toISOString(), ...results })
}
