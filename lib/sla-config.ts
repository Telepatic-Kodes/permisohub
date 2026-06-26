/**
 * SLA — Compromisos de servicio para el equipo interno de PermisoHub.
 *
 * Metas operativas que definen los tiempos comprometidos con las cadenas
 * comerciales bajo gestión outsourcing.
 */
export const SLA_METAS = {
  /** Días desde la creación del proyecto hasta el ingreso a DOM. */
  ingreso_dom_dias: 7,
  /** Días para responder observaciones emitidas por la DOM. */
  respuesta_obs_dias: 5,
  /** Días antes del 31 de marzo para iniciar la renovación de patentes. */
  patente_renovacion_dias: 30,
} as const

export type SlaMetas = typeof SLA_METAS
