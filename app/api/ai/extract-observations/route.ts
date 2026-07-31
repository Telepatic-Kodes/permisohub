import { z } from 'zod'
import { isAIAvailable, aiCompleteWithPDF } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { getLimits, isWithinLimit } from '@/lib/plan-limits'
import { getUsageThisMonth, recordUsage } from '@/lib/usage'
import type { PlanId } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'
import { flagUnverifiedCita } from '@/lib/normativa-retrieval'
import { parseAiJson } from '@/lib/ai-parse'

export const dynamic = 'force-dynamic'

// M5 (auditoría 2026-07-30): schema laxo — garantiza forma estructural, no
// restringe "tipo"/"gravedad" a un set cerrado (drift menor del modelo no
// tumba el parseo completo).
const ObservacionExtraidaSchema = z
  .object({
    numero: z.number().default(0),
    texto: z.string().default(''),
    articuloCitado: z.string().nullable().default(null),
    tipo: z.string().default('TECNICA'),
    gravedad: z.string().default('MEDIA'),
  })
  .passthrough()

const ExtractSchema = z
  .object({
    observaciones: z.array(ObservacionExtraidaSchema).default([]),
    municipio: z.string().nullable().default(null),
    expediente: z.string().nullable().default(null),
    fechaOrdinario: z.string().nullable().default(null),
    plazoRespuesta: z.number().nullable().default(null),
  })
  .passthrough()

export async function POST(request: Request) {
  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }
  const userId = user.id

  const rateLimit = await checkRateLimit(`ai:${userId}`)
  if (rateLimit) return rateLimit

  const userPlan: PlanId = await getUserPlan(user.id)
  const limits = getLimits(userPlan)
  const usage = await getUsageThisMonth(user.id, 'pdf_extractions')

  if (!isWithinLimit(usage, limits.pdfExtractionsPerMonth)) {
    return Response.json(
      { error: 'LIMIT_EXCEEDED', metric: 'pdf_extractions', plan: userPlan },
      { status: 402 },
    )
  }

  let pdfBase64: string
  let fileName: string

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'No se recibió archivo PDF' }, { status: 400 })
    }
    fileName = file.name
    const bytes = await file.arrayBuffer()
    pdfBase64 = Buffer.from(bytes).toString('base64')
  } catch {
    return Response.json({ error: 'Error procesando el archivo' }, { status: 400 })
  }

  const prompt = `Analiza este documento oficial de la DOM (Dirección de Obras Municipales) chilena.

TAREA: Extrae todas las observaciones técnicas del documento. Una observación es un punto donde la DOM indica que el proyecto no cumple con la normativa o requiere correcciones.

Responde ÚNICAMENTE con un JSON válido en este formato exacto (sin markdown, sin texto adicional):
{
  "observaciones": [
    {
      "numero": 1,
      "texto": "texto completo de la observación tal como aparece en el documento",
      "articuloCitado": "Art. X.X.X OGUC o nombre del PRC si se cita" o null,
      "tipo": "TECNICA" | "FORMAL" | "DOCUMENTOS",
      "gravedad": "ALTA" | "MEDIA" | "BAJA"
    }
  ],
  "municipio": "nombre del municipio si aparece" or null,
  "expediente": "número de expediente si aparece" or null,
  "fechaOrdinario": "fecha del ordinario en formato YYYY-MM-DD si aparece" or null,
  "plazoRespuesta": número de días hábiles para responder or null
}

Tipos:
- TECNICA: observación sobre diseño, normas OGUC, PRC, coeficientes, rasantes
- FORMAL: observación sobre documentos faltantes, firmas, formatos
- DOCUMENTOS: falta algún certificado, plano, memoria

Gravedad:
- ALTA: impide continuar, requiere rediseño o documentos fundamentales
- MEDIA: requiere corrección de planos o memoria
- BAJA: corrección menor, firma, formato

Si el documento no contiene observaciones (ya fue aprobado o es otro tipo de documento), devuelve:
{"observaciones": [], "municipio": null, "expediente": null, "fechaOrdinario": null, "plazoRespuesta": null}`

  try {
    const text = await aiCompleteWithPDF(prompt, pdfBase64, fileName, { max_tokens: 3000 })

    // M5: parseo validado con zod (antes: regex + JSON.parse + cast `as` sin
    // validación de runtime). Semántica preservada: sin JSON válido/parseable
    // esta ruta siempre respondió 500 ("No JSON en respuesta") — se mantiene.
    const parsed = parseAiJson(text, ExtractSchema, 'extract-observations')
    if (!parsed) throw new Error('No JSON en respuesta')

    // A2 (auditoría 2026-07-30): el modelo puede inventar un número de
    // artículo al citar la observación de la DOM. Cada `articuloCitado` pasa
    // por el guard anti-citas-inventadas antes de salir al cliente.
    const result = {
      ...parsed,
      observaciones: parsed.observaciones.map((o) => ({
        ...o,
        articuloCitado: o.articuloCitado ? flagUnverifiedCita(o.articuloCitado) : o.articuloCitado,
      })),
    }

    // Register a successful extraction against the user's monthly quota.
    await recordUsage(userId, 'pdf_extractions')

    return Response.json({
      ok: true,
      fileName,
      ...result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
