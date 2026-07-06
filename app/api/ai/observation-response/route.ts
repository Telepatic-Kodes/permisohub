import { isAIAvailable, aiComplete } from '@/lib/ai'
import { getContextoNormativo, REGLAS_CITACION, flagUnverifiedCita } from '@/lib/normativa-retrieval'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'

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
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = await request.json() as ObservationRequest

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const normativaCtx = getContextoNormativo(body.observacionTexto)

  const prompt = `Eres una arquitecta chilena experta en permisos municipales. Ayudas al arquitecto a ENTENDER y SUBSANAR una observación que la DOM (Dirección de Obras Municipales) le emitió, y le redactas la respuesta formal.

## Contexto del proyecto:
- Nombre: ${body.proyectoNombre}
- Municipio: ${body.municipio}
- Tipo: ${body.tipoPermiso}
- Dirección: ${body.direccion ?? 'No especificada'}
- N° Expediente: ${body.numeroExpediente ?? 'Pendiente'}
- Arquitecta responsable: ${body.arquitecta ?? 'Estefanía Parada'}

## Observación de la DOM a responder (texto literal recibido):
${body.observacionTexto}

## Contexto normativo (OGUC · LGUC · DDU):
${normativaCtx}

${REGLAS_CITACION}

## INSTRUCCIONES:
Devuelve SOLO un JSON válido (sin markdown) con esta forma exacta:
{
  "queTePide": "en lenguaje simple y cercano, qué está pidiendo la DOM con esta observación (1-2 frases, sin jerga)",
  "comoSubsana": "qué debe hacer o corregir el arquitecto, concreto y accionable (1-3 frases)",
  "cita": "el artículo que funda la observación tal como aparece en el contexto (ej. \\"Art. 5.1.2 OGUC\\", \\"DDU 328\\") — o \\"\\" si ninguno del contexto la funda",
  "cartaFormal": "la respuesta formal completa a la DOM de ${body.municipio}: encabezado formal, respuesta a la observación citando el artículo, documentos adjuntos corregidos a acompañar, y cierre con firma de la arquitecta. Tono técnico, formal y constructivo."
}

Reglas: cita SOLO artículos presentes en el contexto normativo; si ninguno aplica deja "cita":"" y describe la materia sin número. Si la DOM aplicó mal la norma, indícalo respetuosamente en la carta con la cita correcta.`

  try {
    const texto = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 2200 })

    // Parseo tolerante: si el modelo devolvió JSON estructurado, lo usamos; si no,
    // caemos a tratar todo el texto como la carta formal (compatibilidad).
    let queTePide = ''
    let comoSubsana = ''
    let cita = ''
    let cartaFormal = texto
    const match = texto.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const raw = JSON.parse(match[0]) as {
          queTePide?: unknown
          comoSubsana?: unknown
          cita?: unknown
          cartaFormal?: unknown
        }
        if (typeof raw.cartaFormal === 'string' && raw.cartaFormal.trim()) cartaFormal = raw.cartaFormal
        if (typeof raw.queTePide === 'string') queTePide = raw.queTePide
        if (typeof raw.comoSubsana === 'string') comoSubsana = raw.comoSubsana
        if (typeof raw.cita === 'string') cita = flagUnverifiedCita(raw.cita)
      } catch {
        // deja la carta = texto crudo
      }
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({
      ok: true,
      respuesta: cartaFormal, // compatibilidad: la carta formal (la consume export/carta-respuesta)
      queTePide,
      comoSubsana,
      cita,
      observacion: body.observacionTexto,
      proyecto: body.proyectoNombre,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
