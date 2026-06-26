import {
  sendDeadlineAlert,
  sendEstadoChangeAlert,
  sendObservacionAlert,
  sendResumenSemanal,
} from "@/lib/email"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"

// Notifications are sent on demand and must never be cached.
export const dynamic = "force-dynamic"

/**
 * Trigger an email notification.
 *
 * Body: { type: 'observacion' | 'deadline' | 'estado_change' | 'resumen', ...params }
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`notify:${user.id}`)
  if (rateLimit) return rateLimit

  const NotifyDispatchSchema = z.object({
    type: z.string().min(1),
  }).passthrough()

  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = NotifyDispatchSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 })
  }

  const { type, ...params } = parsed.data as { type: string } & Record<
    string,
    unknown
  >

  switch (type) {
    case "observacion":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Response.json(await sendObservacionAlert(params as any))
    case "deadline":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Response.json(await sendDeadlineAlert(params as any))
    case "estado_change":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Response.json(await sendEstadoChangeAlert(params as any))
    case "resumen":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Response.json(await sendResumenSemanal(params as any))
    default:
      return Response.json(
        { error: "Unknown notification type" },
        { status: 400 }
      )
  }
}
