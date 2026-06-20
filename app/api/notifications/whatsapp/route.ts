import { enviarWhatsApp, isWhatsAppAvailable, type TipoNotificacionWA } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

interface WhatsAppRequest {
  telefono: string
  tipo: TipoNotificacionWA
  proyectoNombre: string
  municipio: string
  etapa?: string
  mensaje?: string
  diasEstimados?: number
  arquitecta?: string
}

export async function POST(request: Request) {
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

  const body = await request.json() as WhatsAppRequest

  if (!body.telefono || !body.tipo || !body.proyectoNombre || !body.municipio) {
    return Response.json({ error: 'Faltan campos requeridos: telefono, tipo, proyectoNombre, municipio' }, { status: 400 })
  }

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
