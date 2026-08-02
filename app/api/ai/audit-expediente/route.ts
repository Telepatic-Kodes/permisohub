import { z } from 'zod'
import { isAIAvailable, aiComplete } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { parseAiJson } from '@/lib/ai-parse'

export const dynamic = 'force-dynamic'

// Sin este tope, un cliente puede adjuntar cientos de archivos en el
// formData — el prompt (lista de nombres) y el costo/latencia de la llamada
// a OpenAI escalan con la cantidad sin ningún límite hoy.
const MAX_ARCHIVOS = 30

// M5 (mismo patrón que copiloto/route.ts y cuadro-sugerido/route.ts): antes
// esto era un `JSON.parse(...) as ClaudeAuditPayload` sin validación de
// runtime — un cambio de forma del modelo pasaba directo a la UI.
const DocumentoAuditadoSchema = z
  .object({
    nombre: z.string().default(''),
    tipoInferido: z.string().default(''),
    estado: z.enum(['OK', 'FALTA', 'INCOMPLETO', 'VERIFICAR']).default('VERIFICAR'),
    observaciones: z.array(z.string()).default([]),
    recomendacion: z.string().default(''),
  })
  .passthrough()

const AuditPayloadSchema = z
  .object({
    documentos: z.array(DocumentoAuditadoSchema).default([]),
    documentosFaltantes: z.array(z.string()).default([]),
    puntaje: z.number().default(0),
    aptoParaIngreso: z.boolean().default(false),
    resumen: z.string().default(''),
  })
  .passthrough()

interface AuditResult {
  ok: boolean
  municipio: string
  tipoObra: string
  documentos: z.infer<typeof DocumentoAuditadoSchema>[]
  documentosFaltantes: string[]
  puntaje: number
  aptoParaIngreso: boolean
  resumen: string
}

export async function POST(request: Request): Promise<Response> {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  let municipio: string
  let tipoObra: string
  let fileNames: string[]

  try {
    const formData = await request.formData()
    municipio = (formData.get('municipio') as string | null) ?? ''
    tipoObra = (formData.get('tipoObra') as string | null) ?? 'permiso_edificacion'

    if (!municipio) {
      return Response.json({ error: 'Municipio requerido' }, { status: 400 })
    }

    const files = formData.getAll('files') as File[]
    if (files.length === 0) {
      return Response.json({ error: 'Se requiere al menos un archivo' }, { status: 400 })
    }
    if (files.length > MAX_ARCHIVOS) {
      return Response.json({ error: `Máximo ${MAX_ARCHIVOS} archivos por auditoría` }, { status: 400 })
    }

    fileNames = files.map((f) => f.name)
  } catch {
    return Response.json({ error: 'Error procesando la solicitud' }, { status: 400 })
  }

  const contextoOGUC = getContextoOGUC('expediente permiso edificación documentos requeridos')

  const listaArchivos = fileNames.map((name, i) => `${i + 1}. ${name}`).join('\n')

  const prompt = `Eres un experto en permisos de edificación chilenos. El arquitecto va a ingresar un ${tipoObra} a la DOM de ${municipio}.

DOCUMENTOS SUBIDOS:
${listaArchivos}

CONTEXTO OGUC:
${contextoOGUC}

Para un permiso de edificación en Chile, los documentos típicamente requeridos son:
1. Solicitud de permiso (formulario DOM)
2. Memoria descriptiva con cuadro de superficies
3. Plano de emplazamiento (escala 1:500 o 1:1000) con rasantes y distanciamientos
4. Plantas, cortes y elevaciones (escala 1:50 o 1:100)
5. Levantamiento topográfico
6. Especificaciones técnicas
7. Cuadro de valores (derechos)
8. Certificado de informaciones previas (CIP)
9. Informe de factibilidad de agua/alcantarillado (si aplica)
10. Certificado de alineación (si aplica)

Analiza cuáles de los documentos subidos corresponden a cada categoría. Infiere el tipo de documento por el nombre del archivo (ej: "memoria" → memoria descriptiva, "emplazamiento" → plano emplazamiento, "levantamiento" o "topo" → levantamiento topográfico, "planta" → plantas/cortes/elevaciones, "especificaciones" o "EETT" → especificaciones técnicas, "CIP" o "informaciones" → CIP, "factibilidad" o "agua" → factibilidad, "alineacion" → certificado de alineación, "formulario" o "solicitud" → solicitud de permiso, "cuadro" o "derechos" o "valores" → cuadro de valores).

Identifica cuáles de los documentos requeridos faltan. Para los documentos subidos, evalúa si el nombre sugiere que están completos o si requieren verificación.

Responde SOLO con JSON válido (sin markdown, sin texto adicional):
{
  "documentos": [
    {
      "nombre": "nombre del archivo tal como fue subido",
      "tipoInferido": "tipo de documento inferido",
      "estado": "OK" | "INCOMPLETO" | "VERIFICAR",
      "observaciones": ["observación 1", "observación 2"],
      "recomendacion": "recomendación específica para este documento"
    }
  ],
  "documentosFaltantes": ["nombre descriptivo del documento que falta"],
  "puntaje": número entre 0 y 100,
  "aptoParaIngreso": true | false,
  "resumen": "resumen ejecutivo del estado del expediente en 2-3 oraciones"
}`

  try {
    // El array "documentos" escala con la cantidad de PDFs subidos al
    // expediente, no es un tamaño fijo — 4500 alcanza para pocos archivos
    // pero no para el máximo permitido (MAX_ARCHIVOS). Se escala con la
    // cantidad de archivos en vez de dejar un tope plano.
    const maxTokens = Math.min(8000, 3000 + fileNames.length * 150)
    const text = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: maxTokens })

    const parsed = parseAiJson(text, AuditPayloadSchema, 'audit-expediente')
    if (!parsed) {
      return Response.json({ error: 'La IA no devolvió un resultado válido — intenta de nuevo' }, { status: 502 })
    }

    const result: AuditResult = {
      ok: true,
      municipio,
      tipoObra,
      documentos: parsed.documentos,
      documentosFaltantes: parsed.documentosFaltantes,
      puntaje: parsed.puntaje,
      aptoParaIngreso: parsed.aptoParaIngreso,
      resumen: parsed.resumen,
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
