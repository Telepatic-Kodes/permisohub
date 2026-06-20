import { getAI, AI_MODEL } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'

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

  const ai = getAI()
  if (!ai) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY no configurado' },
      { status: 503 }
    )
  }

  // Get the last user message for context retrieval
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const ogucContext = getContextoOGUC(lastUserMsg)

  // Inject OGUC context as first system message
  const systemWithContext = `${SYSTEM_PROMPT}

## Artículos OGUC relevantes para esta consulta:

${ogucContext}`

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = ai.messages.stream({
          model: AI_MODEL,
          max_tokens: 1500,
          system: systemWithContext,
          messages: messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        })

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const data = `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
            controller.enqueue(encoder.encode(data))
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
