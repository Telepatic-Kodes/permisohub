export const dynamic = 'force-dynamic'
export const maxDuration = 90

import { createClient } from '@/lib/supabase/server'
import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { ESTADISTICAS_MUNICIPIOS } from '@/lib/municipios-stats'
import { getInteligenciaMunicipio } from '@/lib/inteligencia-dom'
import type { Proyecto } from '@/types'

// ---------------------------------------------------------------------------
// Pre-revisión DOM — "acta de observaciones simulada"
//
// Reúne el conocimiento de los motores OGUC + predicción de observaciones +
// inteligencia municipal en un solo documento con el formato de un acta real
// de la Dirección de Obras Municipales. El arquitecto ve las observaciones que
// probablemente recibiría ANTES de ingresar el expediente.
// ---------------------------------------------------------------------------

interface PreRevisionRequest {
  proyectoId: string
}

interface ObservacionActa {
  numero: number
  materia: string
  articulo: string
  severidad: 'crítica' | 'media' | 'menor'
  observacion: string
  fundamento: string
  comoSubsanar: string
}

interface ActaResult {
  expediente: string
  municipio: string
  riesgoGlobal: 'BAJO' | 'MEDIO' | 'ALTO'
  probabilidadAprobacion: number
  resumen: string
  observaciones: ObservacionActa[]
  veredicto: string
}

function buildActaPrompt(p: Proyecto): string {
  const stats = ESTADISTICAS_MUNICIPIOS.find((m) => m.nombre === p.municipio)
  const intel = getInteligenciaMunicipio(p.municipio)
  const ogucCtx = getContextoOGUC(
    'FOT FOS rasante distanciamiento altura pisos documentación observaciones recepción',
  )

  const statsSection = stats
    ? `## Estadísticas reales DOM ${p.municipio}
- Tasa histórica de observaciones: ${Math.round(stats.tasaObservaciones * 100)}%
- Observaciones frecuentes: ${stats.tiposObservacionFrequentes.join(', ')}
- Notas de la DOM: ${stats.notas}`
    : ''

  const intelSection = intel
    ? `## Inteligencia local DOM ${p.municipio}
${JSON.stringify(intel, null, 2)}`
    : ''

  return `Actúas como un revisor experimentado de la Dirección de Obras Municipales (DOM) de ${p.municipio}, Chile. Tu tarea es SIMULAR el acta de observaciones que emitiría la DOM al revisar este expediente, para que el arquitecto pueda subsanar ANTES de ingresar. Sé riguroso y realista, con el tono técnico y formal de un acta real. Normativa de referencia: OGUC D.S. N°47/1992 (modificaciones hasta D.S. N°2, D.O. 16.03.2026), LGUC y el Plan Regulador Comunal aplicable.

## Datos del expediente
- Proyecto: ${p.nombre}
- Dirección: ${p.direccion}, ${p.municipio}
- Tipo de trámite: ${p.tipo}
- Estado actual: ${p.estado}
- N° expediente: ${p.numero_expediente ?? 'sin asignar'}
- Superficie terreno: ${p.superficie_terreno_m2 ?? 'no disponible'} m²
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²
- Rol SII: ${p.rol_sii ?? 'no disponible'}
- Avalúo fiscal: ${p.avaluo_fiscal_clp ? `$${p.avaluo_fiscal_clp.toLocaleString('es-CL')}` : 'no disponible'}

${statsSection}

${intelSection}

## Artículos OGUC de referencia
${ogucCtx}

## Instrucción
Emite el acta simulada. Cuando un dato no esté disponible, redáctalo como una observación de tipo "verificar/acompañar antecedente" (así lo haría la DOM real), no lo inventes. Prioriza las observaciones más probables y de mayor impacto para este municipio.

Responde SOLO con JSON válido (sin markdown):
{
  "riesgoGlobal": "BAJO" | "MEDIO" | "ALTO",
  "probabilidadAprobacion": número entero 0-100 (probabilidad de aprobación en 1ª revisión SI NO se subsanan las observaciones),
  "resumen": "2-3 oraciones con el diagnóstico general, en tono de acta",
  "observaciones": [
    {
      "numero": 1,
      "materia": "materia breve (ej: Rasantes, Coeficiente FOT, Documentación)",
      "articulo": "Art. X.X.X OGUC / Ley 21.718 / PRC",
      "severidad": "crítica" | "media" | "menor",
      "observacion": "redacción formal de la observación, como la escribiría la DOM",
      "fundamento": "por qué se observa (norma y razón concreta)",
      "comoSubsanar": "acción concreta que debe realizar el arquitecto para levantar la observación"
    }
  ],
  "veredicto": "1-2 oraciones: qué pasa si el arquitecto subsana estas observaciones antes de ingresar"
}

Genera entre 4 y 8 observaciones ordenadas por severidad (crítica → menor).`
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json()) as PreRevisionRequest
  if (!body.proyectoId) {
    return Response.json({ error: 'proyectoId requerido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: proyecto, error: proyectoError } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', body.proyectoId)
    .single()

  if (proyectoError || !proyecto) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  const p = proyecto as Proyecto

  try {
    const text = await aiComplete([{ role: 'user', content: buildActaPrompt(p) }], {
      max_tokens: 2500,
    })

    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match
      ? (JSON.parse(match[0]) as Omit<ActaResult, 'expediente' | 'municipio'>)
      : {
          riesgoGlobal: 'MEDIO' as const,
          probabilidadAprobacion: 50,
          resumen: text,
          observaciones: [] as ObservacionActa[],
          veredicto: '',
        }

    const acta: ActaResult = {
      expediente: p.numero_expediente ?? p.nombre,
      municipio: p.municipio,
      riesgoGlobal: parsed.riesgoGlobal ?? 'MEDIO',
      probabilidadAprobacion:
        typeof parsed.probabilidadAprobacion === 'number' ? parsed.probabilidadAprobacion : 50,
      resumen: parsed.resumen ?? '',
      observaciones: parsed.observaciones ?? [],
      veredicto: parsed.veredicto ?? '',
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, ...acta })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
