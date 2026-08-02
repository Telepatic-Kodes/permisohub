"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KpiCard } from "@/components/mercado-inmobiliario/charts/kpi-card"
import { RankingBarChart, type ItemRanking } from "@/components/mercado-inmobiliario/charts/ranking-bar-chart"

interface ReporteKpi {
  label: string
  value: string
  trend: string
  context: string
  verificado: boolean
}

interface ReporteMercado {
  kpis: ReporteKpi[]
  recomendacion: { accion: string; texto: string }
  zona: { descripcion: string; flujo: string; tendencia: string }
  rubros: { nombre: string; demanda: string; precio: string; observacion: string }[]
  riesgos: string[]
  oportunidades: string[]
  fuentes: string[]
  historialPrecio: number[]
}

const DEMANDA_COLOR: Record<string, string> = {
  Alta: "var(--blueprint)",
  Media: "color-mix(in oklch, var(--blueprint) 60%, var(--muted-foreground))",
  Baja: "var(--muted-foreground)",
}

// El precio del rubro viene como rango de texto ("0.55–0.75") del reporte de
// IA — se parsea el punto medio para poder rankear, nunca se inventa un
// número que el reporte no entregó.
function precioMedioRubro(precio: string): number {
  const numeros = precio.match(/[\d.]+/g)?.map(Number) ?? []
  if (numeros.length === 0) return 0
  return numeros.reduce((a, b) => a + b, 0) / numeros.length
}

function ReportesPageInner() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reporte, setReporte] = useState<ReporteMercado | null>(null)

  const [form, setForm] = useState({
    comuna: searchParams.get("comuna") ?? "",
    tipo: "",
    rubro: "",
    perfil: "",
  })

  function setField(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.comuna) {
      setError("Comuna requerida")
      return
    }

    setLoading(true)
    setError(null)
    setReporte(null)

    try {
      const res = await fetch("/api/reportes-mercado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as ReporteMercado & { ok?: boolean; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "Error del servidor")
      setReporte(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📊"
        title="Reportes de Mercado"
        subtitle="Inteligencia de zona y rubro — precio anclado en datos reales cuando la comuna está cubierta"
        breadcrumbs={[{ label: "Reportes" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-lg border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Zona y perfil
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Comuna *</Label>
                    <Input value={form.comuna} onChange={(e) => setField("comuna", e.target.value)} placeholder="ej: Providencia" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de local</Label>
                    <Input value={form.tipo} onChange={(e) => setField("tipo", e.target.value)} placeholder="ej: local de calle, strip center" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rubro objetivo</Label>
                    <Input value={form.rubro} onChange={(e) => setField("rubro", e.target.value)} placeholder="opcional — ej: gastronomía" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Perfil del inversor</Label>
                    <Input value={form.perfil} onChange={(e) => setField("perfil", e.target.value)} placeholder="opcional — renta, plusvalía, uso propio" />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-primary/90 w-full sm:w-auto">
                  {loading ? (
                    <><Loader2 className="size-4 animate-spin" /> Generando reporte…</>
                  ) : (
                    <><TrendingUp className="size-4" /> Generar reporte</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {reporte && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {reporte.kpis.map((kpi, i) => {
                  const esPrecio = /precio/i.test(kpi.label)
                  return (
                    <KpiCard
                      key={i}
                      label={kpi.label}
                      valor={kpi.value}
                      verificado={kpi.verificado}
                      sparkline={esPrecio ? reporte.historialPrecio : undefined}
                      contexto={[kpi.trend, kpi.context].filter(Boolean).join(" — ")}
                    />
                  )
                })}
              </div>

              <Card className="rounded-lg border-line-fine">
                <CardContent className="p-5">
                  <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
                    Recomendación · {reporte.recomendacion.accion}
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{reporte.recomendacion.texto}</p>
                </CardContent>
              </Card>

              <Card className="rounded-lg border-line-fine">
                <CardContent className="p-5 space-y-2">
                  <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Zona · flujo {reporte.zona.flujo}
                  </p>
                  <p className="text-sm text-foreground/80">{reporte.zona.descripcion}</p>
                  <p className="text-xs text-muted-foreground">{reporte.zona.tendencia}</p>
                </CardContent>
              </Card>

              <RankingBarChart
                titulo="Rubros por precio (UF/m²/mes) — color = demanda"
                formatValor={(n) => n.toFixed(2)}
                items={reporte.rubros.map(
                  (r): ItemRanking => ({
                    label: r.nombre,
                    valor: precioMedioRubro(r.precio),
                    color: DEMANDA_COLOR[r.demanda] ?? "var(--blueprint)",
                  }),
                )}
              />

              <div className="overflow-hidden rounded-lg border border-line-fine bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-fine text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-technical font-medium">Rubro</th>
                      <th className="px-4 py-2.5 text-left font-technical font-medium">Demanda</th>
                      <th className="px-4 py-2.5 text-left font-technical font-medium">Precio (UF/m²/mes)</th>
                      <th className="px-4 py-2.5 text-left font-technical font-medium">Observación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-fine">
                    {reporte.rubros.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-primary">{r.nombre}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.demanda}</td>
                        <td className="num px-4 py-2 text-muted-foreground">{r.precio}</td>
                        <td className="px-4 py-2 text-muted-foreground">{r.observacion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card className="rounded-lg border-line-fine">
                  <CardContent className="p-4">
                    <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">Riesgos</p>
                    <ul className="space-y-1.5 text-sm text-foreground/80">
                      {reporte.riesgos.map((r, i) => <li key={i}>· {r}</li>)}
                    </ul>
                  </CardContent>
                </Card>
                <Card className="rounded-lg border-line-fine">
                  <CardContent className="p-4">
                    <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">Oportunidades</p>
                    <ul className="space-y-1.5 text-sm text-foreground/80">
                      {reporte.oportunidades.map((o, i) => <li key={i}>· {o}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {reporte.fuentes.length > 0 && (
                <p className="text-xs text-muted-foreground">Fuentes: {reporte.fuentes.join(" · ")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReportesMercadoPage() {
  return (
    <Suspense>
      <ReportesPageInner />
    </Suspense>
  )
}
