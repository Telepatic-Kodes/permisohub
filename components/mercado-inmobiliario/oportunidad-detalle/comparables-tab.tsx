import Link from "next/link"
import type { ComparableOportunidad } from "@/lib/mercado-locales-server"
import { REASON_LABEL } from "@/lib/mercado-locales-server"

interface ComparablesTabProps {
  comparables: ComparableOportunidad[]
  comuna: string
  tipoPropiedadLabel: string
}

function fmt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

export function ComparablesTab({ comparables, comuna, tipoPropiedadLabel }: ComparablesTabProps) {
  const insuficiente = comparables.length < 2

  return (
    <div className="space-y-4">
      {insuficiente && (
        <div className="rounded-lg border border-line-fine bg-muted/40 p-4 text-sm text-muted-foreground">
          No hay suficientes comparables en {comuna} / {tipoPropiedadLabel} todavía
          {comparables.length === 1 ? " — se encontró 1, mostrado abajo." : "."}
        </div>
      )}

      {comparables.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {comparables.map((c) => (
            <Link
              key={c.id}
              href={`/mercado-inmobiliario/oportunidades/${c.id}`}
              className="block rounded-lg border border-line-fine bg-card p-3.5 transition hover:border-primary/40 hover:shadow-sm"
            >
              <p className="line-clamp-2 text-sm font-medium text-primary">{c.titulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.comuna} · {fmt(c.precioUfNormalizado)} UF
                {c.precioUfM2Normalizado !== null ? ` · ${fmt(c.precioUfM2Normalizado)} UF/m²` : ""}
              </p>
              {c.reasonCodes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.reasonCodes.map((code) => (
                    <span
                      key={code}
                      className="rounded-[3px] border border-[var(--blueprint-soft)] bg-[var(--blueprint-soft)] px-1.5 py-0.5 text-[9px] text-[var(--blueprint)]"
                    >
                      {REASON_LABEL[code] ?? code}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
