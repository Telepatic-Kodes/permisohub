export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { verificarCompatibilidadUso } from '@/lib/zonificacion-compat'

// ---------------------------------------------------------------------------
// COMPAT-01: verificación de compatibilidad de uso de suelo para un proyecto
// ya persistido. A diferencia de las rutas públicas
// /api/zonificacion/{lookup,zonas}, esta ruta lee zona_uperm/zona_uproh ya
// guardados en el proyecto del dueño autenticado — mismo patrón ownedProject()
// que app/api/proyectos/[id]/via-tramitacion/route.ts.
//
// Deliberadamente NO persiste el resultado en `proyectos`: el "uso pretendido"
// puede cambiar entre consultas, así que se responde en caliente en vez de
// guardarse como atributo fijo del proyecto.
// ---------------------------------------------------------------------------

async function ownedProject(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: Response.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, user_id, zona_uperm, zona_uproh, zona_usos_disponibles')
    .eq('id', id)
    .maybeSingle()
  if (!proyecto || proyecto.user_id !== user.id) {
    return { error: Response.json({ error: 'Proyecto no encontrado' }, { status: 404 }) }
  }
  return { proyecto }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await ownedProject(id)
  if ('error' in ctx) return ctx.error
  const { proyecto } = ctx

  const rateLimit = await checkRateLimit(`compatibilidad:${id}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as { usoPretendido?: string }
  const usoPretendido = body.usoPretendido?.trim()
  if (!usoPretendido) {
    return Response.json({ error: 'usoPretendido requerido' }, { status: 400 })
  }

  try {
    const result = await verificarCompatibilidadUso(
      usoPretendido,
      proyecto.zona_uperm,
      proyecto.zona_uproh,
      proyecto.zona_usos_disponibles ?? false,
    )
    return Response.json({ ok: true, ...result })
  } catch (err) {
    return apiError('Error al verificar compatibilidad de uso', 500, err)
  }
}
