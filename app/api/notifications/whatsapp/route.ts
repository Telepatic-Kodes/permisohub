import { enviarWhatsApp, isWhatsAppAvailable } from '@/lib/whatsapp'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const WhatsAppRequestSchema = z.object({
  telefono: z.string().min(1),
  tipo: z.enum([
    'proyecto_ingresado',
    'en_revision',
    'con_observaciones',
    'aprobado',
    'rechazado',
    'recepcion_solicitada',
    'recepcion_aprobada',
    'actualizacion_general',
    'alerta_plazo_vencido',
  ]),
  proyectoNombre: z.string().min(1),
  municipio: z.string().min(1),
  etapa: z.string().optional(),
  mensaje: z.string().optional(),
  diasEstimados: z.number().optional(),
  arquitecta: z.string().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`notify:${user.id}`)
  if (rateLimit) return rateLimit

  if (!isWhatsAppAvailable()) {
    return Response.json(
      {
        ok: false,
        error: 'WhatsApp no configurado. Configura TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_NUMBER en las variables de entorno.',
        configured: false,
      },
      { status: 503 }
    )
  }

  const raw = await request.json()
  const parsed = WhatsAppRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  const result = await enviarWhatsApp(body.telefono, body.tipo, {
    proyectoNombre: body.proyectoNombre,
    municipio: body.municipio,
    etapa: body.etapa,
    mensaje: body.mensaje,
    diasEstimados: body.diasEstimados,
    arquitecta: body.arquitecta,
  })

  return Response.json({
    ...result,
    configured: true,
  }, { status: result.ok ? 200 : 500 })
}

export async function GET() {
  return Response.json({ configured: isWhatsAppAvailable() })
}
