// ---------------------------------------------------------------------------
// Estado normativo — el ÚNICO color saturado del sistema.
//
// Idioma del arquitecto: en un plano el color no decora, codifica. Aquí el
// color solo comunica cumplimiento normativo: cumple (verde), observa (ámbar),
// rechaza (rojo), neutro (tinta). Nada más en la UI lleva color saturado.
// ---------------------------------------------------------------------------
import { cn } from "@/lib/utils"

export type Veredicto = "cumple" | "observa" | "rechaza" | "neutro"

const MAP: Record<Veredicto, { label: string; color: string; bg: string }> = {
  cumple: { label: "Cumple", color: "var(--state-ok)", bg: "color-mix(in oklch, var(--state-ok) 12%, transparent)" },
  observa: { label: "Con observaciones", color: "var(--state-warn)", bg: "color-mix(in oklch, var(--state-warn) 14%, transparent)" },
  rechaza: { label: "Rechazado", color: "var(--state-error)", bg: "color-mix(in oklch, var(--state-error) 12%, transparent)" },
  neutro: { label: "Sin evaluar", color: "var(--muted-foreground)", bg: "color-mix(in oklch, var(--muted-foreground) 10%, transparent)" },
}

interface EstadoProps {
  estado: Veredicto
  /** Sobrescribe la etiqueta por defecto (ej. "En revisión DOM"). */
  label?: string
  className?: string
  /** Punto sólido a la izquierda (semáforo). */
  dot?: boolean
}

export function EstadoNormativo({ estado, label, className, dot = true }: EstadoProps) {
  const m = MAP[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{ color: m.color, background: m.bg, border: `1px solid ${m.color}` }}
    >
      {dot && <span className="size-1.5 rounded-full" style={{ background: m.color }} />}
      {label ?? m.label}
    </span>
  )
}

export function colorDeVeredicto(estado: Veredicto): string {
  return MAP[estado].color
}
