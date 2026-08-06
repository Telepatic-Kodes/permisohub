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
import { buscarDatosSIIPorRol } from '@/lib/sii-lookup-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as DueDiligencePropiedadInput

  if (!body.direccion || typeof body.direccion !== 'string' || body.direccion.trim().length === 0) {
    return Response.json({ error: 'Dirección requerida' }, { status: 400 })
  }

  // Antes del stream, no después de que drene — mismo criterio que
  // /api/tasacion: si el cliente aborta mientras el informe (12.000 tokens,
  // varias búsquedas web) sigue generándose, recordUsage nunca corría.
  await recordUsage(auth.userId, 'ai_chats')

  const uf = await obtenerValorUF()
  // Sin comuna no hay consulta al SII: su endpoint resuelve por comuna, y
  // asumir una (antes se asumía Región Metropolitana) devolvería el predio de
  // otra persona con el mismo rol. Preferimos el informe sin cruce fiscal.
  const siiData = body.rol && body.comuna
    ? await buscarDatosSIIPorRol(body.rol, body.comuna, request.headers.get('cookie'))
    : null
  const userQuery = buildUserQueryDueDiligencePropiedad(body, uf, siiData)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Mismo patrón que /api/tasacion: evento estructurado antes del texto.
        if (siiData) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ avaluoFiscal: siiData })}\n\n`))

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
