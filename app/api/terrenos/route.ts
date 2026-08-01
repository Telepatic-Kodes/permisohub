export const dynamic = 'force-dynamic'

import { after } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { asegurarWorkspace } from '@/lib/workspace'
import { enriquecerTerreno } from '@/lib/terrenos-server'

const NuevoTerrenoSchema = z.object({
  direccion: z.string().min(1),
  comuna: z.string().min(1),
  rol_sii: z.string().optional(),
  url_aviso: z.string().url().optional(),
  precio_clp: z.number().optional(),
  superficie_lote_m2: z.number().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const comuna = searchParams.get('comuna')
  const zonaStatus = searchParams.get('zona_status')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    let query = supabase
      .from('terrenos')
      .select('*')
      .order('created_at', { ascending: false })

    if (comuna) query = query.eq('comuna', comuna)
    if (zonaStatus) query = query.eq('zona_status', zonaStatus)

    const { data, error } = await query
    if (error) throw error

    return Response.json({ data: data ?? [] })
  } catch (err) {
    return apiError('Error al obtener terrenos', 500, err)
  }
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => ({}))
  const parsed = NuevoTerrenoSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Igual que proyectos: sin workspace_id el terreno nace invisible para el
    // resto del equipo — la RLS lo dejaría ver solo a su creador.
    const ws = await asegurarWorkspace(supabase, user.id)

    const { data: terreno, error } = await supabase
      .from('terrenos')
      .insert({
        user_id: user.id,
        workspace_id: ws.id,
        direccion: body.direccion,
        comuna: body.comuna,
        fuente: 'manual',
        rol_sii: body.rol_sii ?? null,
        url_aviso: body.url_aviso ?? null,
        precio_clp: body.precio_clp ?? null,
        superficie_lote_m2: body.superficie_lote_m2 ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return apiError('Error al crear terreno', 500, error)
    }

    // Enriquecimiento (geocoding + zonificación + SII best-effort) en
    // background — mismo patrón after() que app/api/proyectos/route.ts, para
    // no bloquear la respuesta con la latencia de Nominatim/ArcGIS/SII.
    const terrenoId = terreno.id
    after(() => enriquecerTerreno(terrenoId))

    return Response.json({ ok: true, id: terreno.id })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
