export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { verificarCompatibilidadUso } from '@/lib/zonificacion-compat'
import { fixMojibakeArcGIS } from '@/lib/zonificacion-format'

// ---------------------------------------------------------------------------
// Variante de app/api/proyectos/[id]/compatibilidad/route.ts para un Terreno
// SUELTO — recibe uperm/uproh/usosDisponibles directo en el body en vez de
// leerlos de un proyecto ya persistido, para que el chequeo de uso permitido
// funcione antes de que exista cualquier Cliente/Proyecto (caso de uso
// Alonso: evaluar un terreno en venta). Misma lógica pura reusada tal cual
// (COMPAT-01) — no reimplementar el corto-circuito determinista.
// ---------------------------------------------------------------------------

interface CompatibilidadBody {
  usoPretendido?: string
  uperm?: string | null
  uproh?: string | null
  usosDisponibles?: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`compatibilidad-terreno:${user.id}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as CompatibilidadBody
  const usoPretendido = body.usoPretendido?.trim()
  if (!usoPretendido) {
    return Response.json({ error: 'usoPretendido requerido' }, { status: 400 })
  }

  try {
    const result = await verificarCompatibilidadUso(
      usoPretendido,
      fixMojibakeArcGIS(body.uperm ?? null),
      fixMojibakeArcGIS(body.uproh ?? null),
      body.usosDisponibles ?? false,
    )
    return Response.json({ ok: true, ...result })
  } catch (err) {
    return apiError('Error al verificar compatibilidad de uso', 500, err)
  }
}
