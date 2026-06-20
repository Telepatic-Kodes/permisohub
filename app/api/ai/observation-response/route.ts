import { getAI, AI_MODEL } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'

export const dynamic = 'force-dynamic'

interface ObservationRequest {
  observacionTexto: string
  proyectoNombre: string
  municipio: string
  tipoPermiso: string
  direccion?: string
  numeroExpediente?: string
  arquitecta?: string
}

export async function POST(request: Request) {
  const body = await request.json() as ObservationRequest

  const ai = getAI()
  if (!ai) {
    return Response.json({ error: 'ANTHROPIC_API_KEY no configurado' }, { status: 503 })
  }

  const ogucContext = getContextoOGUC(body.observacionTexto)

  const prompt = `Eres una arquitecta chilena experta en permisos municipales. Debes redactar una respuesta formal y técnica a una observación de la DOM (Dirección de Obras Municipales).

## Contexto del proyecto:
- Nombre: ${body.proyectoNombre}
- Municipio: ${body.municipio}
- Tipo: ${body.tipoPermiso}
- Dirección: ${body.direccion ?? 'No especificada'}
- N° Expediente: ${body.numeroExpediente ?? 'Pendiente'}
- Arquitecta responsable: ${body.arquitecta ?? 'Estefanía Parada'}

## Observación de la DOM a responder:
${body.observacionTexto}

## Artículos OGUC relevantes:
${ogucContext}

## INSTRUCCIONES:
Redacta una respuesta formal en el siguiente formato exacto:

1. **ENCABEZADO FORMAL** — Dirigido a la DOM de ${body.municipio}
2. **RESPUESTA A LA OBSERVACIÓN** — Cita el artículo OGUC o PRC correspondiente, explica cómo se subsana, menciona los documentos adjuntos corregidos
3. **DOCUMENTOS ADJUNTOS** — Lista los documentos corregidos que se deben adjuntar (planos, memorias, etc.)
4. **CIERRE FORMAL** — Con firma de la arquitecta

El tono debe ser técnico, formal y constructivo. Cita siempre el artículo OGUC específico.
Si la observación de la DOM parece incorrecta o aplicó mal la norma, indícalo respetuosamente con la cita normativa correcta.`

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const texto = response.content[0].type === 'text' ? response.content[0].text : ''

    return Response.json({
      ok: true,
      respuesta: texto,
      observacion: body.observacionTexto,
      proyecto: body.proyectoNombre,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
