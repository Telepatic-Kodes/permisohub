"use client"

import { useMemo, useState } from "react"
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  MessageSquareText,
  Star,
} from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

function calificacionColor(c: EstadisticaMunicipio["calificacion"]) {
  if (c >= 4) return "border-green-200 bg-green-50"
  if (c === 3) return "border-amber-200 bg-amber-50"
  return "border-red-200 bg-red-50"
}

function calificacionTextColor(c: EstadisticaMunicipio["calificacion"]) {
  if (c >= 4) return "text-green-700"
  if (c === 3) return "text-amber-700"
  return "text-red-700"
}

function cumplimientoColor(v: number) {
  if (v >= 0.8) return "text-green-700"
  if (v >= 0.65) return "text-amber-700"
  return "text-red-700"
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
            "size-4",
            i <= value
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-200 text-gray-200"
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
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Estadísticas basadas en datos anonimizados de proyectos gestionados
          con PermisoHub. A mayor número de proyectos, mayor precisión.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Región
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          <label className="text-xs font-medium text-muted-foreground">
            Ordenar por
          </label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-md border border-input bg-white px-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ranking cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {municipios.map((m, index) => (
          <Card
            key={m.nombre}
            className={cn(
              "rounded-xl border border-gray-100 shadow-sm",
              calificacionColor(m.calificacion)
            )}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary/40">
                      #{index + 1}
                    </span>
                    <h2 className="text-lg font-semibold text-primary">
                      {m.nombre}
                    </h2>
                    <Badge variant="outline">{m.region}</Badge>
                  </div>
                  <StarRating value={m.calificacion} />
                </div>
                {m.totalProyectos === 0 ? (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    N/A — acumulando datos
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-[#F0EBE1] px-2.5 py-0.5 text-xs font-medium text-primary">
                    {m.totalProyectos} proyectos
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Key metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/70 p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    Días hábiles promedio
                  </span>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {m.tiempoPromedioHabiles}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (mediana {m.tiempoMedianoHabiles})
                    </span>
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ClipboardList className="size-3.5" />
                    Tasa de observaciones
                  </span>
                  <p
                    className={cn(
                      "mt-1 text-lg font-semibold",
                      calificacionTextColor(m.calificacion)
                    )}
                  >
                    {pct(m.tasaObservaciones)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5" />
                    Cumplimiento Ley 21.718
                  </span>
                  <p
                    className={cn(
                      "mt-1 text-lg font-semibold",
                      cumplimientoColor(m.cumplimientoPlazoLey)
                    )}
                  >
                    {pct(m.cumplimientoPlazoLey)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 p-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarCheck className="size-3.5" />
                    Meses más ágiles
                  </span>
                  <p className="mt-1 text-sm font-medium text-primary">
                    {m.mesesMasAgiles.join(", ")}
                  </p>
                </div>
              </div>

              {/* Frequent observations */}
              <div className="space-y-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquareText className="size-3.5" />
                  Observaciones frecuentes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {m.tiposObservacionFrequentes.map((obs) => (
                    <span
                      key={obs}
                      className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-xs text-primary ring-1 ring-gray-200"
                    >
                      {obs}
                    </span>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <p className="border-t border-black/5 pt-3 text-sm italic text-muted-foreground">
                {m.notas}
              </p>
            </CardContent>
          </Card>
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
