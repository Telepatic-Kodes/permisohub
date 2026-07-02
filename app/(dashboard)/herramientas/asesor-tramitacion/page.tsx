"use client"

import { useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Loader2,
  Route,
  ShieldAlert,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Viabilidad = "sí" | "con condiciones" | "no"
type CostoRelativo = "bajo" | "medio" | "alto"

interface ViaTramitacion {
  nombre: string
  viable: Viabilidad
  tiempoEstimado: string
  costoRelativo: CostoRelativo
  requisitos: string[]
  pros: string[]
  contras: string[]
  fundamento: string
}

interface AsesorResult {
  ok: boolean
  viaRecomendada: string
  vias: ViaTramitacion[]
  estrategia: string
  pasos: { orden: number; accion: string; porque: string }[]
  riesgos: string[]
  ddu: { codigo: string; porque: string }[]
  advertencia: string
  error?: string
}

const VIABILIDAD_CFG: Record<Viabilidad, { label: string; badge: string; dot: string }> = {
  "sí": { label: "Viable", badge: "bg-green-50 text-green-700 border-green-200", dot: "#16a34a" },
  "con condiciones": { label: "Con condiciones", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "#f59e0b" },
  "no": { label: "No viable", badge: "bg-red-50 text-red-700 border-red-200", dot: "#ef4444" },
}

const COSTO_CFG: Record<CostoRelativo, { label: string; color: string }> = {
  bajo: { label: "Costo bajo", color: "text-green-700" },
  medio: { label: "Costo medio", color: "text-amber-700" },
  alto: { label: "Costo alto", color: "text-red-700" },
}

export default function AsesorTramitacionPage() {
  const [situacion, setSituacion] = useState("")
  const [objetivo, setObjetivo] = useState("")
  const [restricciones, setRestricciones] = useState("")
  const [municipio, setMunicipio] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AsesorResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAsesorar() {
    if (situacion.trim().length < 20) {
      setError("Describe la situación con al menos un par de frases")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/ai/asesor-tramitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situacion,
          objetivo: objetivo.trim() || undefined,
          restricciones: restricciones.trim() || undefined,
          municipio: municipio.trim() || undefined,
        }),
      })
      const data = (await res.json()) as AsesorResult
      if (!res.ok || data.error) throw new Error(data.error ?? "Error del servidor")
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  const isRecomendada = (nombre: string) =>
    result?.viaRecomendada && nombre.toLowerCase().includes(result.viaRecomendada.toLowerCase().slice(0, 12))

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🧭"
        title="Asesor de tramitación"
        subtitle="Qué vía conviene — no solo qué dice la norma. Pondera costo y tiempo del cliente"
        breadcrumbs={[{ label: "Herramientas" }, { label: "Asesor de tramitación" }]}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Describe el caso y tu objetivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Comparamos las vías de tramitación de la más liviana a la más pesada, evaluando si una
                vía menor (regularización, obra menor, cambio de destino, 512) es alcanzable antes de
                escalar a un permiso de alteración caro y lento.
              </p>

              <div className="space-y-1.5">
                <Label>Situación del proyecto</Label>
                <textarea
                  value={situacion}
                  onChange={(e) => setSituacion(e.target.value)}
                  placeholder="Ej: Casa antigua en Kennedy que pasó a oficina y hoy es un petshop con peluquería y sala de eventos. Patente provisoria. Se modificó levemente la fachada (alero eliminado). El expediente lleva 3 años sin aprobarse."
                  className="min-h-28 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary/40"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Objetivo del cliente</Label>
                  <input
                    value={objetivo}
                    onChange={(e) => setObjetivo(e.target.value)}
                    placeholder="Ej: Sacar la patente como 512, evitar permiso de alteración"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Municipio (opcional)</Label>
                  <input
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    placeholder="Ej: Vitacura"
                    className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Restricciones (costo, tiempo, especialistas…)</Label>
                <textarea
                  value={restricciones}
                  onChange={(e) => setRestricciones(e.target.value)}
                  placeholder="Ej: El dueño no quiere invertir más ni contratar cálculo/constructor. El arrendatario se va si esto no sale pronto."
                  className="min-h-20 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary/40"
                />
              </div>

              <Button
                onClick={() => void handleAsesorar()}
                disabled={loading || situacion.trim().length < 20}
                className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Evaluando vías de tramitación…
                  </>
                ) : (
                  <>
                    <Compass className="size-4" /> Recomendar vía
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
              {/* Vía recomendada + estrategia */}
              {result.viaRecomendada && (
                <div
                  className="rounded-xl border border-primary/20 bg-primary/5 p-5"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary/50">
                    Vía recomendada
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <Route className="size-5 text-primary" />
                    </div>
                    <p className="heading-section text-xl font-bold text-primary">{result.viaRecomendada}</p>
                  </div>
                  {result.estrategia && (
                    <p className="mt-3 text-sm leading-relaxed text-foreground/80">{result.estrategia}</p>
                  )}
                </div>
              )}

              {/* Comparación de vías */}
              {result.vias.length > 0 && (
                <div className="grid gap-3 md:grid-cols-2">
                  {result.vias.map((v) => {
                    const via = VIABILIDAD_CFG[v.viable] ?? VIABILIDAD_CFG["con condiciones"]
                    const costo = COSTO_CFG[v.costoRelativo] ?? COSTO_CFG.medio
                    const rec = isRecomendada(v.nombre)
                    return (
                      <div
                        key={v.nombre}
                        className={cn(
                          "rounded-xl border bg-white p-4",
                          rec ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
                        )}
                        style={{ boxShadow: "var(--shadow-card)" }}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-primary">{v.nombre}</p>
                          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", via.badge)}>
                            {via.label}
                          </span>
                        </div>
                        <div className="mb-2 flex flex-wrap gap-3 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="size-3" /> {v.tiempoEstimado}
                          </span>
                          <span className={cn("inline-flex items-center gap-1 font-medium", costo.color)}>
                            <DollarSign className="size-3" /> {costo.label}
                          </span>
                        </div>
                        {v.requisitos.length > 0 && (
                          <p className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground">
                            <span className="font-semibold">Requisitos: </span>
                            {v.requisitos.join(" · ")}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <ul className="space-y-0.5 text-green-700">
                            {v.pros.map((p, i) => (
                              <li key={i}>+ {p}</li>
                            ))}
                          </ul>
                          <ul className="space-y-0.5 text-red-700/80">
                            {v.contras.map((c, i) => (
                              <li key={i}>− {c}</li>
                            ))}
                          </ul>
                        </div>
                        {v.fundamento && (
                          <p className="mt-2 border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground/70">
                            {v.fundamento}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pasos */}
              {result.pasos.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
                  <div className="border-b border-border px-5 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Plan de acción
                    </p>
                  </div>
                  <div className="divide-y divide-border">
                    {result.pasos.map((p) => (
                      <div key={p.orden} className="flex gap-3 px-5 py-3">
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {p.orden}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground/90">{p.accion}</p>
                          {p.porque && <p className="text-xs text-muted-foreground">{p.porque}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DDU + riesgos */}
              <div className="grid gap-3 sm:grid-cols-2">
                {result.ddu.length > 0 && (
                  <div className="rounded-xl border border-border bg-white p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Circulares DDU aplicables
                    </p>
                    <div className="space-y-2">
                      {result.ddu.map((d) => (
                        <div key={d.codigo} className="text-xs">
                          <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-semibold text-primary">
                            {d.codigo}
                          </span>
                          <span className="ml-2 text-muted-foreground">{d.porque}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.riesgos.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
                      <ShieldAlert className="size-3.5" /> Riesgos / a verificar
                    </p>
                    <ul className="space-y-1 text-xs text-amber-900/80">
                      {result.riesgos.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.advertencia && (
                <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-xs leading-relaxed text-muted-foreground">{result.advertencia}</p>
                </div>
              )}

              <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
                Asesoría preliminar generada por IA. La vía definitiva debe confirmarse con la DOM del
                municipio y el profesional competente antes de comprometer plazos con el cliente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
