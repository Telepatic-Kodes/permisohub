import { ExternalLink, ShieldCheck } from "lucide-react"
import type { InstrumentoIPT } from "@/lib/instrumentos-ipt-server"

// Sección separada y visualmente distinta de PlanReguladorSection (el
// bloque existente en esta página es contenido de referencia investigado a
// mano, no verificado en vivo — ver lib/inteligencia-dom.ts). Esta es dato
// real, sincronizado semanalmente desde la API pública de Portal IPT
// (MINVU) — nunca se combinan en una sola tarjeta para que quede claro cuál
// es cuál.

const ESTADO_BADGE: Record<string, string> = {
  Vigente: "bg-green-100 text-green-700",
  "En Desarrollo": "bg-blue-100 text-blue-700",
  Derogado: "bg-gray-100 text-gray-600",
  Desistido: "bg-gray-100 text-gray-500",
}

function formatFecha(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))
}

// Una comuna puede tener 100+ instrumentos (PRC + docenas de modificaciones
// menores acumuladas en décadas) — obtenerInstrumentosIptPorComuna ya los
// ordena con lo más relevante primero (Comunal > Intercomunal, instrumento
// de origen > modificación, vigente > derogado), así que mostrar solo los
// primeros N y contar el resto es más útil que una lista de cientos de filas.
const MAX_VISIBLES = 12

export function InstrumentosIptSection({ instrumentos }: { instrumentos: InstrumentoIPT[] }) {
  if (instrumentos.length === 0) return null
  const visibles = instrumentos.slice(0, MAX_VISIBLES)
  const restantes = instrumentos.length - visibles.length

  return (
    <div className="rounded-xl border border-line-fine bg-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">Instrumentos de Planificación Territorial</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Dato real · Portal IPT MINVU</span>
      </div>

      <div className="space-y-2">
        {visibles.map((inst) => (
          <div key={inst.id} className="rounded-lg border border-line-fine bg-background p-3.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                {inst.planificacion && (
                  <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground mr-1.5">
                    {inst.planificacion}
                  </span>
                )}
                <span className="text-[12px] font-semibold text-foreground">{inst.denominacion}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_BADGE[inst.estado] ?? "bg-muted text-muted-foreground"}`}>
                {inst.estado}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {inst.clasificacion && <span>{inst.clasificacion}</span>}
              {inst.fechaInicioVigencia && <span>Vigente desde {formatFecha(inst.fechaInicioVigencia)}</span>}
            </div>

            {inst.documentos.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {inst.documentos.slice(0, 4).map((doc, i) => (
                  <a
                    key={i}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="size-2.5" />
                    {doc.tipo}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {restantes > 0 && (
        <p className="text-[11px] text-muted-foreground">
          +{restantes} instrumento{restantes === 1 ? "" : "s"} adicional{restantes === 1 ? "" : "es"} (modificaciones menores u otros niveles de planificación).
        </p>
      )}
    </div>
  )
}
