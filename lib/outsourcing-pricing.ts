// ============================================================================
// Outsourcing pricing — fee de gestión por locales bajo administración
// ----------------------------------------------------------------------------
// Modelo de cobro del servicio de outsourcing de permisos: se factura un fee
// mensual por cada local activo bajo gestión, con descuentos por volumen.
// ============================================================================

/** Descuento aplicado al contratar el plan anual (vs. 12 meses sueltos). */
export const DESCUENTO_ANUAL = 0.15

export interface OutsourcingTier {
  label: string
  /** Mínimo de locales del tramo (inclusivo). */
  min: number
  /** Máximo de locales del tramo (inclusivo). `null` = sin tope. */
  max: number | null
  /** Precio mensual por local, en CLP. */
  precio_por_local_mes: number
}

/**
 * Tramos de precios por volumen. A mayor número de locales gestionados,
 * menor el precio unitario mensual por local.
 */
export const OUTSOURCING_TIERS: OutsourcingTier[] = [
  { label: 'Básico', min: 1, max: 50, precio_por_local_mes: 9990 },
  { label: 'Estándar', min: 51, max: 200, precio_por_local_mes: 7990 },
  { label: 'Enterprise', min: 201, max: null, precio_por_local_mes: 5990 },
]

export interface OutsourcingFee {
  tier: OutsourcingTier
  fee_mensual_clp: number
  fee_anual_clp: number
  /** Ahorro anual al pagar el plan anual vs. 12 meses al precio mensual. */
  ahorro_anual_clp: number
}

/**
 * Devuelve el tramo de precios que aplica para una cantidad de locales.
 * Para 0 o menos locales se devuelve el tramo más bajo (Básico).
 */
function resolverTier(nLocales: number): OutsourcingTier {
  const tier = OUTSOURCING_TIERS.find(
    (t) => nLocales >= t.min && (t.max === null || nLocales <= t.max),
  )
  // Fallback defensivo: si nLocales < 1, usamos el primer tramo.
  return tier ?? OUTSOURCING_TIERS[0]
}

/**
 * Calcula el fee de outsourcing para una cantidad de locales activos.
 *
 * - `fee_mensual_clp`  = locales × precio_por_local_mes (según tramo)
 * - `fee_anual_clp`    = fee mensual × 12 con descuento anual aplicado
 * - `ahorro_anual_clp` = lo que se ahorra al pagar anual vs. 12 meses sueltos
 */
export function calcularFeeOutsourcing(nLocales: number): OutsourcingFee {
  const locales = Math.max(0, Math.floor(nLocales))
  const tier = resolverTier(locales)

  const fee_mensual_clp = locales * tier.precio_por_local_mes
  const total_anual_sin_descuento = fee_mensual_clp * 12
  const fee_anual_clp = Math.round(total_anual_sin_descuento * (1 - DESCUENTO_ANUAL))
  const ahorro_anual_clp = total_anual_sin_descuento - fee_anual_clp

  return {
    tier,
    fee_mensual_clp,
    fee_anual_clp,
    ahorro_anual_clp,
  }
}
