"use client"

import { useMemo, useState } from "react"
import { Info, MessageSquareText, Star } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Dato, Num } from "@/components/arch/dato"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import {
  ESTADISTICAS_MUNICIPIOS,
  getRanking,
  type EstadisticaMunicipio,
} from "@/lib/municipios-stats"
import { cn } from "@/lib/utils"

type SortKey = "calificacion" | "tiempo" | "observaciones"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "calificacion", label: "Mejor calificación" },
  { value: "tiempo", label: "Menor tiempo promedio" },
  { value: "observaciones", label: "Menor tasa de observaciones" },
]

function veredictoCalificacion(c: EstadisticaMunicipio["calificacion"]): Veredicto {
  if (c >= 4) return "cumple"
  if (c === 3) return "observa"
  return "rechaza"
}

function veredictoCumplimiento(v: number): Veredicto {
  if (v >= 0.8) return "cumple"
  if (v >= 0.65) return "observa"
  return "rechaza"
}

function pct(v: number) {
  return `${Math.round(v * 100)}%`
}

function StarRating({ value }: { value: EstadisticaMunicipio["calificacion"] }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i <= value
              ? "fill-primary text-primary"
              : "fill-transparent text-line-med"
          )}
        />
      ))}
    </div>
  )
}

export default function InteligenciaMunicipiosPage() {
  const [region, setRegion] = useState<string>("todas")
  const [sortKey, setSortKey] = useState<SortKey>("calificacion")

  const regiones = useMemo(() => {
    return Array.from(
      new Set(ESTADISTICAS_MUNICIPIOS.map((m) => m.region))
    ).sort()
  }, [])

  const municipios = useMemo(() => {
    const base = getRanking().filter(
      (m) => region === "todas" || m.region === region
    )
    const sorted = [...base]
    if (sortKey === "tiempo") {
      sorted.sort((a, b) => a.tiempoPromedioHabiles - b.tiempoPromedioHabiles)
    } else if (sortKey === "observaciones") {
      sorted.sort((a, b) => a.tasaObservaciones - b.tasaObservaciones)
    } else {
      sorted.sort((a, b) => b.calificacion - a.calificacion)
    }
    return sorted
  }, [region, sortKey])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🏛️"
        title="Inteligencia DOM"
        breadcrumbs={[
          { label: "IA Normativa" },
          { label: "Inteligencia DOM" },
        ]}
      />
      <div className="flex-1 space-y-6 overflow-auto p-8">
      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-[4px] border border-line-fine bg-card p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
        <p>
          Estadísticas sintéticas — estimadas a partir de fuentes públicas (MINVU, SEREMI) y
          práctica arquitectónica, aún no de datos anonimizados de proyectos reales tramitados
          en PermisoHub. Se irán reemplazando por datos reales a medida que más arquitectos usen
          la plataforma.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Región
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-9 rounded-[4px] border border-line-fine bg-card px-3 text-sm text-primary transition-colors focus:border-[var(--blueprint)] focus:outline-none focus:ring-1 focus:ring-[var(--blueprint)]/30"
          >
            <option value="todas">Todas las regiones</option>
            {regiones.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Ordenar por
          </label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-[4px] border border-line-fine bg-card px-3 text-sm text-primary transition-colors focus:border-[var(--blueprint)] focus:outline-none focus:ring-1 focus:ring-[var(--blueprint)]/30"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-end justify-between gap-4 border-b border-line-med pb-4">
        <div>
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Directorio DOM
          </p>
          <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
            Ranking de municipios
          </h2>
        </div>
        <span className="num text-xs text-muted-foreground/70">
          {municipios.length} municipios
        </span>
      </div>

      {/* Ranking cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {municipios.map((m, index) => (
          <div
            key={m.nombre}
            className="rounded-[4px] border border-line-fine bg-card p-4 transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
          >
            {/* Card header */}
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="num text-xs font-medium text-muted-foreground/50">
                    #{index + 1}
                  </span>
                  <h3 className="font-technical text-lg font-semibold leading-none text-primary">
                    {m.nombre}
                  </h3>
                  <span className="font-technical text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {m.region}
                  </span>
                </div>
                <StarRating value={m.calificacion} />
              </div>
              {m.totalProyectos === 0 ? (
                <EstadoNormativo estado="neutro" label="Acumulando datos" />
              ) : (
                <span className="num rounded-[3px] border border-line-fine px-2 py-0.5 text-[11px] text-muted-foreground">
                  {m.totalProyectos} proyectos
                </span>
              )}
            </div>

            {/* Key metrics */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[3px] border border-line-fine p-3">
                <Dato
                  label="Días hábiles promedio"
                  valor={m.tiempoPromedioHabiles}
                  unidad="días"
                  limite={`med ${m.tiempoMedianoHabiles}`}
                />
              </div>
              <div className="rounded-[3px] border border-line-fine p-3">
                <Dato
                  label="Tasa de observaciones"
                  valor={pct(m.tasaObservaciones)}
                  estado={veredictoCalificacion(m.calificacion)}
                />
              </div>
              <div className="rounded-[3px] border border-line-fine p-3">
                <Dato
                  label="Cumplimiento Ley 21.718"
                  valor={pct(m.cumplimientoPlazoLey)}
                  estado={veredictoCumplimiento(m.cumplimientoPlazoLey)}
                />
              </div>
              <div className="rounded-[3px] border border-line-fine p-3">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Meses más ágiles
                </p>
                <p className="text-sm font-medium leading-snug text-primary">
                  {m.mesesMasAgiles.join(", ")}
                </p>
              </div>
            </div>

            {/* Frequent observations */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center gap-3">
                <h4 className="font-technical inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <MessageSquareText className="size-3.5" />
                  Observaciones frecuentes
                </h4>
                <div className="h-px flex-1 bg-line-fine" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {m.tiposObservacionFrequentes.map((obs) => (
                  <span
                    key={obs}
                    className="inline-flex items-center rounded-[3px] border border-line-fine px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {obs}
                  </span>
                ))}
              </div>
            </div>

            {/* Notes */}
            <p className="mt-4 border-t border-line-fine pt-3 text-sm italic text-muted-foreground">
              {m.notas}
            </p>
          </div>
        ))}
      </div>

      {municipios.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No hay municipios para los filtros seleccionados.
        </p>
      )}
      </div>
    </div>
  )
}
