"use client"

import { useEffect, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  ShieldAlert,
  Stamp,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ObservacionActa {
  numero: number
  materia: string
  articulo: string
  severidad: "crítica" | "media" | "menor"
  observacion: string
  fundamento: string
  comoSubsanar: string
}

interface ActaResult {
  ok: boolean
  expediente: string
  municipio: string
  riesgoGlobal: "BAJO" | "MEDIO" | "ALTO"
  probabilidadAprobacion: number
  resumen: string
  observaciones: ObservacionActa[]
  veredicto: string
  error?: string
}

interface ProyectoLite {
  id: string
  nombre: string
  municipio: string
  numero_expediente: string | null
}

const RIESGO_CONFIG = {
  BAJO: { color: "text-green-700", chip: "bg-green-100 border-green-300", label: "Riesgo bajo", border: "#16a34a", icon: CheckCircle2 },
  MEDIO: { color: "text-amber-700", chip: "bg-amber-100 border-amber-300", label: "Riesgo medio", border: "#f59e0b", icon: AlertCircle },
  ALTO: { color: "text-red-700", chip: "bg-red-100 border-red-300", label: "Riesgo alto", border: "#ef4444", icon: ShieldAlert },
}

const SEVERIDAD_CONFIG: Record<ObservacionActa["severidad"], { label: string; dot: string; badge: string; Icon: typeof AlertTriangle }> = {
  "crítica": { label: "Crítica", dot: "#ef4444", badge: "bg-red-50 text-red-700 border-red-200", Icon: ShieldAlert },
  "media": { label: "Media", dot: "#f59e0b", badge: "bg-amber-50 text-amber-700 border-amber-200", Icon: AlertTriangle },
  "menor": { label: "Menor", dot: "#64748b", badge: "bg-slate-50 text-slate-600 border-slate-200", Icon: AlertCircle },
}

export default function PreRevisionPage() {
  const [proyectos, setProyectos] = useState<ProyectoLite[]>([])
  const [proyectoId, setProyectoId] = useState<string>("")
  const [loadingList, setLoadingList] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ActaResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch("/api/proyectos")
        const json = (await res.json()) as { data?: ProyectoLite[] }
        if (active) setProyectos(json.data ?? [])
      } catch {
        if (active) setProyectos([])
      } finally {
        if (active) setLoadingList(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function handleGenerar() {
    if (!proyectoId) {
      setError("Selecciona un proyecto para pre-revisar")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/ai/pre-revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId }),
      })
      const data = (await res.json()) as ActaResult
      if (!res.ok || data.error) throw new Error(data.error ?? "Error del servidor")
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🗂️"
        title="Pre-revisión DOM"
        subtitle="El acta de observaciones que recibirías — antes de ingresar el expediente"
        breadcrumbs={[{ label: "Herramientas" }, { label: "Pre-revisión DOM" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Simula la revisión de la DOM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Elegimos las observaciones más probables según la normativa OGUC y el historial real
                de la DOM del municipio. Súbsanalas antes de ingresar y llega con el expediente limpio.
              </p>
              <div className="space-y-1.5">
                <Label>Proyecto a pre-revisar</Label>
                <Select value={proyectoId} onValueChange={(v) => setProyectoId(v ?? "")} disabled={loadingList}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingList ? "Cargando proyectos…" : "Selecciona un proyecto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} · {p.municipio}
                        {p.numero_expediente ? ` · Exp. ${p.numero_expediente}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!loadingList && proyectos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No tienes proyectos aún. Crea uno para pre-revisarlo.
                  </p>
                )}
              </div>

              <Button
                onClick={() => void handleGenerar()}
                disabled={loading || !proyectoId}
                className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Revisando expediente con IA…
                  </>
                ) : (
                  <>
                    <Stamp className="size-4" /> Generar acta simulada
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Encabezado del acta */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(() => {
                  const cfg = RIESGO_CONFIG[result.riesgoGlobal]
                  const Icon = cfg.icon
                  return (
                    <div
                      className="relative overflow-hidden rounded-xl border bg-white p-5 sm:col-span-2"
                      style={{ boxShadow: "var(--shadow-card)", borderLeftWidth: "4px", borderLeftColor: cfg.border }}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Acta de observaciones simulada
                      </p>
                      <div className="flex items-center gap-3">
                        <div className={cn("flex size-10 items-center justify-center rounded-lg", cfg.chip)}>
                          <Icon className={cn("size-5", cfg.color)} />
                        </div>
                        <div>
                          <p className={cn("heading-section text-2xl font-bold", cfg.color)}>{cfg.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {result.expediente} · {result.municipio} · {result.observaciones.length} observaciones
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <div
                  className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary/4 p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary/50">
                    Aprobación sin subsanar
                  </p>
                  <div className="mt-1 flex items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileCheck2 className="size-5 text-primary" />
                    </div>
                    <p className="heading-section text-2xl font-bold text-primary tabular-nums">
                      {result.probabilidadAprobacion}%
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-primary/50">probabilidad en 1ª revisión</p>
                </div>
              </div>

              {/* Resumen */}
              <div className="rounded-xl border border-border bg-white px-5 py-4" style={{ boxShadow: "var(--shadow-card)" }}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Considerandos
                </p>
                <p className="text-sm leading-relaxed text-foreground/80">{result.resumen}</p>
              </div>

              {/* Observaciones */}
              <div className="overflow-hidden rounded-xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="border-b border-border px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Observaciones
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">Ordenadas por severidad</p>
                </div>

                <div className="divide-y divide-border">
                  {result.observaciones.map((o) => {
                    const sev = SEVERIDAD_CONFIG[o.severidad] ?? SEVERIDAD_CONFIG.menor
                    const SevIcon = sev.Icon
                    return (
                      <div key={o.numero} className="px-5 py-4 transition-colors hover:bg-muted/30">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-wrap items-start gap-2">
                            <span className="mt-0.5 shrink-0 font-mono text-[11px] text-muted-foreground/40">
                              #{o.numero}
                            </span>
                            <span className="text-sm font-semibold text-primary">{o.materia}</span>
                            <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {o.articulo}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              sev.badge,
                            )}
                          >
                            <SevIcon className="size-3" /> {sev.label}
                          </span>
                        </div>

                        <p className="mb-2 text-sm leading-relaxed text-foreground/80">{o.observacion}</p>

                        {o.fundamento && (
                          <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                            <span className="font-semibold text-muted-foreground/70">Fundamento: </span>
                            {o.fundamento}
                          </p>
                        )}

                        <div className="flex items-start gap-2 rounded-lg border border-primary/8 bg-primary/4 px-3 py-2">
                          <span className="mt-px shrink-0 text-[10px] font-bold uppercase tracking-wide text-primary/60">
                            Subsanar
                          </span>
                          <p className="text-xs leading-relaxed text-primary/80">{o.comoSubsanar}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Veredicto */}
              {result.veredicto && (
                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p className="text-sm leading-relaxed text-primary/90">{result.veredicto}</p>
                </div>
              )}

              <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
                Acta simulada por IA con fines preventivos. No constituye una resolución oficial de la
                Dirección de Obras Municipales; la revisión definitiva la realiza el profesional competente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
