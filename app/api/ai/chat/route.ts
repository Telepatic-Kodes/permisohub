import { getAI, AI_MODEL } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { getLimits, isWithinLimit } from '@/lib/plan-limits'
import { getUsageThisMonth, recordUsage } from '@/lib/usage'
import type { PlanId } from '@/lib/stripe'

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

  // Feature gating: enforce per-plan monthly AI chat limits.
  // In development we always treat the user as 'pro' and skip the usage
  // check so local development is never blocked.
  const isDev = process.env.NODE_ENV === 'development'
  let userId: string | null = null

  if (!isDev) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }
    userId = user.id

    const userPlan: PlanId = await getUserPlan(user.id)
    const limits = getLimits(userPlan)
    const usage = await getUsageThisMonth(user.id, 'ai_chats')

    if (!isWithinLimit(usage, limits.aiChatsPerMonth)) {
      return Response.json(
        { error: 'LIMIT_EXCEEDED', metric: 'ai_chats', plan: userPlan },
        { status: 402 }
      )
    }
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

  // Record usage before returning the stream (SSE response body cannot be
  // awaited downstream, so we must register the event here).
  if (userId) {
    await recordUsage(userId, 'ai_chats')
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
