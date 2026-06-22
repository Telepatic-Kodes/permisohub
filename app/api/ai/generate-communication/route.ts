import { isAIAvailable, aiComplete } from '@/lib/ai'

export const dynamic = 'force-dynamic'

type TipoComunicacion = 'actualizacion_cliente' | 'seguimiento_dom' | 'reclamo_ley21718' | 'carta_formal'

interface CommunicationRequest {
  tipo: TipoComunicacion
  proyectoNombre: string
  municipio: string
  numeroExpediente?: string
  fechaIngreso?: string
  diasHabiles?: number
  etapaActual?: string
  clienteNombre?: string
  observaciones?: string
  direccion?: string
  arquitecta?: string
}

export async function POST(request: Request) {
  const body = await request.json() as CommunicationRequest

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const templates: Record<TipoComunicacion, string> = {
    actualizacion_cliente: `Redacta un email de actualización de estado al cliente ${body.clienteNombre ?? 'estimado cliente'} sobre su proyecto "${body.proyectoNombre}" en ${body.municipio}.
Estado actual: ${body.etapaActual ?? 'En tramitación'}.
El tono debe ser profesional, claro y tranquilizador. Incluye: estado actual, qué sigue, plazo estimado, cómo contactar a la arquitecta.`,

    seguimiento_dom: `Redacta una carta formal de seguimiento a la DOM de ${body.municipio} sobre el Expediente N°${body.numeroExpediente ?? '[NÚMERO]'} del proyecto "${body.proyectoNombre}" (${body.direccion ?? ''}).
Ingresado el: ${body.fechaIngreso ?? '[FECHA]'}. Han transcurrido aproximadamente ${body.diasHabiles ?? '?'} días hábiles.
El tono debe ser formal y respetuoso. Cita el Artículo 5.1.2 OGUC sobre plazos de pronunciamiento.`,

    reclamo_ley21718: `Redacta una carta formal de reclamo por vencimiento de plazo legal, conforme a la Ley 21.718 (Art. 118 LGUC) y el Artículo 5.1.2 OGUC.
Proyecto: "${body.proyectoNombre}" en ${body.municipio}. Expediente N°${body.numeroExpediente ?? '[NÚMERO]'}.
Ingresado el: ${body.fechaIngreso ?? '[FECHA]'}. Han transcurrido ${body.diasHabiles ?? '?'} días hábiles sin pronunciamiento.
El tono debe ser firme pero respetuoso. Solicita pronunciamiento formal dentro de los plazos legales.`,

    carta_formal: `Redacta una carta formal dirigida a la DOM de ${body.municipio} sobre el proyecto "${body.proyectoNombre}".
Contexto: ${body.observaciones ?? 'Comunicación general sobre el expediente'}.
Expediente N°${body.numeroExpediente ?? '[NÚMERO]'}.`,
  }

  const prompt = `Eres la arquitecta chilena Estefanía Parada de EP Gestión Arquitectónica. Redacta el siguiente documento:

${templates[body.tipo]}

ARQUITECTA RESPONSABLE: ${body.arquitecta ?? 'Estefanía Parada'}
EMPRESA: EP Gestión Arquitectónica
EMAIL: estefania@epgestion.cl

Formato: Texto listo para copiar y enviar. Usa formato de carta formal con fecha (${new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}), saludo, cuerpo, cierre y firma.`

  try {
    const texto = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 1500 })

    return Response.json({ ok: true, texto, tipo: body.tipo })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
