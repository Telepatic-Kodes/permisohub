export const dynamic = 'force-dynamic'
export const maxDuration = 90

import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { getContextoNormativo, flagUnverifiedDDU, REGLAS_CITACION } from '@/lib/normativa-retrieval'

// ---------------------------------------------------------------------------
// Asesor de tramitación — qué VÍA conviene, no solo qué dice la norma.
//
// Nace de la reunión 2026-07-02: la IA de la competencia "fuerza" el permiso
// de alteración (caro, lento) e ignora la restricción del cliente. Este asesor
// pondera costo/tiempo y evalúa explícitamente si una vía más liviana (ej. un
// 512 / patente / obra menor) es alcanzable, y CÓMO llegar a ella.
// ---------------------------------------------------------------------------

interface AsesorRequest {
  situacion: string
  objetivo?: string
  restricciones?: string
  municipio?: string
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

interface AsesorResult {
  viaRecomendada: string
  vias: ViaTramitacion[]
  estrategia: string
  pasos: PasoEstrategia[]
  riesgos: string[]
  ddu: { codigo: string; porque: string }[]
  advertencia: string
}

function buildPrompt(req: AsesorRequest): string {
  const normativaCtx = getContextoNormativo(
    `${req.situacion} ${req.objetivo ?? ''} obras menores alteración cambio de destino uso regularización patente 5.1.2 5.2.5 permiso edificación recepción`,
  )

  const muni = req.municipio?.trim() ? ` en ${req.municipio.trim()}` : ''
  const objetivo = req.objetivo?.trim()
    ? `## Objetivo del cliente\n${req.objetivo.trim()}`
    : '## Objetivo del cliente\nNo declarado explícitamente: infiere el resultado buscado a partir de la situación.'
  const restr = req.restricciones?.trim()
    ? `## Restricciones (críticas — respétalas)\n${req.restricciones.trim()}`
    : '## Restricciones\nNo declaradas. Asume las típicas: minimizar costo, tiempo y cantidad de especialistas.'

  return `Actúas como un arquitecto chileno experto en normativa y tramitación municipal (DOM), del lado del mandante${muni}. Tu trabajo NO es solo decir qué dice la norma: es recomendar la VÍA de tramitación que resuelve el caso con el MENOR costo y tiempo posibles, respetando la ley.

Contexto importante: muchas herramientas fuerzan el permiso de alteración (caro, lento, exige especialistas: cálculo, sanitario, constructor) sin considerar que el cliente quiere una vía más liviana. Tú SIEMPRE evalúas primero si una vía menor es alcanzable (p. ej. regularización, obra menor Art. 5.1.2, cambio de destino, patente/512) y, si lo es, explicas CÓMO llegar a ella. Solo escalas a alteración o permiso de edificación cuando de verdad no hay alternativa, y lo justificas.

## Situación
${req.situacion.trim()}

${objetivo}

${restr}

## Contexto normativo (OGUC · LGUC · DDU)
${normativaCtx}

${REGLAS_CITACION}

## Instrucción
Compara las vías de tramitación realmente aplicables a este caso, de la más liviana a la más pesada. Para cada una: viabilidad real, tiempo estimado, costo relativo, requisitos, pros y contras, y fundamento normativo. Recomienda la vía que mejor equilibra legalidad + costo + tiempo dado el objetivo y las restricciones. Da pasos concretos y accionables. Si la vía liviana exige un ajuste de proyecto (ej. redibujar un alero, revertir una modificación de fachada), dilo explícitamente como paso.

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
  "riesgos": ["riesgos o supuestos que hay que verificar"],
  "ddu": [ { "codigo": "DDU — <materia/título de la circular, SIN número inventado>", "porque": "qué resuelve en este caso" } ],
  "advertencia": "1 oración: qué verificar con la DOM antes de comprometerse"
}

Ordena "vias" de la más liviana (menor costo/tiempo) a la más pesada. Incluye 2 a 4 vías.`
}

function parse(text: string): Omit<AsesorResult, never> {
  const match = text.match(/\{[\s\S]*\}/)
  const fallback: AsesorResult = {
    viaRecomendada: '',
    vias: [],
    estrategia: text.slice(0, 800),
    pasos: [],
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
      riesgos: Array.isArray(raw.riesgos) ? raw.riesgos : [],
      ddu: Array.isArray(raw.ddu) ? raw.ddu : [],
      advertencia: typeof raw.advertencia === 'string' ? raw.advertencia : '',
    }
  } catch {
    return fallback
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

  const body = (await request.json()) as AsesorRequest
  if (!body.situacion || body.situacion.trim().length < 20) {
    return Response.json(
      { error: 'Describe la situación con al menos un par de frases' },
      { status: 400 },
    )
  }

  try {
    const text = await aiComplete([{ role: 'user', content: buildPrompt(body) }], {
      max_tokens: 2800,
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
