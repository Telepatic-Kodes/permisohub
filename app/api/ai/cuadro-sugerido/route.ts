export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import type { DueDiligenceResult } from '@/lib/due-diligence'
import { cuadroVacio, type CuadroInput, type NivelSuperficie } from '@/lib/cuadros-calculo'

// ---------------------------------------------------------------------------
// Sugerencia de valores para el Cuadro de cálculo — el LLM SOLO EXTRAE, no
// calcula. Lee el expediente (due diligence) del proyecto y propone superficies
// candidatas (predio + niveles) que aparezcan EXPLÍCITAS en los documentos.
// Los coeficientes/porcentajes y el veredicto los hace calcularCuadro() (motor
// determinista), nunca el modelo; y los límites del PRC los ingresa el
// arquitecto. Lo sugerido es referencial: el usuario lo edita/confirma.
// ---------------------------------------------------------------------------

interface CuadroSugeridoRequest {
  proyectoId?: string
}

interface ProyectoRow {
  id: string
  user_id: string
  nombre: string
}

/** Recorta a número ≥ 0; cualquier otra cosa → 0. */
function clampNonNeg(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function buildPrompt(dd: DueDiligenceResult): string {
  const contexto = JSON.stringify(
    {
      proyecto: dd.proyecto,
      resumenEjecutivo: dd.resumenEjecutivo,
      inventario: dd.inventario?.map((i) => ({ documento: i.documento, observacion: i.observacion })),
      hallazgos: dd.hallazgos?.map((h) => ({ titulo: h.titulo, descripcion: h.descripcion })),
      historial: dd.historial?.map((h) => ({ titulo: h.titulo, detalle: h.detalle, m2: h.m2 })),
    },
    null,
    2,
  )

  return `Eres un asistente que EXTRAE superficies de un expediente de edificación chileno. Tu ÚNICA tarea es transcribir números de metros cuadrados que aparezcan EXPLÍCITAMENTE en el expediente. NO calcules coeficientes, NO calcules porcentajes de ocupación, NO sumes ni derives valores: solo copia lo que esté escrito.

Reglas estrictas:
- Extrae solo números en m² que aparezcan explícitamente en el expediente.
- Si un dato no aparece, déjalo en 0 (o omite el nivel).
- superficiePredio: la superficie del TERRENO/PREDIO en m².
- niveles: un objeto por piso/nivel/ampliación con su superficie edificada. Si el documento indica la superficie que ese nivel ocupa en el suelo (proyección/planta baja), ponla en ocupadaSuelo; si no, omite ocupadaSuelo.
- NO inventes niveles que no estén respaldados por el expediente.

## Expediente (due diligence del proyecto)
${contexto}

Responde SOLO con JSON válido (sin markdown), con esta forma EXACTA:
{
  "superficiePredio": number,
  "niveles": [ { "nombre": "ej: Piso 1", "edificada": number, "ocupadaSuelo": number } ]
}`
}

function parseSugerido(text: string): CuadroInput {
  const base = cuadroVacio()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return base

  try {
    const raw = JSON.parse(match[0]) as {
      superficiePredio?: unknown
      niveles?: unknown
    }

    const nivelesRaw = Array.isArray(raw.niveles) ? raw.niveles : []
    const niveles: NivelSuperficie[] = nivelesRaw
      .filter((n): n is Record<string, unknown> => typeof n === 'object' && n !== null)
      .map((n, idx) => {
        const nivel: NivelSuperficie = {
          nombre: typeof n.nombre === 'string' && n.nombre.trim() ? n.nombre.trim() : `Nivel ${idx + 1}`,
          edificada: clampNonNeg(n.edificada),
        }
        const ocupada = clampNonNeg(n.ocupadaSuelo)
        if (ocupada > 0) nivel.ocupadaSuelo = ocupada
        return nivel
      })

    return {
      superficiePredio: clampNonNeg(raw.superficiePredio),
      // Los límites del PRC los pone el arquitecto — nunca el modelo.
      niveles: niveles.length > 0 ? niveles : base.niveles,
      coefConstructibilidadMax: undefined,
      ocupacionSueloMaxPct: undefined,
      alturaMaxM: undefined,
      alturaProyectoM: undefined,
    }
  } catch {
    return base
  }
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json()) as CuadroSugeridoRequest
  if (!body.proyectoId) {
    return Response.json({ error: 'Falta proyectoId' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select('id, user_id, nombre')
    .eq('id', body.proyectoId)
    .maybeSingle<ProyectoRow>()

  if (!proyecto || proyecto.user_id !== auth.userId) {
    return Response.json({ error: 'Proyecto no encontrado o sin acceso' }, { status: 403 })
  }

  const { data: ddRow } = await supabase
    .from('due_diligence_reports')
    .select('result')
    .eq('proyecto_id', body.proyectoId)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ result: DueDiligenceResult | null }>()

  const dd = ddRow?.result ?? null
  if (!dd) {
    // Sin due diligence: no hay de dónde extraer; devolvemos el input vacío.
    return Response.json({ ok: true, sugerido: cuadroVacio(), sinDatos: true })
  }

  try {
    const text = await aiComplete([{ role: 'user', content: buildPrompt(dd) }], {
      max_tokens: 1500,
    })
    const sugerido = parseSugerido(text)
    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, sugerido })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
