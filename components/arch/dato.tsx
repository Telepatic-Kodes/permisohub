// ---------------------------------------------------------------------------
// Dato técnico — el número tratado con rigor de cota.
//
// Idioma del arquitecto: toda medida (m², %, coeficiente, plazo, art., rol,
// expediente) va en monospace con cifras tabulares, para que se lea alineada
// como en el cuadro de un plano. `Num` es el átomo inline; `Dato` es la celda
// etiquetada (label arriba, valor grande, unidad y límite opcionales).
// ---------------------------------------------------------------------------
import { cn } from "@/lib/utils"
import { colorDeVeredicto, type Veredicto } from "@/components/arch/estado"

/** Número técnico inline (mono + tabular). Úsalo dentro de prosa o tablas. */
export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("num", className)}>{children}</span>
}

interface DatoProps {
  label: string
  valor: React.ReactNode
  unidad?: string
  /** Límite/referencia normativa (ej. "/ 0.6"). Va en tono tenue. */
  limite?: string
  /** Colorea el valor según veredicto (cumple/observa/rechaza). */
  estado?: Veredicto
  className?: string
}

/** Celda de dato técnico: rótulo pequeño en caja, valor monospace prominente. */
export function Dato({ label, valor, unidad, limite, estado, className }: DatoProps) {
  const color = estado ? colorDeVeredicto(estado) : undefined
  return (
    <div className={cn("min-w-0", className)}>
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="num flex items-baseline gap-1 text-xl font-semibold leading-none" style={color ? { color } : undefined}>
        <span>{valor}</span>
        {unidad && <span className="text-xs font-medium text-muted-foreground">{unidad}</span>}
        {limite && <span className="text-xs font-normal text-muted-foreground/70">{limite}</span>}
      </p>
    </div>
  )
}
