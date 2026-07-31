"use client"

import { use, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  HelpCircle,
  XCircle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { TIPO_PERMISO_LABELS, type TipoPermiso } from "@/types"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────────────────────────────
// Response contract — mirrors app/api/portal/cadena/[token]/route.ts
// ──────────────────────────────────────────────────────────────────────────

type EstadoCompliance = "vigente" | "por_vencer" | "vencido" | "sin_datos"

interface LocalCompliance {
  id: string
  numero: string
  nombre_negocio?: string
  estado: EstadoCompliance
  tipo_permiso?: string
  fecha_vencimiento?: string
  dias_restantes?: number
}

interface CentroCompliance {
  id: string
  nombre: string
  municipio: string
  locales: LocalCompliance[]
}

interface AlertaCompliance {
  tipo: "vencimiento_30d" | "vencimiento_7d" | "vencido" | "sin_permiso"
  local_nombre: string
  centro_nombre: string
  fecha?: string
  dias?: number
}

interface ComplianceStats {
  vigentes: number
  por_vencer: number
  vencidos: number
  sin_datos: number
  total: number
}

interface CadenaComplianceResponse {
  ok: true
  cadena: { nombre: string; logo_url?: string }
  stats: ComplianceStats
  centros: CentroCompliance[]
  alertas: AlertaCompliance[]
  generated_at: string
  source: "db" | "mock"
}

// ──────────────────────────────────────────────────────────────────────────
// Visual maps
// ──────────────────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<EstadoCompliance, string> = {
  vigente: "bg-green-100 text-green-800",
  por_vencer: "bg-amber-100 text-amber-800",
  vencido: "bg-red-100 text-red-800",
  sin_datos: "bg-gray-100 text-gray-600",
}

const ESTADO_LABEL: Record<EstadoCompliance, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_datos: "Sin datos",
}

const ALERTA_BADGE: Record<AlertaCompliance["tipo"], string> = {
  vencido: "bg-red-100 text-red-800",
  vencimiento_7d: "bg-red-100 text-red-800",
  vencimiento_30d: "bg-amber-100 text-amber-800",
  sin_permiso: "bg-gray-100 text-gray-600",
}

function tipoPermisoLabel(tipo?: string): string | undefined {
  if (!tipo) return undefined
  return TIPO_PERMISO_LABELS[tipo as TipoPermiso] ?? tipo
}

function formatFecha(iso?: string): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function diasLabel(dias?: number): string {
  if (dias === undefined) return "—"
  if (dias < 0) return `${Math.abs(dias)}d vencido`
  if (dias === 0) return "vence hoy"
  return `${dias}d restantes`
}

function alertaTitulo(a: AlertaCompliance): string {
  switch (a.tipo) {
    case "vencido":
      return `Permiso vencido hace ${Math.abs(a.dias ?? 0)} días`
    case "vencimiento_7d":
      return `Vence en ${a.dias} días`
    case "vencimiento_30d":
      return `Vence en ${a.dias} días`
    case "sin_permiso":
      return "Sin permiso registrado"
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function PortalCadenaPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [data, setData] = useState<CadenaComplianceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openCentros, setOpenCentros] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)

    fetch(`/api/portal/cadena/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not ok")
        return (await r.json()) as CadenaComplianceResponse
      })
      .then((payload) => {
        if (!active) return
        if (!payload?.ok) throw new Error("invalid")
        setData(payload)
        // Open all centros by default
        const initial: Record<string, boolean> = {}
        for (const c of payload.centros) initial[c.id] = true
        setOpenCentros(initial)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const kpis = useMemo(() => {
    const s = data?.stats
    return [
      {
        key: "vigentes",
        label: "Vigentes",
        value: s?.vigentes ?? 0,
        icon: CheckCircle2,
        tint: "text-green-700",
        ring: "border-green-200 bg-green-50",
      },
      {
        key: "por_vencer",
        label: "Por vencer en 30d",
        value: s?.por_vencer ?? 0,
        icon: AlertTriangle,
        tint: "text-amber-700",
        ring: "border-amber-200 bg-amber-50",
      },
      {
        key: "vencidos",
        label: "Vencidos",
        value: s?.vencidos ?? 0,
        icon: XCircle,
        tint: "text-red-700",
        ring: "border-red-200 bg-red-50",
      },
      {
        key: "sin_datos",
        label: "Sin datos",
        value: s?.sin_datos ?? 0,
        icon: HelpCircle,
        tint: "text-gray-600",
        ring: "border-gray-200 bg-gray-50",
      },
    ] as const
  }, [data])

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-64 animate-pulse rounded-md bg-gray-200" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-gray-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-gray-100" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-5 w-full animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        </Card>
      </main>
    )
  }

  // ── Error / invalid token ────────────────────────────────────────────────
  if (error || !data) {
    return (
      <main className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-100">
            <XCircle className="size-6 text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-primary">
            Enlace no válido
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este enlace de compliance no existe o ya expiró. Solicita un enlace
            nuevo a tu contacto en PermisoHub.
          </p>
        </div>
      </main>
    )
  }

  const { cadena, stats, centros, alertas } = data
  const isEmpty = stats.total === 0

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8 print:py-2">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary">
            <Building2 className="size-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              PermisoHub · Compliance
            </p>
            <h1 className="text-2xl font-semibold text-primary leading-tight">
              {cadena.nombre}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Portal de Compliance — actualizado {formatFecha(data.generated_at)}
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-border bg-white px-3.5 py-2 text-sm font-medium text-primary transition-colors hover:bg-gray-50 print:hidden"
        >
          <Download className="size-4" />
          Descargar resumen PDF
        </button>
      </header>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map(({ key, label, value, icon: Icon, tint, ring }) => (
          <Card
            key={key}
            className={cn("gap-0 border p-5", ring)}
          >
            <div className="flex items-center justify-between">
              <span className={cn("text-3xl font-semibold", tint)}>{value}</span>
              <Icon className={cn("size-5", tint)} />
            </div>
            <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">
              {label}
            </p>
          </Card>
        ))}
      </section>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {isEmpty && (
        <Card className="py-16 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground/20" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aún no hay locales registrados para esta cadena.
          </p>
        </Card>
      )}

      {/* ── Alertas ─────────────────────────────────────────────────────── */}
      {alertas.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-primary">
              Alertas ({alertas.length})
            </h2>
          </div>
          <div className="space-y-2">
            {alertas.map((a, i) => (
              <div
                key={`${a.local_nombre}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-primary truncate">
                    {a.local_nombre}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground truncate">
                    {a.centro_nombre} · {alertaTitulo(a)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    ALERTA_BADGE[a.tipo],
                  )}
                >
                  {a.tipo === "sin_permiso"
                    ? "Sin datos"
                    : diasLabel(a.dias)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Centros ─────────────────────────────────────────────────────── */}
      {centros.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-primary">
            Centros comerciales
          </h2>

          {centros.map((centro) => {
            const isOpen = openCentros[centro.id] ?? false
            return (
              <Card key={centro.id} className="gap-0 overflow-hidden p-0">
                <button
                  onClick={() =>
                    setOpenCentros((prev) => ({
                      ...prev,
                      [centro.id]: !isOpen,
                    }))
                  }
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="size-4 shrink-0 text-muted-foreground/60" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-primary truncate">
                        {centro.nombre}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {centro.municipio} · {centro.locales.length} locales
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground/40 transition-transform print:hidden",
                      isOpen && "rotate-90",
                    )}
                  />
                </button>

                <div
                  className={cn(
                    "border-t border-border print:!block",
                    !isOpen && "hidden",
                  )}
                >
                    {/* Table header (desktop) */}
                    <div className="hidden grid-cols-[80px_1fr_1fr_140px_120px] gap-3 border-b border-border bg-gray-50/60 px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground/70 md:grid">
                      <span>Local</span>
                      <span>Negocio</span>
                      <span>Permiso</span>
                      <span>Vencimiento</span>
                      <span className="text-right">Estado</span>
                    </div>

                    <div className="divide-y divide-border">
                      {centro.locales.map((local) => (
                        <div
                          key={local.id}
                          className="grid grid-cols-1 gap-1 px-5 py-3 md:grid-cols-[80px_1fr_1fr_140px_120px] md:items-center md:gap-3"
                        >
                          <span className="text-[12px] font-medium text-primary">
                            {local.numero}
                          </span>
                          <span className="text-[12px] text-muted-foreground truncate">
                            {local.nombre_negocio ?? "—"}
                          </span>
                          <span className="text-[12px] text-muted-foreground truncate">
                            {tipoPermisoLabel(local.tipo_permiso) ?? "—"}
                          </span>
                          <span className="text-[12px] text-muted-foreground">
                            {local.fecha_vencimiento ? (
                              <>
                                {formatFecha(local.fecha_vencimiento)}
                                <span className="ml-1 text-[10.5px] text-muted-foreground/60">
                                  ({diasLabel(local.dias_restantes)})
                                </span>
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                          <span className="md:text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                ESTADO_BADGE[local.estado],
                              )}
                            >
                              {ESTADO_LABEL[local.estado]}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
              </Card>
            )
          })}
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border pt-6 text-center">
        <p className="text-[11.5px] text-muted-foreground">
          Gestionado por PermisoHub ·{" "}
          <a
            href="mailto:contacto@permisohub.cl"
            className="font-medium text-primary hover:underline"
          >
            contacto@permisohub.cl
          </a>{" "}
          · © 2026
        </p>
      </footer>
    </main>
  )
}
