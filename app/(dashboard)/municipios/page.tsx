"use client"

import { useMemo, useState } from "react"
import {
  ChevronDown,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
} from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import {
  COMUNAS_CHILE,
  REGIONES_CHILE,
  getCoverageStats,
  type ComunaChile,
  type DomStatus,
} from "@/lib/comunas-chile"
import { MOCK_MUNICIPIOS, type MunicipioInfo } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const DOM_EN_LINEA_URL = "https://domenlinea.minvu.cl"

type StatusFilter = "todas" | "dom_en_linea" | "presencial"

const STATUS_BADGE: Record<DomStatus, { label: string; className: string }> = {
  dom_en_linea: { label: "DOM en Línea", className: "bg-green-100 text-green-700" },
  probable: { label: "Probable", className: "bg-blue-100 text-blue-700" },
  presencial: { label: "Presencial", className: "bg-gray-100 text-gray-700" },
}

function findMockInfo(comuna: ComunaChile): MunicipioInfo | undefined {
  return MOCK_MUNICIPIOS.find(
    (m) => m.nombre.toLowerCase() === comuna.nombre.toLowerCase()
  )
}

export default function MunicipiosPage() {
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState("")
  const [status, setStatus] = useState<StatusFilter>("todas")
  const [expanded, setExpanded] = useState<string | null>(null)

  const stats = useMemo(() => getCoverageStats(), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return COMUNAS_CHILE.filter((c) => {
      if (q && !c.nombre.toLowerCase().includes(q)) return false
      if (region && c.region !== region) return false
      if (status === "dom_en_linea" && c.domStatus !== "dom_en_linea") return false
      if (status === "presencial" && c.domStatus !== "presencial") return false
      return true
    })
  }, [search, region, status])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📍"
        title="Municipios"
        subtitle="Cobertura DOM en Línea por comuna · base de conocimiento normativo"
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar comuna..."
                className="pl-9"
              />
            </div>

            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">Todas las regiones</option>
              {REGIONES_CHILE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-lg border border-input bg-card p-0.5 shadow-sm">
              {(
                [
                  { key: "todas", label: "Todas" },
                  { key: "dom_en_linea", label: "DOM en Línea" },
                  { key: "presencial", label: "Presencial" },
                ] as { key: StatusFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatus(opt.key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    status === opt.key
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          {/* Stats bar */}
          <div className="rounded-xl bg-[#F9F7F3] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col rounded-lg bg-white px-4 py-2 shadow-sm">
                <span className="text-xl font-semibold text-primary">
                  210 comunas
                </span>
                <span className="text-xs text-muted-foreground">
                  en DOM en Línea
                </span>
              </div>
              <div className="flex flex-col rounded-lg bg-white px-4 py-2 shadow-sm">
                <span className="text-xl font-semibold text-primary">
                  {stats.pctCoverage}% del país
                </span>
                <span className="text-xs text-muted-foreground">
                  cobertura nacional
                </span>
              </div>
              <div className="flex flex-col rounded-lg bg-white px-4 py-2 shadow-sm">
                <span className="text-xl font-semibold text-gray-500">
                  345 comunas
                </span>
                <span className="text-xs text-muted-foreground">Chile total</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Datos MINVU · Sep 2023
            </p>
          </div>

          {/* Result count */}
          <p className="text-sm text-muted-foreground">
            Mostrando {filtered.length} de {COMUNAS_CHILE.length} comunas
          </p>

          {/* List */}
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {filtered.map((comuna) => {
          const isOpen = expanded === comuna.id
          const badge = STATUS_BADGE[comuna.domStatus]
          const info = findMockInfo(comuna)
          return (
            <div key={comuna.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : comuna.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F9F7F3]"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-primary">
                    {comuna.nombre}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {comuna.region}
                  </span>
                </div>

                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    badge.className
                  )}
                >
                  {badge.label}
                </span>

                {comuna.urlDom && (
                  <a
                    href={comuna.urlDom}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    aria-label={`Abrir plataforma DOM de ${comuna.nombre}`}
                  >
                    <Globe className="size-4" />
                  </a>
                )}

                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {isOpen && (
                <div className="bg-[#F9F7F3] px-4 pt-1 pb-4">
                  {info ? (
                    <div className="space-y-3">
                      <div className="grid gap-1.5 text-sm text-muted-foreground">
                        {info.dom_telefono && (
                          <span className="flex items-center gap-2">
                            <Phone className="size-4" />
                            {info.dom_telefono}
                          </span>
                        )}
                        {info.dom_email && (
                          <span className="flex items-center gap-2">
                            <Mail className="size-4" />
                            {info.dom_email}
                          </span>
                        )}
                        {info.dom_horario && (
                          <span className="flex items-center gap-2">
                            <MapPin className="size-4" />
                            {info.dom_horario}
                          </span>
                        )}
                        {info.plazo_tipico_dias && (
                          <span className="flex items-center gap-2">
                            <Clock className="size-4" />
                            Plazo típico: {info.plazo_tipico_dias} días
                          </span>
                        )}
                      </div>

                      {info.requisitos.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-primary">
                            Requisitos
                          </p>
                          <ul className="space-y-1.5">
                            {info.requisitos.map((r) => (
                              <li
                                key={r.nombre}
                                className="flex items-start gap-2 text-sm text-muted-foreground"
                              >
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                                <span>
                                  {r.nombre}
                                  {!r.obligatorio && (
                                    <span className="ml-1 text-xs italic">
                                      (si aplica)
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Info detallada próximamente. Consulta domenlinea.minvu.cl
                    </p>
                  )}

                  {comuna.domStatus === "dom_en_linea" && (
                    <a
                      href={comuna.urlDom ?? DOM_EN_LINEA_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      Ir a domenlinea.minvu.cl
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}

            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No se encontraron comunas con los filtros seleccionados.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
