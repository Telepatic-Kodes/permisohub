import { isAIAvailable, aiComplete } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface DocumentoAuditado {
  nombre: string
  tipoInferido: string
  estado: 'OK' | 'FALTA' | 'INCOMPLETO' | 'VERIFICAR'
  observaciones: string[]
  recomendacion: string
}

interface AuditResult {
  ok: boolean
  municipio: string
  tipoObra: string
  documentos: DocumentoAuditado[]
  documentosFaltantes: string[]
  puntaje: number
  aptoParaIngreso: boolean
  resumen: string
}

interface ClaudeAuditPayload {
  documentos: DocumentoAuditado[]
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
    const text = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 3000 })
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON en respuesta')

    const parsed = JSON.parse(jsonMatch[0]) as ClaudeAuditPayload

    const result: AuditResult = {
      ok: true,
      municipio,
      tipoObra,
      documentos: parsed.documentos ?? [],
      documentosFaltantes: parsed.documentosFaltantes ?? [],
      puntaje: parsed.puntaje ?? 0,
      aptoParaIngreso: parsed.aptoParaIngreso ?? false,
      resumen: parsed.resumen ?? '',
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
