export const dynamic = 'force-dynamic'
export const maxDuration = 90

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { getContextoLGUC } from '@/lib/lguc-knowledge'
import { ESTADISTICAS_MUNICIPIOS } from '@/lib/municipios-stats'
import { getInteligenciaMunicipio } from '@/lib/inteligencia-dom'
import { calcularDerechosMunicipales, type TipoObra } from '@/lib/derechos-municipales'
import { sumarDiasHabiles } from '@/lib/dias-habiles'
import { fixMojibakeArcGIS } from '@/lib/zonificacion-format'
import { UF_FALLBACK_CLP } from '@/lib/uf'
import { flagUnverifiedCita } from '@/lib/normativa-retrieval'
import { parseAiJson } from '@/lib/ai-parse'
import type { Proyecto } from '@/types'

interface CopilotoRequest {
  proyectoId: string
  // Acción explícita del arquitecto (nunca automática/silenciosa, mismo
  // patrón que "Actualizar" en zonificación ZONE-04): descarta el checklist
  // de IA persistido y genera uno nuevo, preservando por item_key el estado
  // 'ok' de los ítems que sobrevivan al nuevo checklist.
  regenerarChecklist?: boolean
}

// M5 (auditoría 2026-07-30): schemas laxos para los 4 parses de este endpoint
// (antes: regex + JSON.parse sin validación, tipado implícito `any`). Solo se
// garantiza forma estructural; los valores de enum no se restringen a un set
// cerrado para que un drift menor del modelo no tumbe el parseo completo.
const OgucArticuloSchema = z
  .object({
    numero: z.string().default(''),
    titulo: z.string().default(''),
    formula: z.string().default(''),
    valor_normativo: z.string().default(''),
    valor_proyecto: z.string().default(''),
    cumple: z.boolean().nullable().default(null),
    observacion: z.string().default(''),
  })
  .passthrough()

const OgucSchema = z
  .object({
    articulos: z.array(OgucArticuloSchema).default([]),
    resumen: z.string().default(''),
  })
  .passthrough()

const ObsPrediccionSchema = z
  .object({
    categoria: z.string().default(''),
    frecuencia: z.string().default(''),
    triggerEspecifico: z.string().default(''),
    accionPreventiva: z.string().default(''),
  })
  .passthrough()

const ObservacionesSchema = z
  .object({
    riesgoGlobal: z.string().default('MEDIO'),
    predicciones: z.array(ObsPrediccionSchema).default([]),
    resumen: z.string().default(''),
  })
  .passthrough()

const ChecklistItemSchema = z
  .object({
    item_key: z.string().default(''),
    nombre: z.string().default(''),
    articulo_normativo: z.string().default(''),
    descripcion: z.string().default(''),
    // Un item sin `obligatorio` en la respuesta del modelo (parseo parcial,
    // campo omitido) NO es lo mismo que "no obligatorio" — pero
    // `.default(false)` los volvía indistinguibles y el item se guardaba
    // como opcional en document_checklist_items sin que nadie lo notara. Ante
    // un dato faltante en un checklist de cumplimiento, el sesgo seguro es
    // tratarlo como obligatorio (el arquitecto lo revisa de más, no de menos).
    obligatorio: z.boolean().default(true),
  })
  .passthrough()

const ChecklistSchema = z
  .object({
    items: z.array(ChecklistItemSchema).default([]),
  })
  .passthrough()

const EstimacionSchema = z
  .object({
    plazoMinDias: z.number().optional(),
    plazoMaxDias: z.number().optional(),
    factores: z.array(z.string()).default([]),
    recomendacion: z.string().default(''),
  })
  .passthrough()

function seccionZonificacion(p: Proyecto): string {
  const utilizable = p.zona_status === 'encontrado' && p.zona_usos_disponibles === true
  if (!utilizable) return ''
  const uperm = fixMojibakeArcGIS(p.zona_uperm) ?? '(sin dato)'
  const uproh = fixMojibakeArcGIS(p.zona_uproh) ?? '(sin dato)'
  const nombre = fixMojibakeArcGIS(p.zona_nombre)
  return `\n## Zonificación (PRC) — ${p.zona_codigo ?? ''}${nombre ? ` ${nombre}` : ''}\nUsos permitidos: ${uperm}\nUsos prohibidos: ${uproh}\n`
}

function buildOgucPrompt(p: Proyecto): string {
  const ogucCtx = getContextoOGUC('FOT FOS rasante distanciamiento altura pisos')
  // La LGUC (DFL 458) es la LEY; la OGUC (D.S. 47) es su reglamento. El
  // copiloto conocía solo el reglamento: lib/lguc-knowledge.ts existía desde
  // hacía meses, con el mismo interface que OGUC "para reutilizar la
  // recuperación por keywords", y sin un solo caller — lo detectó
  // check:orphans (05-08). La consulta apunta a lo procedimental/legal
  // (permisos, recepciones, responsabilidad), que es lo que la LGUC cubre y
  // la OGUC no; consultarla con "FOT rasante" no habría traído nada útil.
  const lgucCtx = getContextoLGUC('permiso de edificación recepción definitiva responsabilidad profesional sanciones')
  return `Eres un experto en normativa urbanística chilena. Analiza este proyecto y produce un diagnóstico normativo.

## Datos del proyecto
- Nombre: ${p.nombre}
- Dirección: ${p.direccion}, ${p.municipio}
- Tipo de trámite: ${p.tipo}
- Estado: ${p.estado}
- Superficie terreno: ${p.superficie_terreno_m2 ?? 'no disponible'} m²
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²
- Rol SII: ${p.rol_sii ?? 'no disponible'}
- Avalúo fiscal: ${p.avaluo_fiscal_clp ? `$${p.avaluo_fiscal_clp.toLocaleString('es-CL')}` : 'no disponible'}
${seccionZonificacion(p)}
## Artículos OGUC relevantes (D.S. N°47/1992 — reglamento)
${ogucCtx}
${lgucCtx ? `
## Artículos LGUC relevantes (DFL N°458/1975 — ley)
${lgucCtx}

IMPORTANTE sobre los textos LGUC de arriba: son RESÚMENES técnicos, NO
transcripciones literales del DFL 458. Nunca los presentes como texto legal
textual ni los pongas entre comillas como si fueran la letra de la ley. Si un
número, plazo o texto exacto tiene peso legal, indicá que debe verificarse
contra el texto oficial.
` : ''}
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

  // A6 (auditoría 2026-07-30): estas estadísticas son sintéticas (ver
  // lib/municipios-stats.ts), no mediciones de expedientes reales. Se
  // etiquetan como referencia estimada para que el modelo no las trate
  // como hechos verificados.
  const statsSection = stats
    ? `## Estadísticas DOM ${p.municipio} — Referencia histórica ESTIMADA (datos sintéticos, no medidos)
Trata estos valores como un prior aproximado y cualitativo, NO como una medición verificada de expedientes reales.
- Tasa histórica de observaciones (estimada): ${Math.round(stats.tasaObservaciones * 100)}%
- Observaciones frecuentes (estimadas): ${stats.tiposObservacionFrequentes.join(', ')}
- Meses más ágiles (estimados): ${stats.mesesMasAgiles.join(', ')}
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
${seccionZonificacion(p)}
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

function buildEstimacionPrompt(p: Proyecto, derechosInfo: string, plazoBase: number): string {
  // A6 (auditoría 2026-07-30): plazoBase viene de ESTADISTICAS_MUNICIPIOS,
  // que es sintético (ver lib/municipios-stats.ts). Se etiqueta como
  // referencia estimada, no como una medición, y el servidor además
  // aplica un clamp numérico sobre plazoMinDias/plazoMaxDias basado en
  // este mismo valor — ver el clamp tras el parseo del JSON en POST().
  return `Eres un experto en plazos de tramitación DOM en Chile. Estima el plazo y derechos para este proyecto.

## Proyecto
- Municipio: ${p.municipio}
- Tipo: ${p.tipo}
- Superficie construida: ${p.superficie_construida_m2 ?? 'no disponible'} m²
- Expediente: ${p.numero_expediente ?? 'sin expediente'}

## Plazo histórico
Referencia histórica ESTIMADA (dato sintético, no medido): plazo típico DOM ${p.municipio} ≈ ${plazoBase} días hábiles.
Trátalo como un prior aproximado, no como una medición verificada. Tu rango plazoMinDias/plazoMaxDias debe mantenerse razonablemente cercano a este valor (no un orden de magnitud distinto) — el servidor aplicará además un límite numérico automático basado en él.

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

  const regenerarChecklist = body.regenerarChecklist === true

  // Backlog (deuda técnica de PROJECT.md): el checklist se generaba una sola
  // vez y nunca reflejaba una zonificación que llegara después (es async,
  // vía after() en lib/zonificacion-server.ts). Se detecta comparando cuándo
  // se creó el checklist existente contra zona_consultada_el — pero nunca se
  // regenera solo; el arquitecto decide vía el botón "Regenerar checklist".
  const zonificacionUtilizable = p.zona_status === 'encontrado' && p.zona_usos_disponibles === true
  const checklistCreatedAtMs = existingChecklist && existingChecklist.length > 0
    ? Math.min(...existingChecklist.map((row) => new Date(row.created_at as string).getTime()))
    : null
  const checklistDesactualizadoPorZonificacion = Boolean(
    !regenerarChecklist &&
      checklistCreatedAtMs !== null &&
      zonificacionUtilizable &&
      p.zona_consultada_el &&
      new Date(p.zona_consultada_el).getTime() > checklistCreatedAtMs,
  )

  // Al regenerar, el único progreso real del arquitecto es `estado='ok'` —
  // se preserva por item_key en los ítems del nuevo checklist que coincidan;
  // solo se borran los ítems de origen 'ai' (los 'manual' quedan intactos,
  // aunque hoy no exista ninguna vía de UI que los cree).
  const previousOkItemKeys = new Set(
    (existingChecklist ?? [])
      .filter((row) => row.source === 'ai' && row.estado === 'ok')
      .map((row) => row.item_key as string),
  )
  if (regenerarChecklist && existingChecklist && existingChecklist.length > 0) {
    await supabase
      .from('document_checklist_items')
      .delete()
      .eq('proyecto_id', body.proyectoId)
      .eq('source', 'ai')
  }

  let ufValor = UF_FALLBACK_CLP
  // A4 (auditoría 2026-07-30): la calculadora ya mostraba "UF referencial" en
  // fallback, pero el copiloto callaba el flag — se propaga en `estimacion`
  // para que TabEstimacion pueda mostrar el mismo aviso.
  let ufFallback = true
  try {
    // Sin timeout, un self-request colgado se comía el maxDuration completo
    // de esta ruta (90s) antes de caer al fallback — mismo fix ya aplicado en
    // lib/scrapers/terrenos-common.ts:obtenerValorUF() para el mismo self-fetch.
    const ufRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/utils/uf`, {
      signal: AbortSignal.timeout(12_000),
    })
    const ufData = await ufRes.json() as { valor?: number; fallback?: boolean }
    if (ufData.valor) {
      ufValor = ufData.valor
      ufFallback = ufData.fallback ?? false
    }
  } catch {
    // Use UF_FALLBACK_CLP if UF fetch fails; ufFallback stays true
  }

  const TIPO_PERMISO_TO_OBRA: Record<string, string> = {
    'permiso_edificacion': 'obra_nueva',
    'obra_nueva': 'obra_nueva',
    'ampliacion': 'ampliacion',
    'anteproyecto': 'obra_nueva',
    'patente_comercial': 'obra_nueva',
    'desarchivo': 'obra_nueva',
  }
  // Sin avalúo fiscal real, el presupuesto que alimenta el cálculo de
  // derechos es una PURA suposición (800.000 CLP/m² sin fuente citada, o un
  // monto plano de 50M si ni siquiera hay superficie) — el monto resultante
  // se ve tan específico como uno real ($XXX.XXX) y sin este flag el
  // arquitecto no tiene forma de saber que el insumo fue inventado.
  const presupuestoEsReal = typeof p.avaluo_fiscal_clp === 'number' && p.avaluo_fiscal_clp > 0
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
  if (!presupuestoEsReal) {
    derechos.advertencias.push(
      p.superficie_construida_m2
        ? `Sin avalúo fiscal registrado: el presupuesto de obra se estimó en $800.000/m² × ${p.superficie_construida_m2} m² (valor referencial, no informado por el proyecto) — el monto de derechos es una aproximación.`
        : 'Sin avalúo fiscal ni superficie construida registrados: el presupuesto de obra se asumió en $50.000.000 (valor genérico) — el monto de derechos es solo referencial hasta que se cargue un dato real.'
    )
  }
  const derechosInfo = [
    ...derechos.detalle,
    `En UF: ${(derechos.montoDerechos / ufValor).toFixed(2)} UF`,
    ...derechos.advertencias,
  ].join('\n')

  // A6 (auditoría 2026-07-30): plazoBase (sintético) se calcula una sola vez
  // aquí para que el prompt y el clamp del resultado usen el mismo valor.
  const statsMunicipio = ESTADISTICAS_MUNICIPIOS.find(m => m.nombre === p.municipio)
  const plazoBase = statsMunicipio?.tiempoPromedioHabiles ?? 45

  try {
    const hasExistingChecklist = (existingChecklist?.length ?? 0) > 0 && !regenerarChecklist

    const [ogucText, observacionesText, checklistText, estimacionText] = await Promise.all([
      aiComplete([{ role: 'user', content: buildOgucPrompt(p) }], { max_tokens: 2000 }),
      aiComplete([{ role: 'user', content: buildObservacionesPrompt(p) }], { max_tokens: 1500 }),
      hasExistingChecklist
        ? Promise.resolve(null)
        : aiComplete([{ role: 'user', content: buildChecklistPrompt(p) }], { max_tokens: 2000 }),
      aiComplete([{ role: 'user', content: buildEstimacionPrompt(p, derechosInfo, plazoBase) }], { max_tokens: 800 }),
    ])

    // M5: parseo validado con zod (antes: regex + JSON.parse sin validación).
    const ogucParsed = parseAiJson(ogucText, OgucSchema, 'copiloto:oguc') ?? {
      articulos: [],
      resumen: ogucText,
    }
    // A2 (auditoría 2026-07-30): el modelo puede inventar un número de
    // artículo en el diagnóstico OGUC. Cada `numero` pasa por el guard
    // anti-citas-inventadas antes de salir al cliente.
    const oguc = {
      ...ogucParsed,
      articulos: ogucParsed.articulos.map((a) => ({ ...a, numero: flagUnverifiedCita(a.numero) })),
    }

    // Este endpoint combina 4 secciones en una sola respuesta — fallar toda
    // la request porque SOLO "observaciones" no parseó descartaría oguc/
    // checklist/estimacion que sí llegaron bien. Pero el fallback anterior
    // ("MEDIO" + 0 predicciones) es indistinguible de un diagnóstico real sin
    // riesgos — como no hay un estado "desconocido" en el badge de riesgo
    // (BAJO/MEDIO/ALTO), se degrada a ALTO con un resumen explícito: mejor
    // que el arquitecto revise de más a que confíe en un "va bien" fabricado.
    const observaciones = parseAiJson(observacionesText, ObservacionesSchema, 'copiloto:observaciones') ?? {
      riesgoGlobal: 'ALTO',
      predicciones: [],
      resumen: 'No se pudo generar el diagnóstico de observaciones — la respuesta de la IA no tuvo el formato esperado. Vuelve a intentar o revisa manualmente.',
    }

    let checklist: {
      items: Array<{ id?: string; item_key: string; nombre: string; articulo_normativo: string; descripcion: string; obligatorio: boolean; estado: string }>
      desactualizadoPorZonificacion: boolean
    }

    if (hasExistingChecklist) {
      // Los nombres de columna reales son label/articulo_oguc (no
      // nombre/articulo_normativo) — ver migración 20260813 y la nota de
      // deuda técnica en PROJECT.md: el mapeo anterior leía campos
      // inexistentes y devolvía siempre undefined.
      checklist = {
        items: (existingChecklist ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          item_key: row.item_key as string,
          nombre: row.label as string,
          articulo_normativo: (row.articulo_oguc as string) ?? '',
          descripcion: (row.descripcion as string) ?? '',
          obligatorio: (row.obligatorio as boolean) ?? true,
          estado: row.estado as string,
        })),
        desactualizadoPorZonificacion: checklistDesactualizadoPorZonificacion,
      }
    } else if (checklistText) {
      // M5: parseo validado con zod (antes: regex + JSON.parse + cast `as`).
      const parsed = parseAiJson(checklistText, ChecklistSchema, 'copiloto:checklist') ?? { items: [] }

      // item_key/nombre en blanco (defaults de zod ante un campo omitido) no
      // describen ningún documento real — se omiten tanto del insert como
      // de la respuesta (antes solo se omitían del insert, así que igual
      // aparecían como filas vacías en el checklist mostrado).
      const itemsValidos = parsed.items.filter((item) => item.item_key.trim() && item.nombre.trim())

      let insertedRows: Array<Record<string, unknown>> = []
      if (itemsValidos.length > 0) {
        const rows = itemsValidos.map((item) => ({
          proyecto_id: body.proyectoId,
          item_key: item.item_key,
          label: item.nombre,
          articulo_oguc: item.articulo_normativo,
          descripcion: item.descripcion,
          obligatorio: item.obligatorio,
          // Al regenerar, un item cuyo item_key ya estaba marcado 'ok' en el
          // checklist anterior conserva ese progreso — nunca se pierde
          // silenciosamente por el solo hecho de regenerar.
          estado: previousOkItemKeys.has(item.item_key) ? ('ok' as const) : ('pendiente' as const),
          source: 'ai' as const,
        }))
        const { data: inserted, error: insertError } = await supabase
          .from('document_checklist_items')
          .insert(rows)
          .select()
        if (insertError) {
          // La persistencia es auxiliar frente al checklist en sí — no se
          // falla toda la request por esto, pero ya no se descarta en
          // silencio (así quedó sin detectarse hasta ahora: 0 filas en
          // prod, ver migración 20260813).
          console.error('copiloto: fallo al persistir checklist', insertError)
        } else {
          insertedRows = inserted ?? []
        }
      }

      const idByItemKey = new Map(insertedRows.map((row) => [row.item_key as string, row.id as string]))
      checklist = {
        items: itemsValidos.map((item) => ({
          id: idByItemKey.get(item.item_key),
          item_key: item.item_key,
          nombre: item.nombre,
          articulo_normativo: item.articulo_normativo,
          descripcion: item.descripcion,
          obligatorio: item.obligatorio,
          estado: previousOkItemKeys.has(item.item_key) ? 'ok' : 'pendiente',
        })),
        desactualizadoPorZonificacion: false,
      }
    } else {
      checklist = { items: [], desactualizadoPorZonificacion: false }
    }

    // M5: parseo validado con zod (antes: regex + JSON.parse sin validación).
    // No se toca la lógica de clamp/derechos que sigue abajo — solo el parseo.
    const estimacionParsed: Partial<z.infer<typeof EstimacionSchema>> =
      parseAiJson(estimacionText, EstimacionSchema, 'copiloto:estimacion') ?? {}

    // A6 (auditoría 2026-07-30): plazoBase es sintético (ver
    // lib/municipios-stats.ts), así que el rango que devuelve la IA se
    // acota a una banda razonable alrededor de él en vez de confiar en el
    // número crudo del modelo. Los fallbacks ante fallo de parseo también
    // se derivan de plazoBase en lugar de constantes arbitrarias (30/90).
    const plazoFloor = Math.max(5, Math.round(plazoBase * 0.4))
    const plazoCeil = Math.round(plazoBase * 2.5)
    const plazoMinRaw: number = estimacionParsed.plazoMinDias ?? Math.round(plazoBase * 0.8)
    const plazoMaxRaw: number = estimacionParsed.plazoMaxDias ?? Math.round(plazoBase * 1.5)

    let plazoMinDias = Math.min(Math.max(plazoMinRaw, plazoFloor), plazoCeil)
    let plazoMaxDias = Math.min(Math.max(plazoMaxRaw, plazoFloor), plazoCeil)
    if (plazoMinDias > plazoMaxDias) {
      const tmp = plazoMinDias
      plazoMinDias = plazoMaxDias
      plazoMaxDias = tmp
    }

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
      ufFallback,
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, oguc, observaciones, checklist, estimacion })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
