import { cn } from "@/lib/utils"

// Gauge semicircular simple (SVG, sin recharts — un arco no justifica el
// peso de la librería). Reemplaza el punto de color + texto ("Excelente"/
// "Aceptable"/"Bajo") por una lectura visual de dónde cae el valor en su
// escala, coloreada por el mismo veredicto que ya calcula
// lib/calculadora-inversion.ts — el color es un prop, no una decisión nueva.

interface GaugeArcProps {
  value: number
  max: number
  label: string
  valueLabel: string
  color: string
  className?: string
}

const R = 40
const STROKE = 9
const SIZE = R * 2 + STROKE
const PATH_LENGTH = Math.PI * R

export function GaugeArc({ value, max, label, valueLabel, color, className }: GaugeArcProps) {
  const fraccion = Math.max(0, Math.min(1, value / max))
  const offset = PATH_LENGTH * (1 - fraccion)
  const d = `M ${STROKE / 2},${R + STROKE / 2} A ${R},${R} 0 1 1 ${SIZE - STROKE / 2},${R + STROKE / 2}`

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={SIZE} height={R + STROKE} viewBox={`0 0 ${SIZE} ${R + STROKE}`}>
        <path d={d} fill="none" stroke="var(--muted)" strokeWidth={STROKE} strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={PATH_LENGTH}
          strokeDashoffset={offset}
        />
      </svg>
      <p className="num -mt-2 text-lg font-semibold text-primary">{valueLabel}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  )
}
