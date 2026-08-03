// Ruta TEMPORAL — backfill en trickle (1 ago 2026) de señales de ubicación
// para terrenos que ya tenían zona_status='encontrado' ANTES de que existiera
// esta feature. correrDescubrimientoTerrenos solo enriquece filas nuevas de
// esa misma corrida con zona_status='pendiente', así que estos terrenos nunca
// se tocarían de forma orgánica — no queda otra que un backfill explícito.
//
// Se llama en lotes chicos (?limit=, default 20) varias veces al día vía
// CronCreate de sesión, NUNCA todo de una vez — una corrida masiva sostenida
// contra Overpass (recurso público compartido) gatilló un bloqueo de IP a
// nivel de conexión TCP (verificado en vivo: connection refused sostenido).
// Eliminar este archivo una vez que no queden pendientes.
import { validateCronSecret } from '@/lib/scraper'
import { createServiceClient } from '@/lib/supabase/service'
import { enriquecerTerreno } from '@/lib/terrenos-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DEFAULT_LIMIT = 20

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit')) || DEFAULT_LIMIT

  const admin = createServiceClient()
  const { data: pendientes, error } = await admin
    .from('terrenos')
    .select('id')
    .eq('zona_status', 'encontrado')
    .eq('ubicacion_status', 'pendiente')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .limit(limit)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let resueltos = 0
  let errores = 0
  let diferidos = 0
  for (const row of pendientes ?? []) {
    try {
      await enriquecerTerreno(row.id)
      const { data: check } = await admin
        .from('terrenos')
        .select('ubicacion_status')
        .eq('id', row.id)
        .single()
      // 'pendiente' acá significa que enriquecerTerreno lo dejó a propósito
      // sin tocar (rate-limit de Overpass) — se recoge en el próximo lote,
      // no es un error real del terreno.
      if (check?.ubicacion_status === 'resuelto') resueltos++
      else if (check?.ubicacion_status === 'pendiente') diferidos++
      else errores++
    } catch {
      errores++
    }
  }

  const { count: restantes } = await admin
    .from('terrenos')
    .select('id', { count: 'exact', head: true })
    .eq('zona_status', 'encontrado')
    .eq('ubicacion_status', 'pendiente')

  return Response.json({
    ok: true,
    procesados: pendientes?.length ?? 0,
    resueltos,
    diferidos,
    errores,
    restantes: restantes ?? 0,
  })
}
