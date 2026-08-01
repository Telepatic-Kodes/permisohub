import { getAI, AI_MODEL, isAIAvailable } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import { obtenerBandasMercadoLocales } from '@/lib/mercado-locales-server'
import type { OperacionMercadoLocal } from '@/lib/scrapers/mercado-locales-common'
import { SYSTEM_PRICING_LOCAL, buildUserQueryPricing } from '@/lib/pricing-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface PricingInput {
  comuna: string
  operacion: OperacionMercadoLocal
  precioReferenciaUf?: string
}

export async function POST(request: Request) {
  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json()) as PricingInput
  const comuna = typeof body.comuna === 'string' ? body.comuna.trim() : ''
  const operacion = body.operacion === 'arriendo' || body.operacion === 'venta' ? body.operacion : null

  if (!comuna || !operacion) {
    return Response.json({ error: 'comuna y operacion (arriendo|venta) son obligatorios' }, { status: 400 })
  }

  const precioRefRaw = body.precioReferenciaUf ? Number(String(body.precioReferenciaUf).replace(',', '.').trim()) : null
  const precioReferenciaUf = precioRefRaw !== null && Number.isFinite(precioRefRaw) && precioRefRaw > 0 ? precioRefRaw : null

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const bandas = await obtenerBandasMercadoLocales(comuna, operacion)
  if (!bandas) {
    return Response.json(
      {
        error: `Sin datos de mercado todavía para ${comuna} (${operacion}). El motor de bandas corre junto al scraper diario — vuelve a intentar mañana.`,
      },
      { status: 404 },
    )
  }

  const ai = getAI()!
  const userQuery = buildUserQueryPricing(bandas, precioReferenciaUf)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Evento estructurado, ANTES del stream de texto — extensión no
        // disruptiva del contrato SSE (fase 5): un consumidor viejo que solo
        // lee "text"/"status"/"[DONE]" simplemente lo ignora. La página usa
        // esto para graficar la banda real (P25/mediana/P75) en vez de que
        // el usuario tenga que leerla dentro de la prosa de la IA.
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ bandas })}\n\n`))

        const openaiStream = await ai.chat.completions.create({
          model: AI_MODEL,
          max_tokens: 2048,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PRICING_LOCAL },
            { role: 'user', content: userQuery },
          ],
        })

        for await (const chunk of openaiStream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
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
