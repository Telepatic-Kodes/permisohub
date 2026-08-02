import { streamConContexto } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import {
  buildSystemResumenOportunidad,
  buildUserQueryResumenOportunidad,
  type ResumenOportunidadContexto,
} from '@/lib/resumen-oportunidad-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  // Antes del stream, no después — mismo motivo que app/api/tasacion/route.ts:
  // si el cliente aborta el fetch mientras el resumen sigue generándose, el
  // uso ya se pagó a OpenAI y debe contar contra el cupo del plan igual.
  await recordUsage(auth.userId, 'ai_chats')

  const body = (await request.json().catch(() => null)) as ResumenOportunidadContexto | null
  if (!body || typeof body.titulo !== 'string' || typeof body.comuna !== 'string') {
    return Response.json({ error: 'Contexto de oportunidad inválido' }, { status: 400 })
  }

  const instructions = buildSystemResumenOportunidad()
  const userQuery = buildUserQueryResumenOportunidad(body)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const responseStream = await streamConContexto(instructions, userQuery)

        for await (const event of responseStream) {
          if (event.type === 'response.output_text.delta' && 'delta' in event) {
            const text = String((event as { delta?: string }).delta ?? '')
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }

          if (event.type === 'response.completed') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          }
        }

        controller.close()
      } catch (err) {
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
