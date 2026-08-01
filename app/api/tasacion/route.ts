import { streamConBusquedaWeb } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import { obtenerValorUF } from '@/lib/scrapers/terrenos-common'
import { buildSystemTasacionTerreno, buildUserQueryTasacion, type TasacionInput } from '@/lib/tasacion-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

interface SIILookupData {
  avaluo_fiscal_clp: number | null
  superficie_terreno_m2: number | null
  superficie_construida_m2: number | null
  destino: string
}

// Cruce SII vía el mismo endpoint /api/sii/lookup que ya usa terrenos
// (lib/terrenos-server.ts::enriquecerTerreno) — reenviando el header Cookie
// de la request entrante para que su propio supabase.auth.getUser() vea la
// sesión del usuario. Limitación real a respetar: esa ruta solo resuelve por
// rol (?rol=), no por dirección — sin rol_sii no hay cruce fiscal posible.
async function buscarDatosSII(rolSii: string, cookieHeader: string | null): Promise<SIILookupData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
    const res = await fetch(`${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(rolSii)}`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    })
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; data?: SIILookupData }
    if (!json.ok || !json.data) return null
    return json.data
  } catch (err) {
    console.warn('[tasacion] SII lookup falló (best-effort, continúa sin cruce fiscal):', err instanceof Error ? err.message : err)
    return null
  }
}

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
  const siiData = body.rolSii ? await buscarDatosSII(body.rolSii, request.headers.get('cookie')) : null

  const instructions = buildSystemTasacionTerreno({ tieneDatosSII: siiData !== null })
  const userQuery = buildUserQueryTasacion(body, uf, siiData)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
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
