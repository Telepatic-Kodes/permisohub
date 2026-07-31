import { z } from 'zod'
import { isAIAvailable, aiComplete } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { ESTADISTICAS_MUNICIPIOS } from '@/lib/municipios-stats'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { flagUnverifiedCita } from '@/lib/normativa-retrieval'
import { parseAiJson } from '@/lib/ai-parse'

export const dynamic = 'force-dynamic'

// M5 (auditoría 2026-07-30): schema laxo — garantiza forma estructural, no
// restringe "riesgoGlobal" a un set cerrado (drift menor del modelo no tumba
// el parseo completo).
const PrediccionSchema = z
  .object({
    categoria: z.string().default(''),
    probabilidad: z.number().default(0),
    descripcion: z.string().default(''),
    accion: z.string().default(''),
    frecuenciaLocal: z.boolean().default(false),
  })
  .passthrough()

const PredictSchema = z
  .object({
    municipio: z.string().default(''),
    riesgoGlobal: z.string().default('MEDIO'),
    mesOptimo: z.string().default(''),
    predicciones: z.array(PrediccionSchema).default([]),
    resumen: z.string().default(''),
  })
  .passthrough()

interface PredictRequest {
  municipio: string
  zonaPRC: string
  superficieTerreno: number
  superficieConstruida: number
  superficieHuella: number
  pisos: number
  alturaMaxima: number
  distanciamientoFrontal: number
  distanciamientoLateral: number
  tipoObra: string
  // SII enrichment (optional — populated when architect used SIIEnricher)
  rolSII?: string
  destinoActualSII?: string
  avaluoFiscalCLP?: number
  superficieTerrenoSII?: number
  superficieConstruidaSII?: number
}

interface Prediccion {
  categoria: string
  probabilidad: number
  descripcion: string
  accion: string
  frecuenciaLocal: boolean
}

interface PredictResult {
  municipio: string
  riesgoGlobal: 'BAJO' | 'MEDIO' | 'ALTO'
  mesOptimo: string
  predicciones: Prediccion[]
  resumen: string
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = await request.json() as PredictRequest

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const stats = ESTADISTICAS_MUNICIPIOS.find(m => m.nombre === body.municipio)
  const fotReal = body.superficieTerreno > 0 ? body.superficieConstruida / body.superficieTerreno : 0
  const fosReal = body.superficieTerreno > 0 ? body.superficieHuella / body.superficieTerreno : 0
  const ogucContext = getContextoOGUC('FOT FOS rasante distanciamiento observaciones')

  const statsSection = stats
    ? `## Estadísticas reales DOM ${body.municipio}:
- Tasa histórica de observaciones: ${Math.round(stats.tasaObservaciones * 100)}%
- Observaciones más frecuentes en este municipio: ${stats.tiposObservacionFrequentes.join(', ')}
- Meses más ágiles para ingresar: ${stats.mesesMasAgiles.join(', ')}
- Notas clave de la DOM: ${stats.notas}`
    : ''

  // Build SII section if catastral data was provided
  const hasSII = Boolean(body.rolSII ?? body.destinoActualSII ?? body.avaluoFiscalCLP)
  const CLP = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
  const destinoConflicto =
    body.destinoActualSII &&
    body.tipoObra === 'cambio_destino' &&
    body.destinoActualSII.toUpperCase() !== 'COMERCIO'
  const superficieConflicto =
    body.superficieTerrenoSII &&
    body.superficieTerreno > 0 &&
    Math.abs(body.superficieTerrenoSII - body.superficieTerreno) / body.superficieTerrenoSII > 0.05

  const siiSection = hasSII
    ? `## Datos catastrales SII del predio (Rol ${body.rolSII ?? 'no especificado'}):
- Destino actual según SII: ${body.destinoActualSII ?? 'No disponible'}
- Tipo de obra solicitada: ${body.tipoObra}${destinoConflicto ? ' ⚠️ CAMBIO DE DESTINO — el predio es actualmente NO COMERCIAL, la DOM revisará el cumplimiento de la normativa de cambio de uso' : ''}
- Avalúo fiscal: ${body.avaluoFiscalCLP ? CLP.format(body.avaluoFiscalCLP) : 'No disponible'}
- Superficie terreno SII: ${body.superficieTerrenoSII ? `${body.superficieTerrenoSII} m²` : 'No disponible'}${superficieConflicto ? ` ⚠️ DISCREPANCIA con superficie declarada (${body.superficieTerreno} m²) — diferencia >5%, la DOM puede solicitar plano actualizado` : ''}
- Superficie construida SII: ${body.superficieConstruidaSII ? `${body.superficieConstruidaSII} m²` : 'No disponible'}

IMPORTANTE: Usa estos datos catastrales para identificar observaciones específicas relacionadas con:
1. Si el destino SII no coincide con el uso propuesto → riesgo de observación por cambio no autorizado
2. Si la superficie propuesta supera la superficie registrada en el SII → posible discrepancia con escrituras
3. Si el avalúo fiscal es muy bajo vs. presupuesto de obra → la DOM puede cuestionar el valor declarado`
    : ''

  const prompt = `Eres un experto en permisos de edificación chilenos. Analiza este proyecto y predice las observaciones más probables que recibirá de la DOM (Dirección de Obras Municipales). Normativa de referencia: OGUC D.S. N°47/1992 con modificaciones hasta D.S. N°2, D.O. 16.03.2026 (vigente 25.04.2026).

## Datos del proyecto:
- Municipio: ${body.municipio}
- Zona PRC: ${body.zonaPRC}
- Tipo de obra: ${body.tipoObra}
- Superficie terreno: ${body.superficieTerreno} m²
- Superficie construida: ${body.superficieConstruida} m²
- Huella edificación: ${body.superficieHuella} m²
- FOT calculado: ${fotReal.toFixed(3)}
- FOS calculado: ${fosReal.toFixed(3)}
- Pisos: ${body.pisos}
- Altura máxima: ${body.alturaMaxima} m
- Distanciamiento frontal: ${body.distanciamientoFrontal} m
- Distanciamiento lateral: ${body.distanciamientoLateral} m

${siiSection}

${statsSection}

## Artículos OGUC relevantes:
${ogucContext}

Responde SOLO con un JSON válido (sin markdown, sin texto extra) con esta estructura exacta:
{
  "municipio": "${body.municipio}",
  "riesgoGlobal": "BAJO" o "MEDIO" o "ALTO",
  "mesOptimo": "nombre del mejor mes para ingresar según estadísticas del municipio",
  "predicciones": [
    {
      "categoria": "nombre categoría concisa (ej: Rasantes Art. 2.6.3)",
      "probabilidad": número entre 0 y 1,
      "descripcion": "descripción concisa del riesgo en máximo 2 oraciones",
      "accion": "acción específica para prevenir esta observación",
      "frecuenciaLocal": true si está en las observaciones frecuentes del municipio, false si no
    }
  ],
  "resumen": "resumen ejecutivo de 2-3 oraciones con el diagnóstico general"
}

Ordena predicciones de mayor a menor probabilidad. Máximo 6 predicciones. Sé específico con artículos OGUC.`

  try {
    const text = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 2000 })

    // M5: parseo validado con zod (antes: regex + JSON.parse + cast `as` sin
    // validación de runtime). En fallo, degrada al mismo fallback que existía.
    const validated = parseAiJson(text, PredictSchema, 'predict-observations') ?? {
      municipio: body.municipio,
      riesgoGlobal: 'MEDIO',
      mesOptimo: stats?.mesesMasAgiles[0] ?? 'Enero',
      predicciones: [],
      resumen: text,
    }

    const riesgoGlobal: PredictResult['riesgoGlobal'] =
      validated.riesgoGlobal === 'BAJO' || validated.riesgoGlobal === 'ALTO'
        ? validated.riesgoGlobal
        : 'MEDIO'

    // A2 (auditoría 2026-07-30): a diferencia de las demás rutas, aquí no hay
    // un campo `articulo` separado — el modelo embebe la cita DENTRO de la
    // prosa de "categoria" (ej. "Rasantes Art. 2.6.3"). El render path
    // (app/(dashboard)/herramientas/predictor/page.tsx) imprime `categoria`
    // como texto plano — no pasa por <TextoConCitas> (ese componente solo
    // LINKIFICA citas verificadas dentro de prosa, no anota "por verificar"
    // las no verificadas, así que por sí solo no basta como guard). Por eso
    // se aplica flagUnverifiedCita directo sobre el string de "categoria":
    // es la misma función usada en el resto de la app para anotar citas no
    // verificadas, y opera por regex sobre CUALQUIER string, no solo sobre
    // campos de artículo puros — si el número citado no está en la base
    // curada, el sufijo "(por verificar)" queda visible en la etiqueta.
    const parsed: PredictResult = {
      ...validated,
      riesgoGlobal,
      predicciones: validated.predicciones.map((p) => ({
        ...p,
        categoria: flagUnverifiedCita(p.categoria),
      })),
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, ...parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
