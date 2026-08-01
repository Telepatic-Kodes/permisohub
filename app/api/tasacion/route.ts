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
  const body = (await request.json()) as TasacionInput

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

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

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
