import {
  sendDeadlineAlert,
  sendEstadoChangeAlert,
  sendObservacionAlert,
  sendResumenSemanal,
} from "@/lib/email"

// Notifications are sent on demand and must never be cached.
export const dynamic = "force-dynamic"

/**
 * Trigger an email notification.
 *
 * Body: { type: 'observacion' | 'deadline' | 'estado_change' | 'resumen', ...params }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { type, ...params } = body as { type?: string } & Record<
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
