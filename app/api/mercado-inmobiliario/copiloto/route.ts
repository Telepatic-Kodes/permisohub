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

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as { messages?: { role: string; content: string }[] }
  const historialCrudo = body.messages ?? []

  // El rol y el contenido de cada mensaje vienen del cliente — antes se
  // castea con `as` sin validar, así que un body {"role":"system","content":
  // "..."} podía colarse DESPUÉS del system prompt real, y un mensaje
  // posterior con el mismo rol tiene prioridad sobre el original ante el
  // modelo. Se filtra a user/assistant con content string, y se acota
  // historial + largo para no dejar pasar un prompt arbitrariamente grande
  // (max_tokens solo acota la salida, no la entrada).
  const MAX_MENSAJES_HISTORIAL = 20
  const MAX_LARGO_MENSAJE = 4000
  const historial = historialCrudo
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MENSAJES_HISTORIAL)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_LARGO_MENSAJE) }))

  // Se registra el uso ANTES de abrir el stream, no después de que drene —
  // si el cliente aborta el fetch justo antes del [DONE], el enqueue final
  // tira y recordUsage nunca corría, dejando la respuesta ya generada
  // (y ya pagada a OpenAI) sin contar contra el cupo del plan.
  await recordUsage(auth.userId, 'ai_chats')

  const conversacion: ToolMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT_COPILOTO_MERCADO },
    ...historial,
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

        // Si se agotaron las MAX_RONDAS y la última ronda todavía volvió con
        // tool_calls (en vez de terminar por `contenidoFinal` seteado arriba),
        // los resultados de esas herramientas ya están en `conversacion` pero
        // nunca se le pidió al modelo que los use — antes esto se descartaba
        // en silencio y el usuario recibía el mensaje genérico de "no pude
        // resolver" pese a que las herramientas sí respondieron datos reales.
        // Una ronda final con tool_choice:'none' fuerza una respuesta de
        // texto a partir de lo ya reunido, sin abrir una ronda más de tools.
        if (!contenidoFinal) {
          const final = await aiCompleteWithTools(conversacion, HERRAMIENTAS_COPILOTO_MERCADO, { toolChoice: 'none' })
          contenidoFinal = final.content
        }

        if (!contenidoFinal) {
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
        controller.close()
      } catch (err) {
        // Si el cliente ya se desconectó, controller.enqueue/close acá
        // arriba puede lanzar de nuevo (stream ya cerrado) — sin este
        // try/catch interno, ese segundo error escapaba de start() sin que
        // nada lo capturara.
        try {
          const msg = err instanceof Error ? err.message : 'Error desconocido'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
          controller.close()
        } catch {
          // cliente desconectado — nada que hacer
        }
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
