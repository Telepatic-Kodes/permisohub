// UF-01: constante compartida de fallback para cuando mindicador.cl no
// responde. Antes había 4 copias hardcodeadas de "38000" desincronizadas del
// valor real (auditoría 2026-07-30, hallazgo A4): la UF real de jul-2026 es
// ≈ $40.845, un 7% por sobre el fallback viejo. Una sola constante, con
// fecha, para que quede claro cuándo hay que actualizarla.
export const UF_FALLBACK_CLP = 40800 // Valor referencial actualizado 2026-07-30 (UF real jul-2026 ≈ $40.845, fuente: SII vía web search). Actualizar periódicamente — usado solo cuando mindicador.cl no responde.

export interface UfData {
  valor: number
  fecha: string | null
  fallback: boolean
}

/** Respuesta a usar cuando /api/utils/uf (o el fetch directo a mindicador.cl) falla. */
export const UF_FALLBACK_DATA: UfData = {
  valor: UF_FALLBACK_CLP,
  fecha: null,
  fallback: true,
}
