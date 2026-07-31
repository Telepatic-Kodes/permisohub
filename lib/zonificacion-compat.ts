import { z } from 'zod'
import { aiComplete, isAIAvailable } from './ai'

export const CompatEstadoSchema = z.enum(['permitido', 'no_permitido', 'no_especificado'])
export type CompatEstado = z.infer<typeof CompatEstadoSchema>

export interface CompatibilidadResult {
  estado: CompatEstado
  justificacion: string
}

// COMPAT-01: nunca un veredicto binario. Corto-circuito determinista ANTES de
// construir cualquier prompt — si no hay usos disponibles o el texto viene
// vacío, un LLM al que igual se le pregunta "¿es X permitido dado: (nada)?"
// tiende a producir una respuesta plausible pero sin fundamento (Pitfall 4).
export async function verificarCompatibilidadUso(
  usoPretendido: string,
  uperm: string | null,
  uproh: string | null,
  usosDisponibles: boolean,
): Promise<CompatibilidadResult> {
  if (!usosDisponibles || (!uperm?.trim() && !uproh?.trim())) {
    return {
      estado: 'no_especificado',
      justificacion: 'La zona no tiene usos permitidos/prohibidos disponibles en la fuente consultada — no se puede determinar automáticamente.',
    }
  }

  if (!isAIAvailable()) {
    return {
      estado: 'no_especificado',
      justificacion: 'Verificación automática no disponible en este momento.',
    }
  }

  try {
    const raw = await aiComplete(
      [
        {
          role: 'system',
          content: 'Eres un asistente que clasifica compatibilidad de uso de suelo contra un Plan Regulador Comunal (PRC) chileno. Responde SOLO JSON.',
        },
        {
          role: 'user',
          content: `Usos permitidos: ${uperm ?? '(sin dato)'}\nUsos prohibidos: ${uproh ?? '(sin dato)'}\nUso pretendido: "${usoPretendido}"\n\nResponde JSON: {"estado": "permitido"|"no_permitido"|"no_especificado", "justificacion": "..."}. Usa "no_especificado" si la información disponible no permite determinarlo con confianza — nunca fuerces "permitido" o "no_permitido" cuando la evidencia es ambigua.`,
        },
      ],
      { json: true, max_tokens: 300 },
    )

    const parsed: unknown = JSON.parse(raw)
    const estadoRaw = (parsed as { estado?: unknown })?.estado
    const justRaw = (parsed as { justificacion?: unknown })?.justificacion
    const estado = CompatEstadoSchema.safeParse(estadoRaw)

    return {
      estado: estado.success ? estado.data : 'no_especificado',
      justificacion: typeof justRaw === 'string' && justRaw.trim() ? justRaw : 'No se pudo determinar automáticamente.',
    }
  } catch {
    // JSON.parse failure, network error, o cualquier otra forma inesperada —
    // mismo patrón defensivo que normativa-retrieval.ts's
    // flagUnverifiedCita() aplica en otro lado: nunca inventar un 4to estado,
    // nunca dejar que una excepción se traduzca en un falso "permitido".
    return { estado: 'no_especificado', justificacion: 'No se pudo determinar automáticamente.' }
  }
}
