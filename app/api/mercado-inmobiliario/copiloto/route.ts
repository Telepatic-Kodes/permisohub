import { isAIAvailable, aiCompleteWithTools, type ToolMessage } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import {
  HERRAMIENTAS_COPILOTO_MERCADO,
  SYSTEM_PROMPT_COPILOTO_MERCADO,
  ejecutarHerramientaCopilotoMercado,
} from '@/lib/mercado-inmobiliario-copiloto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tope de rondas de tool-calling — evita un loop infinito si el modelo
// insiste en llamar herramientas sin converger a una respuesta final.
const MAX_RONDAS = 4

export async function POST(request: Request) {
  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json()) as { messages?: { role: string; content: string }[] }
  const historial = body.messages ?? []

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const conversacion: ToolMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_COPILOTO_MERCADO },
    ...historial.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let contenidoFinal: string | null = null

        for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
          const resultado = await aiCompleteWithTools(conversacion, HERRAMIENTAS_COPILOTO_MERCADO)

          if (resultado.toolCalls.length === 0) {
            contenidoFinal = resultado.content
            break
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'Consultando datos reales…' })}\n\n`))

          // El mensaje del asistente con tool_calls debe reenviarse tal cual
          // (shape exacto del SDK) antes de los `role: 'tool'` que responden
          // cada llamada — OpenAI lo exige para aceptar el siguiente turno.
          conversacion.push(resultado.rawAssistantMessage)

          for (const llamada of resultado.toolCalls) {
            const datos = await ejecutarHerramientaCopilotoMercado(llamada.name, llamada.args)
            conversacion.push({
              role: 'tool',
              tool_call_id: llamada.id,
              content: JSON.stringify(datos),
            })
          }
        }

        if (contenidoFinal === null) {
          contenidoFinal =
            'No pude resolver esta consulta con las herramientas disponibles — intenta reformular la pregunta o sé más específico con la comuna y el tipo de propiedad.'
        }

        // Drip-feed del texto ya generado en vez de un segundo round-trip a
        // OpenAI solo para "streamearlo" — la ronda de tool-calling ya es la
        // que domina la latencia real; esto mantiene el mismo contrato SSE
        // (`data:{text}` .. `[DONE]`) que el resto de la app sin gastar una
        // llamada extra al modelo.
        const palabras = contenidoFinal.split(/(\s+)/)
        for (let i = 0; i < palabras.length; i += 4) {
          const trozo = palabras.slice(i, i + 4).join('')
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: trozo })}\n\n`))
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        await recordUsage(auth.userId, 'ai_chats')
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
