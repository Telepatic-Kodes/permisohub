"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, Search } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { AvaluoFiscalCard } from "@/components/mercado-inmobiliario/avaluo-fiscal-card"
import { InformeEjecutivo } from "@/components/mercado-inmobiliario/informe-ejecutivo"
import { RankingBarChart } from "@/components/mercado-inmobiliario/charts/ranking-bar-chart"
import { extraerScoreLiquidez, extraerComparables } from "@/lib/informe-charts"
import type { SIILookupServerData } from "@/lib/sii-lookup-server"
import { leerEventosSSE } from "@/lib/sse-client"

const TIPOS_TERRENO = [
  "Sitio urbano", "Sitio eriazo", "Parcela", "Terreno agrícola", "Terreno con construcción a demoler",
]

function TasacionPageInner() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [avaluoFiscal, setAvaluoFiscal] = useState<SIILookupServerData | null>(null)

  const [form, setForm] = useState({
    direccion: searchParams.get("direccion") ?? "",
    comuna: searchParams.get("comuna") ?? "",
    superficieM2: "",
    tipo: TIPOS_TERRENO[0],
    zonificacion: "",
    estado: "",
    precioOferta: "",
    descripcion: "",
    rolSii: searchParams.get("rolSii") ?? "",
  })

  function setField(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.direccion || !form.comuna || !form.superficieM2) {
      setError("Dirección, comuna y superficie son obligatorios")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setStreamingText("")
    setStatus(null)
    setAvaluoFiscal(null)

    try {
      const response = await fetch("/api/tasacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const err = (await response.json()) as { error?: string }
        throw new Error(err.error ?? "Error del servidor")
      }

      let accumulated = ""

      for await (const data of leerEventosSSE(response)) {
        const parsed = JSON.parse(data) as { text?: string; status?: string; error?: string; avaluoFiscal?: SIILookupServerData }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.avaluoFiscal) setAvaluoFiscal(parsed.avaluoFiscal)
        if (parsed.status) setStatus(parsed.status)
        if (parsed.text) {
          accumulated += parsed.text
          setStreamingText(accumulated)
          setStatus(null)
        }
      }

      setResult(accumulated)
      setStreamingText("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🏛️"
        title="Tasación de Terreno"
        subtitle="Valor comercial + cruce de avalúo fiscal SII, con comparables verificados en vivo"
        breadcrumbs={[{ label: "Tasación" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-lg border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Datos del terreno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Dirección *</Label>
                    <Input placeholder="ej: Camino Real 1234" value={form.direccion} onChange={(e) => setField("direccion", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Comuna *</Label>
                    <Input placeholder="ej: San Bernardo" value={form.comuna} onChange={(e) => setField("comuna", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Superficie (m²) *</Label>
                    <Input type="number" placeholder="ej: 1200" value={form.superficieM2} onChange={(e) => setField("superficieM2", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo de terreno</Label>
                    <select
                      className="flex h-9 w-full rounded-lg border border-line-fine bg-card px-3 py-1 text-sm"
                      value={form.tipo}
                      onChange={(e) => setField("tipo", e.target.value)}
                    >
                      {TIPOS_TERRENO.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Rol SII</Label>
                    <Input placeholder="ej: 1234-56" value={form.rolSii} onChange={(e) => setField("rolSii", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Zonificación PRC</Label>
                    <Input placeholder="opcional" value={form.zonificacion} onChange={(e) => setField("zonificacion", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Estado del terreno</Label>
                    <Input placeholder="ej: eriazo, con cierre perimetral" value={form.estado} onChange={(e) => setField("estado", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Precio de oferta (UF)</Label>
                    <Input type="number" placeholder="opcional" value={form.precioOferta} onChange={(e) => setField("precioOferta", e.target.value)} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Notas adicionales</Label>
                    <Textarea
                      placeholder="ej: sucesión con 4 herederos, sin acuerdo previo"
                      value={form.descripcion}
                      onChange={(e) => setField("descripcion", e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Sin Rol SII, la sección de valor fiscal queda marcada &quot;sin datos verificados&quot; en vez de estimar un avalúo.
                </p>

                <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-primary/90 w-full sm:w-auto">
                  {loading ? (
                    <><Loader2 className="size-4 animate-spin" /> Tasando…</>
                  ) : (
                    <><Search className="size-4" /> Tasar terreno</>
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

          {avaluoFiscal && <AvaluoFiscalCard data={avaluoFiscal} />}

          {status && !streamingText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {status}
            </div>
          )}

          {result ? (
            (() => {
              const scoreLiquidez = extraerScoreLiquidez(result)
              const comparables = extraerComparables(result)
              return (
                <>
                  {(scoreLiquidez || comparables) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {scoreLiquidez && (
                        <RankingBarChart
                          titulo="Score de liquidez por dimensión (1–5)"
                          items={scoreLiquidez.map((d) => ({ label: d.dimension, valor: d.score }))}
                          formatValor={(n) => `${n}/5`}
                        />
                      )}
                      {comparables && (
                        <RankingBarChart
                          titulo="Comparables — UF/m² ajustado"
                          items={comparables.map((c) => ({ label: c.label, valor: c.ufM2Ajustado }))}
                          formatValor={(n) => n.toFixed(2)}
                        />
                      )}
                    </div>
                  )}
                  <InformeEjecutivo
                    content={result}
                    fuentes={[
                      { label: "Avalúo fiscal SII", disponible: avaluoFiscal !== null },
                      { label: "Búsqueda web en vivo", disponible: true },
                    ]}
                  />
                </>
              )
            })()
          ) : (
            streamingText && (
              <div className="rounded-lg border border-line-fine bg-card px-5 py-4">
                <MarkdownRenderer content={streamingText} />
                {loading && <span className="inline-block w-1 h-4 bg-[var(--blueprint)] animate-pulse ml-0.5 align-middle" />}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function TasacionPage() {
  return (
    <Suspense>
      <TasacionPageInner />
    </Suspense>
  )
}
