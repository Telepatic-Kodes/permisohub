/**
 * Formateador compartido de fecha corta (mes+año, es-CL) — extraído de
 * oportunidades/page.tsx antes de escribir el primer componente nuevo que
 * muestre fechas (Fase 13, ficha de detalle) para no duplicar esta lógica.
 *
 * IMPORTANTE (Pitfall D, ver 13-RESEARCH.md): esta función espera un campo
 * DATE-ONLY (ej. `stats_date` de mercado_locales_stats_diarias, o
 * `fecha_registro` de cadenas_sucursales) — por eso fuerza `T00:00:00` antes
 * de parsear, para no perder un día por interpretación UTC. NO la uses para
 * campos `timestamptz` que YA incluyen hora real (`primera_vez_visto_el`,
 * `ultima_vez_visto_el`, `capturado_el`, `dado_de_baja_el`) — esos se
 * parsean con `new Date(iso)` directo, sin el sufijo, o se introduce el
 * bug inverso (forzar medianoche sobre un timestamp real).
 */
export function formatFechaCorta(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat("es-CL", { month: "short", year: "numeric", timeZone: "America/Santiago" }).format(
    new Date(`${iso}T00:00:00`)
  )
}

/**
 * Formateador compartido de timestamp corto (día+mes+año, es-CL) — hermano
 * de `formatFechaCorta` de arriba, pero para campos `timestamptz` que YA
 * incluyen hora real (ej. `primera_vez_visto_el`, `ultima_vez_visto_el`,
 * `capturado_el`, `dado_de_baja_el`). Ver el comentario de `formatFechaCorta`
 * arriba para la distinción date-only vs. timestamptz — no la repitas acá.
 */
export function formatTimestampCorto(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Santiago" }).format(
    new Date(iso)
  )
}
