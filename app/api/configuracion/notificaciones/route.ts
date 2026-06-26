import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface NotifPrefs {
  observaciones_dom?: boolean
  vencimiento_plazo?: boolean
  cambio_estado?: boolean
  resumen_semanal?: boolean
  email_notificaciones?: string
  notificar_clientes?: boolean
  email_remitente?: string
}

export async function PATCH(request: Request) {
  const body = await request.json() as NotifPrefs

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const updates: Record<string, unknown> = {}
    if (body.observaciones_dom !== undefined) updates.notif_observaciones_dom = body.observaciones_dom
    if (body.vencimiento_plazo !== undefined) updates.notif_vencimiento_plazo = body.vencimiento_plazo
    if (body.cambio_estado !== undefined) updates.notif_cambio_estado = body.cambio_estado
    if (body.resumen_semanal !== undefined) updates.notif_resumen_semanal = body.resumen_semanal
    if (body.email_notificaciones) updates.email_notificaciones = body.email_notificaciones
    if (body.notificar_clientes !== undefined) updates.notif_clientes = body.notificar_clientes
    if (body.email_remitente) updates.email_remitente = body.email_remitente

    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...updates }, { onConflict: 'id' })

    if (error && process.env.NODE_ENV === 'production') {
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
