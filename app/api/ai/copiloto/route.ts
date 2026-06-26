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
import { calcularDerechosMunicipales, type TipoObra } from '@/lib/derechos-municipales'
import { sumarDiasHabiles } from '@/lib/dias-habiles'
import type { Proyecto } from '@/types'

interface CopilotoRequest {
  proyectoId: string
}

function buildOgucPrompt(p: Proyecto): string {
  const ogucCtx = getContextoOGUC('FOT FOS rasante distanciamiento altura pisos')
  return `Eres un experto en normativa OGUC chilena. Analiza este proyecto y produce un diagnóstico normativo.

## Datos del proyecto
- Nombre: ${p.nombre}
- Dirección: ${p.direccion}, ${p.municipio}
- Tipo de trámite: ${p.tipo}
- Estado: ${p.estado}
- Superficie terreno: ${p.superficie_terreno_m2 ?? 'no disponible'} m²
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²
- Rol SII: ${p.rol_sii ?? 'no disponible'}
- Avalúo fiscal: ${p.avaluo_fiscal_clp ? `$${p.avaluo_fiscal_clp.toLocaleString('es-CL')}` : 'no disponible'}

## Artículos OGUC relevantes
${ogucCtx}

Responde SOLO con JSON válido (sin markdown):
{
  "articulos": [
    {
      "numero": "Art. X.X.X",
      "titulo": "nombre del artículo",
      "formula": "FOT = Superficie construida / Superficie terreno",
      "valor_normativo": "máximo 1.5 según zona",
      "valor_proyecto": "calculado o 'dato no disponible'",
      "cumple": true | false | null,
      "observacion": "texto breve si hay riesgo"
    }
  ],
  "resumen": "2-3 oraciones con diagnóstico general"
}`
}

function buildObservacionesPrompt(p: Proyecto): string {
  const stats = ESTADISTICAS_MUNICIPIOS.find(m => m.nombre === p.municipio)
  const intel = getInteligenciaMunicipio(p.municipio)

  const statsSection = stats
    ? `## Estadísticas DOM ${p.municipio}
- Tasa histórica de observaciones: ${Math.round(stats.tasaObservaciones * 100)}%
- Observaciones frecuentes: ${stats.tiposObservacionFrequentes.join(', ')}
- Meses más ágiles: ${stats.mesesMasAgiles.join(', ')}
- Notas: ${stats.notas}`
    : ''

  const intelSection = intel
    ? `## Inteligencia local DOM ${p.municipio}
${JSON.stringify(intel, null, 2)}`
    : ''

  return `Eres un experto en permisos de edificación chilenos. Predice las observaciones más probables de la DOM para este proyecto específico.

## Proyecto
- Nombre: ${p.nombre}
- Dirección: ${p.direccion}, ${p.municipio}
- Tipo: ${p.tipo}
- Expediente: ${p.numero_expediente ?? 'no asignado'}
- Superficie terreno: ${p.superficie_terreno_m2 ?? 'no disponible'} m²
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²

${statsSection}

${intelSection}

Responde SOLO con JSON válido:
{
  "riesgoGlobal": "BAJO" | "MEDIO" | "ALTO",
  "predicciones": [
    {
      "categoria": "nombre conciso (ej: Rasantes Art. 2.6.3)",
      "frecuencia": "alta" | "media" | "baja",
      "triggerEspecifico": "razón concreta por qué ESTE proyecto tiene este riesgo",
      "accionPreventiva": "qué hacer antes de ingresar"
    }
  ],
  "resumen": "2-3 oraciones"
}

Máximo 6 predicciones, ordenadas de mayor a menor probabilidad.`
}

function buildChecklistPrompt(p: Proyecto): string {
  return `Eres un experto en trámites de permisos municipales en Chile. Genera el checklist de documentos requeridos para este proyecto.

## Proyecto
- Tipo de trámite: ${p.tipo}
- Municipio: ${p.municipio}
- Dirección: ${p.direccion}
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²
- Expediente: ${p.numero_expediente ?? 'sin expediente'}

Responde SOLO con JSON válido:
{
  "items": [
    {
      "item_key": "snake_case_unique_key",
      "nombre": "Nombre del documento",
      "articulo_normativo": "Art. X.X.X OGUC o Ley XXXX",
      "descripcion": "qué debe contener o cómo obtenerlo",
      "obligatorio": true | false
    }
  ]
}

Genera entre 8 y 15 ítems específicos para el tipo "${p.tipo}" en ${p.municipio}. Usa item_key snake_case sin tildes, únicos y descriptivos (ej: "plano_arquitectura_firmado", "certificado_informaciones_previas").`
}

function buildEstimacionPrompt(p: Proyecto, derechosInfo: string): string {
  const stats = ESTADISTICAS_MUNICIPIOS.find(m => m.nombre === p.municipio)
  const plazoBase = stats?.tiempoPromedioHabiles ?? 45

  return `Eres un experto en plazos de tramitación DOM en Chile. Estima el plazo y derechos para este proyecto.

## Proyecto
- Municipio: ${p.municipio}
- Tipo: ${p.tipo}
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²
- Expediente: ${p.numero_expediente ?? 'sin expediente'}
- Plazo típico histórico DOM ${p.municipio}: ${plazoBase} días hábiles

## Derechos calculados
${derechosInfo}

Responde SOLO con JSON válido:
{
  "plazoMinDias": número de días hábiles (optimista),
  "plazoMaxDias": número de días hábiles (conservador),
  "factores": ["factor que puede acelerar o atrasar el plazo"],
  "recomendacion": "consejo concreto para acelerar la tramitación en ${p.municipio}"
}`
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  if (!isAIAvailable()) {
    return Response.json({ error: 'OpenAI no configurado' }, { status: 503 })
  }

  const body = await request.json() as CopilotoRequest

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

  const { data: existingChecklist } = await supabase
    .from('document_checklist_items')
    .select('*')
    .eq('proyecto_id', body.proyectoId)

  let ufValor = 38000
  try {
    const ufRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'}/api/utils/uf`)
    const ufData = await ufRes.json() as { valor?: number }
    if (ufData.valor) ufValor = ufData.valor
  } catch {
    // Use default 38000 if UF fetch fails
  }

  const TIPO_PERMISO_TO_OBRA: Record<string, string> = {
    'permiso_edificacion': 'obra_nueva',
    'obra_nueva': 'obra_nueva',
    'ampliacion': 'ampliacion',
    'anteproyecto': 'obra_nueva',
    'patente_comercial': 'obra_nueva',
    'desarchivo': 'obra_nueva',
  }
  const presupuesto = p.avaluo_fiscal_clp ?? (p.superficie_construida_m2 ? p.superficie_construida_m2 * 800_000 : 50_000_000)
  const tipoObra = (TIPO_PERMISO_TO_OBRA[p.tipo] ?? 'obra_nueva') as TipoObra
  const derechos = calcularDerechosMunicipales(
    presupuesto,
    tipoObra,
    p.superficie_construida_m2 ?? 100,
    false,
    p.municipio,
    ufValor,
  )
  const derechosInfo = [
    ...derechos.detalle,
    `En UF: ${(derechos.montoDerechos / ufValor).toFixed(2)} UF`,
    ...derechos.advertencias,
  ].join('\n')

  try {
    const hasExistingChecklist = (existingChecklist?.length ?? 0) > 0

    const [ogucText, observacionesText, checklistText, estimacionText] = await Promise.all([
      aiComplete([{ role: 'user', content: buildOgucPrompt(p) }], { max_tokens: 2000 }),
      aiComplete([{ role: 'user', content: buildObservacionesPrompt(p) }], { max_tokens: 1500 }),
      hasExistingChecklist
        ? Promise.resolve(null)
        : aiComplete([{ role: 'user', content: buildChecklistPrompt(p) }], { max_tokens: 2000 }),
      aiComplete([{ role: 'user', content: buildEstimacionPrompt(p, derechosInfo) }], { max_tokens: 800 }),
    ])

    const ogucMatch = ogucText.match(/\{[\s\S]*\}/)
    const oguc = ogucMatch ? JSON.parse(ogucMatch[0]) : { articulos: [], resumen: ogucText }

    const obsMatch = observacionesText.match(/\{[\s\S]*\}/)
    const observaciones = obsMatch ? JSON.parse(obsMatch[0]) : { riesgoGlobal: 'MEDIO', predicciones: [], resumen: observacionesText }

    let checklist: { items: Array<{ id?: string; item_key: string; nombre: string; articulo_normativo: string; descripcion: string; obligatorio: boolean; estado: string }> }

    if (hasExistingChecklist) {
      checklist = {
        items: (existingChecklist ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          item_key: row.item_key as string,
          nombre: row.nombre as string,
          articulo_normativo: row.articulo_normativo as string,
          descripcion: row.descripcion as string,
          obligatorio: row.obligatorio as boolean,
          estado: row.estado as string,
        })),
      }
    } else if (checklistText) {
      const checklistMatch = checklistText.match(/\{[\s\S]*\}/)
      const parsed = checklistMatch
        ? JSON.parse(checklistMatch[0]) as { items: Array<{ item_key: string; nombre: string; articulo_normativo: string; descripcion: string; obligatorio: boolean }> }
        : { items: [] }

      if (parsed.items.length > 0) {
        const rows = parsed.items.map((item) => ({
          proyecto_id: body.proyectoId,
          item_key: item.item_key,
          nombre: item.nombre,
          articulo_normativo: item.articulo_normativo,
          descripcion: item.descripcion,
          obligatorio: item.obligatorio,
          estado: 'pendiente' as const,
        }))
        await supabase.from('document_checklist_items').insert(rows)
      }

      checklist = {
        items: parsed.items.map((item) => ({ ...item, estado: 'pendiente' })),
      }
    } else {
      checklist = { items: [] }
    }

    const estMatch = estimacionText.match(/\{[\s\S]*\}/)
    const estimacionParsed = estMatch ? JSON.parse(estMatch[0]) : {}
    const plazoMinDias: number = estimacionParsed.plazoMinDias ?? 30
    const plazoMaxDias: number = estimacionParsed.plazoMaxDias ?? 90
    const hoy = new Date()
    const estimacion = {
      plazoMinDias,
      plazoMaxDias,
      fechaEstimadaMin: sumarDiasHabiles(hoy, plazoMinDias).toISOString().split('T')[0],
      fechaEstimadaMax: sumarDiasHabiles(hoy, plazoMaxDias).toISOString().split('T')[0],
      factores: estimacionParsed.factores ?? [],
      recomendacion: estimacionParsed.recomendacion ?? '',
      derechosCLP: derechos.montoDerechos,
      derechosUF: parseFloat((derechos.montoDerechos / ufValor).toFixed(2)),
      derechosDetalle: derechos.detalle,
      derechosAdvertencias: derechos.advertencias,
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, oguc, observaciones, checklist, estimacion })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
