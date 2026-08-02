import { cn } from "@/lib/utils"

// Barra divergente horizontal para visualizar un % de desviación respecto a
// un punto de referencia (0%) — ej. precio actual vs. mediana real de
// mercado. Reemplaza mostrar solo el número en texto. Plano con CSS, no
// recharts: es solo una barra con marca de cero, no justifica el peso de un
// chart library para esto.

interface DesviacionBarProps {
  variacionPct: number
  color: string
  /** rango visual máximo (clamp) — variaciones más extremas igual se muestran al tope de la barra. */
  max?: number
  className?: string
}

export function DesviacionBar({ variacionPct, color, max = 50, className }: DesviacionBarProps) {
  const clamped = Math.max(-max, Math.min(max, variacionPct))
  const pct = (Math.abs(clamped) / max) * 50 // % del ancho total (mitad de la barra por lado)

  return (
    <div className={cn("relative h-2 w-24 shrink-0 rounded-full bg-muted", className)}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-line-fine" />
      <div
        className="absolute inset-y-0 rounded-full"
        style={
          clamped >= 0
            ? { left: "50%", width: `${pct}%`, background: color }
            : { right: "50%", width: `${pct}%`, background: color }
        }
      />
    </div>
  )
}
