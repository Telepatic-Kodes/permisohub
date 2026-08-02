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

  // Antes: `z.object({type}).passthrough()` + `as any` en cada rama —
  // cualquier usuario autenticado (no solo el dueño de la cuenta) podía
  // mandar un body con forma arbitraria y el `as any` dejaba pasar lo que
  // fuera directo a Resend como `to`/contenido de un email desde el dominio
  // verificado de la empresa. Un discriminated union real valida tipo,
  // formato de `to` y acota el largo de cada campo de texto libre (nada
  // evita mandar un email de prueba a un destino arbitrario — esa es la
  // función real de "enviar prueba" en Configuración — pero ya no se puede
  // mandar un payload de forma/tamaño arbitrarios).
  const TXT = (max: number) => z.string().trim().min(1).max(max)
  const NotifyDispatchSchema = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("observacion"),
      to: z.string().email(),
      clienteNombre: TXT(200),
      proyectoNombre: TXT(200),
      municipio: TXT(100),
      expediente: TXT(100),
      descripcionObservacion: TXT(2000),
      plazoRespuesta: TXT(100),
    }),
    z.object({
      type: z.literal("deadline"),
      to: z.string().email(),
      clienteNombre: TXT(200),
      proyectoNombre: TXT(200),
      municipio: TXT(100),
      diasRestantes: z.number().int(),
      fechaEstimada: TXT(100),
    }),
    z.object({
      type: z.literal("estado_change"),
      to: z.string().email(),
      clienteNombre: TXT(200),
      proyectoNombre: TXT(200),
      estadoAnterior: TXT(100),
      estadoNuevo: TXT(100),
      descripcion: TXT(2000).optional(),
    }),
    z.object({
      type: z.literal("resumen"),
      to: z.string().email(),
      clienteNombre: TXT(200),
      proyectos: z
        .array(
          z.object({
            nombre: TXT(200),
            municipio: TXT(100),
            estado: TXT(100),
            etapa: TXT(200),
            fechaEstimada: TXT(100).optional(),
            tieneAlerta: z.boolean().optional(),
          }),
        )
        .max(50),
      tipSemanal: TXT(1000).optional(),
    }),
  ])

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

  const { data } = parsed

  switch (data.type) {
    case "observacion":
      return Response.json(await sendObservacionAlert(data))
    case "deadline":
      return Response.json(await sendDeadlineAlert(data))
    case "estado_change":
      return Response.json(await sendEstadoChangeAlert(data))
    case "resumen":
      return Response.json(await sendResumenSemanal(data))
  }
}
