import { isAIAvailable, aiComplete } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { ESTADISTICAS_MUNICIPIOS } from '@/lib/municipios-stats'

export const dynamic = 'force-dynamic'

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

  const prompt = `Eres un experto en permisos de edificación chilenos. Analiza este proyecto y predice las observaciones más probables que recibirá de la DOM (Dirección de Obras Municipales).

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
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) as PredictResult : {
      municipio: body.municipio,
      riesgoGlobal: 'MEDIO' as const,
      mesOptimo: stats?.mesesMasAgiles[0] ?? 'Enero',
      predicciones: [] as Prediccion[],
      resumen: text,
    }

    return Response.json({ ok: true, ...parsed })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
