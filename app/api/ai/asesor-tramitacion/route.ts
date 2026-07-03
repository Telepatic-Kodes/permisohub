export const dynamic = 'force-dynamic'
export const maxDuration = 90

import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { getContextoNormativo, flagUnverifiedDDU, REGLAS_CITACION } from '@/lib/normativa-retrieval'
import { createServiceClient } from '@/lib/supabase/service'
import type { DueDiligenceResult } from '@/lib/due-diligence'

// ---------------------------------------------------------------------------
// Asesor de tramitación — qué VÍA conviene, no solo qué dice la norma.
//
// Nace de la reunión 2026-07-02: la IA de la competencia "fuerza" el permiso
// de alteración (caro, lento) e ignora la restricción del cliente. Este asesor
// pondera costo/tiempo y evalúa explícitamente si una vía más liviana (ej. un
// 512 / patente / obra menor) es alcanzable, y CÓMO llegar a ella.
//
// Modo project-aware (opcional): si el body trae `proyectoId`, el asesor lee el
// expediente real del proyecto (Due Diligence + observaciones sobre los planos)
// y entrega el movimiento ESPECÍFICO del caso: qué elemento/dibujo concreto
// revertir o redibujar para caer bajo la vía liviana, no consejos genéricos.
// ---------------------------------------------------------------------------

interface AsesorRequest {
  situacion?: string
  objetivo?: string
  restricciones?: string
  municipio?: string
  proyectoId?: string
}

type Viabilidad = 'sí' | 'con condiciones' | 'no'
type CostoRelativo = 'bajo' | 'medio' | 'alto'

interface ViaTramitacion {
  nombre: string
  viable: Viabilidad
  tiempoEstimado: string
  costoRelativo: CostoRelativo
  requisitos: string[]
  pros: string[]
  contras: string[]
  fundamento: string
}

interface PasoEstrategia {
  orden: number
  accion: string
  porque: string
}

// Ajuste concreto al proyecto/dibujo para calificar a la vía liviana.
interface AjusteProyecto {
  elemento: string
  accion: string
  porque: string
}

interface AsesorResult {
  viaRecomendada: string
  vias: ViaTramitacion[]
  estrategia: string
  pasos: PasoEstrategia[]
  ajustesProyecto: AjusteProyecto[]
  riesgos: string[]
  ddu: { codigo: string; porque: string }[]
  advertencia: string
}

// ── Contexto de proyecto (modo project-aware) ───────────────────────────────

interface ProyectoRow {
  id: string
  user_id: string
  nombre: string
  municipio: string | null
  direccion: string | null
  tipo: string | null
}

// Forma laxa de cada anotación espacial guardada en planos_anotaciones.anotaciones.
interface PlanoAnotacionItem {
  textoCorto?: string
  observacion?: string
  articulo?: string
  severidad?: string
  tipoMarca?: string
}

interface ProyectoContexto {
  proyecto: ProyectoRow
  dd: DueDiligenceResult | null
  anotaciones: PlanoAnotacionItem[]
}

/** Arma el bloque de texto "Estado real del expediente" para inyectar al prompt. */
function buildContextoBloque(ctx: ProyectoContexto): string {
  const { proyecto, dd, anotaciones } = ctx
  const lines: string[] = []

  lines.push(
    `Proyecto: ${proyecto.nombre}${proyecto.direccion ? ` — ${proyecto.direccion}` : ''}${
      proyecto.municipio ? ` (${proyecto.municipio})` : ''
    }`,
  )
  if (proyecto.tipo) lines.push(`Tipo de trámite: ${proyecto.tipo}`)

  if (dd) {
    const e = dd.estadoDOM
    if (e?.rechazado) {
      lines.push(
        `Estado DOM: RECHAZADO${e.resolucion ? ` · Res. ${e.resolucion}` : ''}${
          e.fecha ? ` (${e.fecha})` : ''
        }${e.expediente ? ` · Expediente ${e.expediente}` : ''}.${e.detalle ? ` ${e.detalle}` : ''}`,
      )
    } else {
      lines.push('Estado DOM: sin rechazo registrado en el due diligence.')
    }
    if (dd.resumenEjecutivo) lines.push(`Resumen del due diligence: ${dd.resumenEjecutivo}`)
    if (dd.hallazgos.length) {
      lines.push('Hallazgos del due diligence:')
      for (const h of dd.hallazgos) {
        lines.push(
          `- [${h.codigo} · ${h.severidad}] ${h.titulo}: ${h.descripcion}${
            h.refDOM ? ` (ref. ${h.refDOM})` : ''
          }`,
        )
      }
    }
    if (dd.proximosPasos.length) {
      lines.push('Próximos pasos ya sugeridos por el due diligence:')
      for (const p of dd.proximosPasos) {
        lines.push(`- ${p.titulo}: ${p.detalle}`)
      }
    }
  } else {
    lines.push('Sin due diligence disponible para este proyecto.')
  }

  if (anotaciones.length) {
    lines.push('Observaciones marcadas sobre los planos (referencias espaciales reales):')
    for (const a of anotaciones) {
      const cuerpo = [a.textoCorto, a.observacion].filter(Boolean).join(' — ')
      lines.push(
        `- ${cuerpo || '(sin texto)'}${a.articulo ? ` [${a.articulo}]` : ''}${
          a.severidad ? ` (severidad ${a.severidad})` : ''
        }`,
      )
    }
  } else {
    lines.push('No hay observaciones marcadas sobre los planos.')
  }

  return lines.join('\n')
}

/** Deriva una `situacion` textual (>= 20 chars) cuando el usuario no la manda. */
function deriveSituacion(ctx: ProyectoContexto): string {
  const { proyecto, dd, anotaciones } = ctx
  const bits: string[] = []
  bits.push(
    `Expediente del proyecto "${proyecto.nombre}"${
      proyecto.municipio ? ` en ${proyecto.municipio}` : ''
    }.`,
  )
  if (dd?.estadoDOM?.rechazado) {
    bits.push(
      `Fue rechazado por la DOM${
        dd.estadoDOM.resolucion ? ` (Res. ${dd.estadoDOM.resolucion})` : ''
      }.`,
    )
  }
  if (dd?.resumenEjecutivo) {
    bits.push(dd.resumenEjecutivo)
  } else {
    const critico = dd?.hallazgos.find((h) => h.severidad === 'critico') ?? dd?.hallazgos[0]
    if (critico) bits.push(`Hallazgo principal: ${critico.titulo}. ${critico.descripcion}`)
  }
  if (anotaciones.length) {
    bits.push(`Hay ${anotaciones.length} observación(es) marcada(s) sobre los planos.`)
  }
  const s = bits.join(' ').trim()
  return s.length >= 20
    ? s
    : `${s} Se busca la vía de tramitación más liviana que resuelva el caso legalmente.`
}

function buildPrompt(req: AsesorRequest, contextoBloque: string | null): string {
  const situacion = (req.situacion ?? '').trim()
  const normativaCtx = getContextoNormativo(
    `${situacion} ${req.objetivo ?? ''} obras menores alteración cambio de destino uso regularización patente 5.1.2 5.2.5 permiso edificación recepción`,
  )

  const muni = req.municipio?.trim() ? ` en ${req.municipio.trim()}` : ''
  const objetivoDefault = contextoBloque
    ? '## Objetivo del cliente\nLlegar a la vía de tramitación más liviana posible (ej. obra menor Art. 5.1.2 / regularización / cambio de destino) y evitar el permiso de alteración, respetando la ley.'
    : '## Objetivo del cliente\nNo declarado explícitamente: infiere el resultado buscado a partir de la situación.'
  const objetivo = req.objetivo?.trim()
    ? `## Objetivo del cliente\n${req.objetivo.trim()}`
    : objetivoDefault
  const restr = req.restricciones?.trim()
    ? `## Restricciones (críticas — respétalas)\n${req.restricciones.trim()}`
    : '## Restricciones\nNo declaradas. Asume las típicas: minimizar costo, tiempo y cantidad de especialistas.'

  const estadoExpediente = contextoBloque
    ? `## Estado real del expediente
Usa estos datos concretos del proyecto (due diligence + observaciones marcadas sobre los planos). NO son genéricos: son el caso real.
${contextoBloque}

`
    : ''

  const instruccionEspecifica = contextoBloque
    ? `

MODO PROYECTO (prescriptivo y específico — no genérico): dado el estado real del expediente de arriba, tu recomendación DEBE:
- Indicar explícitamente QUÉ modificación/elemento concreto revertir o redibujar para que el caso caiga bajo la vía liviana (ej. bajo el Art. 5.1.2), citando las OBSERVACIONES ESPACIALES reales de los planos (por su textoCorto/observación/artículo). No digas "regulariza bajo 5.1.2" sin decir qué cambiar.
- Rellenar "ajustesProyecto" con la lista concreta de ajustes al proyecto/dibujo (elemento, acción de revertir/redibujar, y por qué eso lo hace calificar a la vía liviana). Si de verdad no hay ajuste que permita bajar de vía, deja "ajustesProyecto" vacío y explícalo en la estrategia.
- Indicar qué ARGUMENTO NORMATIVO usar (DDU pertinentes por su materia, sin inventar números), p. ej. carga desproporcionada u otros, solo si aplican al caso.`
    : '\nSi no hay contexto de proyecto, "ajustesProyecto" puede ir vacío.'

  return `Actúas como un arquitecto chileno experto en normativa y tramitación municipal (DOM), del lado del mandante${muni}. Tu trabajo NO es solo decir qué dice la norma: es recomendar la VÍA de tramitación que resuelve el caso con el MENOR costo y tiempo posibles, respetando la ley.

Contexto importante: muchas herramientas fuerzan el permiso de alteración (caro, lento, exige especialistas: cálculo, sanitario, constructor) sin considerar que el cliente quiere una vía más liviana. Tú SIEMPRE evalúas primero si una vía menor es alcanzable (p. ej. regularización, obra menor Art. 5.1.2, cambio de destino, patente/512) y, si lo es, explicas CÓMO llegar a ella. Solo escalas a alteración o permiso de edificación cuando de verdad no hay alternativa, y lo justificas.

${estadoExpediente}## Situación
${situacion}

${objetivo}

${restr}

## Contexto normativo (OGUC · LGUC · DDU)
${normativaCtx}

${REGLAS_CITACION}

## Instrucción
Compara las vías de tramitación realmente aplicables a este caso, de la más liviana a la más pesada. Para cada una: viabilidad real, tiempo estimado, costo relativo, requisitos, pros y contras, y fundamento normativo. Recomienda la vía que mejor equilibra legalidad + costo + tiempo dado el objetivo y las restricciones. Da pasos concretos y accionables. Si la vía liviana exige un ajuste de proyecto (ej. redibujar un alero, revertir una modificación de fachada), dilo explícitamente como paso Y en "ajustesProyecto".${instruccionEspecifica}

Responde SOLO con JSON válido (sin markdown):
{
  "viaRecomendada": "nombre de la vía recomendada",
  "vias": [
    {
      "nombre": "ej: Regularización Ley 20.898 / Obra menor Art. 5.1.2 / Cambio de destino / Permiso de alteración",
      "viable": "sí" | "con condiciones" | "no",
      "tiempoEstimado": "ej: 30-60 días",
      "costoRelativo": "bajo" | "medio" | "alto",
      "requisitos": ["..."],
      "pros": ["..."],
      "contras": ["..."],
      "fundamento": "norma y razón"
    }
  ],
  "estrategia": "2-4 oraciones: la jugada recomendada y por qué, considerando costo/tiempo/objetivo",
  "pasos": [ { "orden": 1, "accion": "acción concreta", "porque": "para qué sirve" } ],
  "ajustesProyecto": [ { "elemento": "elemento o plano concreto a intervenir", "accion": "qué revertir o redibujar", "porque": "por qué eso hace calificar el caso a la vía liviana" } ],
  "riesgos": ["riesgos o supuestos que hay que verificar"],
  "ddu": [ { "codigo": "DDU — <materia/título de la circular, SIN número inventado>", "porque": "qué resuelve en este caso" } ],
  "advertencia": "1 oración: qué verificar con la DOM antes de comprometerse"
}

Ordena "vias" de la más liviana (menor costo/tiempo) a la más pesada. Incluye 2 a 4 vías.`
}

function isAjuste(v: unknown): v is AjusteProyecto {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.elemento === 'string' ||
    typeof o.accion === 'string' ||
    typeof o.porque === 'string'
  )
}

function parse(text: string): AsesorResult {
  const match = text.match(/\{[\s\S]*\}/)
  const fallback: AsesorResult = {
    viaRecomendada: '',
    vias: [],
    estrategia: text.slice(0, 800),
    pasos: [],
    ajustesProyecto: [],
    riesgos: [],
    ddu: [],
    advertencia: '',
  }
  if (!match) return fallback
  try {
    const raw = JSON.parse(match[0]) as Partial<AsesorResult>
    return {
      viaRecomendada: typeof raw.viaRecomendada === 'string' ? raw.viaRecomendada : '',
      vias: Array.isArray(raw.vias) ? raw.vias : [],
      estrategia: typeof raw.estrategia === 'string' ? raw.estrategia : '',
      pasos: Array.isArray(raw.pasos) ? raw.pasos : [],
      ajustesProyecto: Array.isArray(raw.ajustesProyecto)
        ? raw.ajustesProyecto.filter(isAjuste).map((a) => ({
            elemento: typeof a.elemento === 'string' ? a.elemento : '',
            accion: typeof a.accion === 'string' ? a.accion : '',
            porque: typeof a.porque === 'string' ? a.porque : '',
          }))
        : [],
      riesgos: Array.isArray(raw.riesgos) ? raw.riesgos : [],
      ddu: Array.isArray(raw.ddu) ? raw.ddu : [],
      advertencia: typeof raw.advertencia === 'string' ? raw.advertencia : '',
    }
  } catch {
    return fallback
  }
}

/** Carga el expediente real del proyecto. Devuelve el contexto o un Response de error. */
async function loadProyectoContexto(
  proyectoId: string,
  userId: string,
): Promise<ProyectoContexto | Response> {
  const supabase = createServiceClient()

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, user_id, nombre, municipio, direccion, tipo')
    .eq('id', proyectoId)
    .maybeSingle<ProyectoRow>()

  if (!proyecto || proyecto.user_id !== userId) {
    return Response.json({ error: 'Proyecto no encontrado o sin acceso' }, { status: 403 })
  }

  const { data: ddRow } = await supabase
    .from('due_diligence_reports')
    .select('result')
    .eq('proyecto_id', proyectoId)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ result: DueDiligenceResult | null }>()

  const { data: anotRows } = await supabase
    .from('planos_anotaciones')
    .select('anotaciones')
    .eq('proyecto_id', proyectoId)

  const anotaciones: PlanoAnotacionItem[] = []
  for (const row of anotRows ?? []) {
    const arr = (row as { anotaciones?: unknown }).anotaciones
    if (Array.isArray(arr)) {
      for (const a of arr) {
        if (a && typeof a === 'object') anotaciones.push(a as PlanoAnotacionItem)
      }
    }
  }

  return { proyecto, dd: ddRow?.result ?? null, anotaciones }
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json()) as AsesorRequest

  // Modo project-aware: carga el expediente real y deriva la situación si falta.
  let contextoBloque: string | null = null
  if (body.proyectoId) {
    const ctx = await loadProyectoContexto(body.proyectoId, auth.userId)
    if (ctx instanceof Response) return ctx
    contextoBloque = buildContextoBloque(ctx)
    if (!body.situacion || body.situacion.trim().length < 20) {
      body.situacion = deriveSituacion(ctx)
    }
    if (!body.municipio && ctx.proyecto.municipio) {
      body.municipio = ctx.proyecto.municipio
    }
  }

  if (!body.situacion || body.situacion.trim().length < 20) {
    return Response.json(
      { error: 'Describe la situación con al menos un par de frases' },
      { status: 400 },
    )
  }

  try {
    const text = await aiComplete([{ role: 'user', content: buildPrompt(body, contextoBloque) }], {
      max_tokens: 3200,
    })
    const result = parse(text)
    // Defensa en profundidad: marca cualquier número de DDU no verificado.
    result.ddu = result.ddu.map((d) => ({ ...d, codigo: flagUnverifiedDDU(d.codigo) }))
    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
