import { streamConBusquedaWeb } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import { obtenerValorUF } from '@/lib/scrapers/terrenos-common'
import { buildSystemTasacionTerreno, buildUserQueryTasacion, type TasacionInput } from '@/lib/tasacion-prompts'
import { buscarDatosSIIPorRol } from '@/lib/sii-lookup-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  // Antes del stream, no después de que drene — si el cliente aborta el
  // fetch mientras el informe (12.000 tokens, varias búsquedas web) sigue
  // generándose, el enqueue del catch tira de nuevo y recordUsage nunca
  // corría, dejando un informe ya generado (y ya pagado a OpenAI) sin
  // contar contra el cupo del plan.
  await recordUsage(auth.userId, 'ai_chats')

  const body = (await request.json().catch(() => ({}))) as TasacionInput

  if (!body.direccion || typeof body.direccion !== 'string' || body.direccion.trim().length === 0) {
    return Response.json({ error: 'Dirección requerida' }, { status: 400 })
  }
  if (!body.comuna || typeof body.comuna !== 'string' || body.comuna.trim().length === 0) {
    return Response.json({ error: 'Comuna requerida' }, { status: 400 })
  }
  if (!body.superficieM2 || isNaN(Number(body.superficieM2)) || Number(body.superficieM2) <= 0) {
    return Response.json({ error: 'Superficie inválida' }, { status: 400 })
  }
  if (!body.tipo || typeof body.tipo !== 'string') {
    return Response.json({ error: 'Tipo de terreno requerido' }, { status: 400 })
  }
  // superficieM2 puede llegar como number desde JSON.parse (el tipo `string`
  // de TasacionInput es solo el cast, no una garantía runtime) —
  // buildUserQueryTasacion pasa cada campo por clip(), que devuelve '' si
  // typeof !== 'string' (para no fabricar una superficie inventada al
  // truncar); sin coercer acá, un superficieM2 numérico ya validado arriba
  // se perdía en el prompt como "Superficie:  m²." en blanco.
  body.superficieM2 = String(body.superficieM2)

  const uf = await obtenerValorUF()
  const siiData = body.rolSii ? await buscarDatosSIIPorRol(body.rolSii, request.headers.get('cookie')) : null

  const instructions = buildSystemTasacionTerreno({ tieneDatosSII: siiData !== null })
  const userQuery = buildUserQueryTasacion(body, uf, siiData)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Evento estructurado antes del texto — mismo patrón ya probado en
        // /api/pricing (Fase 5) para las bandas de precio. Un consumidor
        // viejo que solo lee text/status/[DONE] lo ignora sin romperse.
        if (siiData) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ avaluoFiscal: siiData })}\n\n`))

        const responseStream = await streamConBusquedaWeb(instructions, userQuery)

        let emitidoStatusBusqueda = false
        for await (const event of responseStream) {
          if (
            (event.type === 'response.web_search_call.in_progress' || event.type === 'response.web_search_call.searching') &&
            !emitidoStatusBusqueda
          ) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'Buscando comparables y datos normativos…' })}\n\n`))
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
