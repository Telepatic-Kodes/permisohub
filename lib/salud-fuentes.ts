// Clasificación de salud de una fuente externa a partir de su historial de
// probes. Módulo PURO a propósito: sin fetch, sin Supabase, sin Date.now() —
// todo entra por parámetro. Es la única parte de este subsistema que decide
// "esto amerita despertarte", así que es la que tiene que ser testeable de
// verdad y la que conviene discutir por separado del plumbing.
//
// Lo consumen dos lados: la ruta cron (para decidir si alerta a Sentry) y la
// página /admin/salud-datos (para pintar el semáforo). Misma función en los
// dos = imposible que el semáforo diga verde mientras la alerta dice rojo.

export type EstadoSalud = 'ok' | 'lento' | 'caido' | 'sin_datos'

export interface MedicionProbe {
  ok: boolean
  /** null = no se midió. NO es 0. Ver comentario de duration_ms en la migración. */
  durationMs: number | null
  /** ISO. Se asume orden descendente (más reciente primero) al clasificar. */
  ranAt: string
}

/**
 * Cuántas mediciones mirar hacia atrás para la mediana de latencia.
 * Con un probe diario esto es "la última semana laboral": suficiente para que
 * un pico aislado no dispare, corto para que una degradación sostenida no
 * tarde un mes en aparecer.
 */
export const VENTANA_LATENCIA = 5

export function medianaLatencia(mediciones: MedicionProbe[]): number | null {
  // Solo mediciones con latencia REAL. Un probe fallido no aporta latencia
  // (su duración es "cuánto tardó en fallar", que no es lo mismo que cuánto
  // tarda el servicio cuando funciona) y un null tampoco.
  const valores = mediciones
    .filter((m) => m.ok && m.durationMs !== null)
    .map((m) => m.durationMs as number)
    .sort((a, b) => a - b)

  if (valores.length === 0) return null
  const medio = Math.floor(valores.length / 2)
  return valores.length % 2 === 1 ? valores[medio] : Math.round((valores[medio - 1] + valores[medio]) / 2)
}

/**
 * Estado de una fuente dado su historial de probes (más reciente primero).
 *
 * La política, explícita para que se pueda discutir:
 *
 * - Historial vacío → 'sin_datos', NUNCA 'ok'. "No lo medí" y "lo medí y está
 *   bien" son cosas distintas; colapsarlas es exactamente el bug que produce
 *   un tablero todo verde el día que el probe dejó de correr.
 * - Último probe fallido → 'caido'. Un solo fallo alcanza porque el probe ya
 *   reintenta internamente (ver correrProbe en lib/data-source-probes.ts):
 *   cuando llega acá, un 'error' significa dos fallos seguidos, no un blip.
 * - Último probe ok pero la MEDIANA de la ventana supera el umbral → 'lento'.
 *   Mediana y no último valor: un pico aislado en una instancia comunitaria
 *   es normal, una mediana degradada es un cambio de régimen.
 *
 * Trade-off consciente: esto detecta "el servicio responde mal", NO "el dato
 * que devuelve está mal". Un Valhalla que responde rápido con geometrías
 * basura sale 'ok' acá — esa clase de fallo la tiene que atrapar la aserción
 * de contenido dentro de cada probe, no esta función.
 */
export function clasificarSalud(historial: MedicionProbe[], umbralLatenciaMs: number): EstadoSalud {
  if (historial.length === 0) return 'sin_datos'
  if (!historial[0].ok) return 'caido'

  const mediana = medianaLatencia(historial.slice(0, VENTANA_LATENCIA))
  if (mediana !== null && mediana > umbralLatenciaMs) return 'lento'

  return 'ok'
}

/** Solo 'caido' y 'lento' ameritan despertar a alguien. */
export function ameritaAlerta(estado: EstadoSalud): boolean {
  return estado === 'caido' || estado === 'lento'
}
