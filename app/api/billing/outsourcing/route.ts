// ============================================================================
// Billing — Outsourcing por locales gestionados
// ----------------------------------------------------------------------------
// GET: resumen de facturación de todas las cadenas. Para cada cadena cuenta
// los locales activos (mock) y calcula el fee con `calcularFeeOutsourcing`.
// ============================================================================

import { calcularFeeOutsourcing } from '@/lib/outsourcing-pricing'

export const dynamic = 'force-dynamic'

export interface CadenaBilling {
  cadena_id: string
  cadena_nombre: string
  n_locales: number
  tier: string
  fee_mensual_clp: number
}

interface BillingTotals {
  locales_total: number
  mrr_clp: number
  arr_clp: number
}

export interface OutsourcingBillingResponse {
  cadenas: CadenaBilling[]
  totals: BillingTotals
}

// Cadenas mock del vertical enterprise. En producción esto se obtiene de
// Supabase (tabla `cadenas`).
const MOCK_CADENAS: { id: string; nombre: string }[] = [
  { id: 'cad-1', nombre: 'Farmacias Cruz Verde' },
  { id: 'cad-2', nombre: 'Tiendas Tempo Chile' },
  { id: 'cad-3', nombre: 'Cafés Juan Valdez' },
  { id: 'cad-4', nombre: 'Retail Maicao' },
  { id: 'cad-5', nombre: 'Servicios Banco Estado Express' },
  { id: 'cad-6', nombre: 'Gastronomía Doggis' },
]

/** Entero pseudo-aleatorio entre min y max (inclusivo). */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function GET(): Promise<Response> {
  const cadenas: CadenaBilling[] = MOCK_CADENAS.map((cadena) => {
    // Mock: cada cadena tiene entre 5 y 150 locales activos.
    const n_locales = randomInt(5, 150)
    const { tier, fee_mensual_clp } = calcularFeeOutsourcing(n_locales)

    return {
      cadena_id: cadena.id,
      cadena_nombre: cadena.nombre,
      n_locales,
      tier: tier.label,
      fee_mensual_clp,
    }
  })

  const locales_total = cadenas.reduce((sum, c) => sum + c.n_locales, 0)
  const mrr_clp = cadenas.reduce((sum, c) => sum + c.fee_mensual_clp, 0)
  const arr_clp = mrr_clp * 12

  const response: OutsourcingBillingResponse = {
    cadenas,
    totals: { locales_total, mrr_clp, arr_clp },
  }

  return Response.json(response)
}
