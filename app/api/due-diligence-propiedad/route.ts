import { streamConBusquedaWeb } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import { obtenerValorUF } from '@/lib/scrapers/terrenos-common'
import {
  SYSTEM_DUE_DILIGENCE_PROPIEDAD,
  buildUserQueryDueDiligencePropiedad,
  type DueDiligencePropiedadInput,
} from '@/lib/due-diligence-propiedad-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const body = (await request.json()) as DueDiligencePropiedadInput

  if (!body.direccion || typeof body.direccion !== 'string' || body.direccion.trim().length === 0) {
    return Response.json({ error: 'Dirección requerida' }, { status: 400 })
  }

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const uf = await obtenerValorUF()
  const userQuery = buildUserQueryDueDiligencePropiedad(body, uf)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const responseStream = await streamConBusquedaWeb(SYSTEM_DUE_DILIGENCE_PROPIEDAD, userQuery)

        let emitidoStatusBusqueda = false
        for await (const event of responseStream) {
          if (
            (event.type === 'response.web_search_call.in_progress' || event.type === 'response.web_search_call.searching') &&
            !emitidoStatusBusqueda
          ) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'Investigando dominio, gravámenes y normativa…' })}\n\n`))
            emitidoStatusBusqueda = true
          }

          if (event.type === 'response.output_text.delta' && 'delta' in event) {
            const text = String((event as { delta?: string }).delta ?? '')
            if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
          }

          if (event.type === 'response.completed') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          }
        }

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
