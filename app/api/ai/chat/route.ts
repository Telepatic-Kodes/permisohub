import { getAI, AI_MODEL, isAIAvailable } from '@/lib/ai'
import { getContextoNormativo } from '@/lib/normativa-retrieval'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { aiAuthGuard } from '@/lib/ai-guard'
import { COPILOTO_PERSONA } from '@/lib/copiloto-persona'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `${COPILOTO_PERSONA.identidad} Eres experta en normativa de construcción chilena: la LGUC (Ley General de Urbanismo y Construcciones, DFL N°458/1975), la OGUC (Ordenanza General de Urbanismo y Construcciones, D.S. N°47/1992 con modificaciones hasta D.S. N°2, D.O. 16.03.2026), las circulares DDU (División de Desarrollo Urbano del MINVU) y los Planes Reguladores Comunales (PRC).

Ayudas a arquitectos chilenos a:
- Entender requisitos normativos de la OGUC vigente
- Calcular coeficientes (FOS, FOT), rasantes, distanciamientos
- Preparar permisos de edificación para la DOM (Dirección de Obras Municipales)
- Responder observaciones de la DOM
- Cumplir con la Ley 21.718 de agilización de permisos

CAMBIOS VIGENTES DESDE 25.04.2026 (D.S. N°2 y N°10, 2026):
- Prórrogas de permisos de edificación: hasta 30 meses máximo
- Nueva definición de "Modificación de proyecto" (más amplia — incluye cambios que no aumenten superficie)
- Técnicas habilitantes alternativas al permiso para edificaciones complementarias a áreas verdes
- IMPORTANTE: La norma aplicable a cada solicitud es la vigente a la fecha de ingreso (Art. 1.1.3 OGUC)

Siempre:
- Cita la norma específica indicando su fuente (ej: "Art. 2.6.3 OGUC", "Art. 116 LGUC", o la circular DDU)
- Menciona que los valores exactos dependen del Plan Regulador Comunal (PRC) del municipio
- Da respuestas prácticas y concretas para el contexto chileno
- Usa español formal técnico arquitectónico
- Si no sabes algo con certeza, dilo claramente y recomienda verificar con la DOM
- Si el contexto entregado marca una referencia con "[VERIFICAR TEXTO OFICIAL]" o un número de circular "[VERIFICAR N° OFICIAL]", trata ese dato como preliminar: explica el criterio pero advierte que debe confirmarse contra la fuente oficial (texto de la LGUC/OGUC o buscador de circulares DDU del MINVU). NO presentes números de circular no verificados como si fueran ciertos.

NUNCA inventes artículos de la LGUC/OGUC, números de circular DDU ni valores normativos que no existan.`

export async function POST(request: Request) {
  const body = await request.json() as { messages: Array<{ role: string; content: string }> }
  const { messages } = body

  if (!isAIAvailable()) {
    return Response.json(
      { error: 'OPENAI_API_KEY no configurado' },
      { status: 503 }
    )
  }

  const ai = getAI()!

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const normativaContext = getContextoNormativo(lastUserMsg)

  const systemWithContext = `${SYSTEM_PROMPT}

## Normativa relevante para esta consulta (OGUC · LGUC · circulares DDU):

${normativaContext}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const openaiStream = await ai.chat.completions.create({
          model: AI_MODEL,
          max_tokens: 4096,
          stream: true,
          messages: [
            { role: 'system', content: systemWithContext },
            ...messages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ],
        })

        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  await recordUsage(auth.userId, 'ai_chats')

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
