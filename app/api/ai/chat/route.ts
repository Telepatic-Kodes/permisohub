import { getAI, AI_MODEL, isAIAvailable } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { aiAuthGuard } from '@/lib/ai-guard'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `Eres un experto en normativa de construcción chilena, específicamente en la OGUC (Ordenanza General de Urbanismo y Construcciones) y los Planes Reguladores Comunales (PRC).

Ayudas a arquitectos chilenos a:
- Entender requisitos normativos de la OGUC
- Calcular coeficientes (FOS, FOT), rasantes, distanciamientos
- Preparar permisos de edificación para la DOM (Dirección de Obras Municipales)
- Responder observaciones de la DOM
- Cumplir con la Ley 21.718 de agilización de permisos

Siempre:
- Cita el artículo OGUC específico (ej: "Art. 2.6.3 OGUC")
- Menciona que los valores exactos dependen del Plan Regulador Comunal (PRC) del municipio
- Da respuestas prácticas y concretas para el contexto chileno
- Usa español formal técnico arquitectónico
- Si no sabes algo con certeza, dilo claramente y recomienda verificar con la DOM

NUNCA inventes artículos OGUC o valores normativos que no existan.`

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
  const ogucContext = getContextoOGUC(lastUserMsg)

  const systemWithContext = `${SYSTEM_PROMPT}

## Artículos OGUC relevantes para esta consulta:

${ogucContext}`

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
