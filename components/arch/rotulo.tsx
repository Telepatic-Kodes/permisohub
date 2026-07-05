// ---------------------------------------------------------------------------
// Rótulo (cajetín / title block) — la cabecera del expediente como documento
// técnico, no como header web.
//
// Idioma del arquitecto: en un plano el rótulo va abajo-derecha y contiene
// proyecto, dirección, autor, expediente, fecha y revisión, en celdas de
// borde fino con etiquetas diminutas y valores en mono. Aquí lo llevamos a la
// cabecera de la ficha del expediente para que se sienta una lámina firmada.
// ---------------------------------------------------------------------------
import { cn } from "@/lib/utils"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"

export interface CampoRotulo {
  label: string
  valor: React.ReactNode
  /** Valor en monospace (por defecto true: casi todo dato de rótulo es técnico). */
  mono?: boolean
}

interface RotuloProps {
  titulo: string
  subtitulo?: string
  /** Eyebrow sobre el título (ej. "EXPEDIENTE DE EDIFICACIÓN"). */
  clase?: string
  estado?: { veredicto: Veredicto; label?: string }
  campos: CampoRotulo[]
  /** Bloque de revisión (delta): nº + fecha de la última revisión. */
  revision?: { n: number; fecha: string }
  acciones?: React.ReactNode
  className?: string
}

export function Rotulo({
  titulo,
  subtitulo,
  clase,
  estado,
  campos,
  revision,
  acciones,
  className,
}: RotuloProps) {
  return (
    <div className={cn("rotulo overflow-hidden", className)}>
      {/* Franja de título */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          {clase && (
            <p className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-block h-2 w-2 border border-[var(--blueprint)]" style={{ borderRightWidth: 0, borderBottomWidth: 0 }} />
              {clase}
            </p>
          )}
          <h1 className="font-technical truncate text-lg font-semibold leading-tight text-foreground">
            {titulo}
          </h1>
          {subtitulo && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitulo}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {estado && <EstadoNormativo estado={estado.veredicto} label={estado.label} />}
          {revision !== undefined && (
            <span
              className="num inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-muted-foreground"
              title={`Revisión ${revision.n} · ${revision.fecha}`}
            >
              <RevDelta n={revision.n} />
              {revision.fecha}
            </span>
          )}
          {acciones}
        </div>
      </div>

      {/* Celdas del cajetín */}
      <div className="grid grid-cols-2 divide-x divide-y divide-line-fine border-t border-line-fine sm:grid-cols-3 lg:grid-cols-5">
        {campos.map((c, i) => (
          <div key={i} className="min-w-0 px-3 py-2">
            <p className="mb-0.5 truncate text-[8.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {c.label}
            </p>
            <p className={cn("truncate text-[13px] leading-tight text-foreground", c.mono !== false && "num")}>
              {c.valor}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Triángulo de revisión (delta) con número — símbolo canónico de revisión. */
export function RevDelta({ n }: { n: number }) {
  return (
    <span className="relative inline-flex size-3.5 items-center justify-center">
      <svg viewBox="0 0 16 16" className="absolute inset-0" fill="none">
        <path d="M8 1.5 L15 14 L1 14 Z" stroke="var(--blueprint)" strokeWidth="1.2" fill="color-mix(in oklch, var(--blueprint) 10%, transparent)" />
      </svg>
      <span className="num relative text-[8px] font-bold leading-none text-[var(--blueprint)]" style={{ marginTop: "2px" }}>
        {n}
      </span>
    </span>
  )
}
