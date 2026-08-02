"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Loader2, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts"

interface BandasPricing {
  comuna: string
  usoFallback: boolean
  muestraN: number
  p25Uf: number | null
  medianaUf: number | null
  p75Uf: number | null
  muestraAreaN: number
  p25UfM2: number | null
  medianaUfM2: number | null
  p75UfM2: number | null
}

type TipoPropiedadComercial = "local_comercial" | "oficina" | "bodega" | "industrial"

const TIPOS_PROPIEDAD: { value: TipoPropiedadComercial; label: string }[] = [
  { value: "local_comercial", label: "Local comercial" },
  { value: "oficina", label: "Oficina" },
  { value: "bodega", label: "Bodega" },
  { value: "industrial", label: "Nave industrial" },
]

// Mismo universo de comunas que lib/scrapers/mercado-locales-common.ts
// (MERCADO_LOCALES_COMUNA_SLUGS) — duplicado acá como lista simple para no
// importar código server-only (createServiceClient) al bundle del cliente.
// Mantener en sync si se agregan comunas nuevas (última sync: Fase 8, 36 comunas).
const COMUNAS_MERCADO_LOCALES = [
  "Santiago Centro", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea",
  "Ñuñoa", "La Reina", "Macul", "Peñalolén", "La Florida", "Maipú",
  "San Miguel", "Estación Central", "Huechuraba", "Quilicura", "Recoleta",
  "San Bernardo", "Puente Alto", "La Cisterna", "San Joaquín", "El Bosque",
  "Pedro Aguirre Cerda", "Cerrillos", "Independencia", "Conchalí", "Renca",
  "Pudahuel", "Quinta Normal", "Lo Prado", "Cerro Navia", "San Ramón",
  "La Granja", "Colina", "Lampa", "Buin", "Padre Hurtado",
]

function BandaPrecioChart({
  bandas,
  precioReferenciaUf,
  tipoPropiedadLabel,
}: {
  bandas: BandasPricing
  precioReferenciaUf: number | null
  tipoPropiedadLabel: string
}) {
  if (bandas.p25Uf === null || bandas.medianaUf === null || bandas.p75Uf === null) return null

  const data = [
    { name: "P25", valor: bandas.p25Uf },
    { name: "Mediana", valor: bandas.medianaUf },
    { name: "P75", valor: bandas.p75Uf },
  ]

  return (
    <Card className="rounded-lg border-line-fine">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Banda de precio real · {tipoPropiedadLabel} · {bandas.usoFallback ? "Región Metropolitana (respaldo)" : bandas.comuna}
          </p>
          <span className="text-[11px] text-muted-foreground/70">N={bandas.muestraN}</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line-fine)" />
            <XAxis type="number" tick={{ fontSize: 11 }} unit=" UF" stroke="var(--line-fine)" />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} stroke="var(--line-fine)" />
            <Bar dataKey="valor" fill="var(--blueprint)" radius={[0, 3, 3, 0]} />
            {precioReferenciaUf && precioReferenciaUf > 0 && (
              <ReferenceLine
                x={precioReferenciaUf}
                stroke="var(--primary)"
                strokeDasharray="4 4"
                label={{ value: "Tu referencia", position: "top", fontSize: 11, fill: "var(--primary)" }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
        {bandas.muestraAreaN > 0 && bandas.p25UfM2 !== null && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            UF/m² (N={bandas.muestraAreaN}): P25 {bandas.p25UfM2?.toFixed(2)} · Mediana {bandas.medianaUfM2?.toFixed(2)} · P75 {bandas.p75UfM2?.toFixed(2)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function PricingPageInner() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [bandas, setBandas] = useState<BandasPricing | null>(null)

  const [form, setForm] = useState({
    comuna: searchParams.get("comuna") ?? "",
    operacion: (searchParams.get("operacion") as "arriendo" | "venta") ?? "arriendo",
    tipoPropiedad: (searchParams.get("tipoPropiedad") as TipoPropiedadComercial) ?? "local_comercial",
    precioReferenciaUf: "",
  })

  function setField(k: keyof typeof form, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.comuna) {
      setError("Selecciona una comuna")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setStreamingText("")
    setBandas(null)

    try {
      const response = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const err = (await response.json()) as { error?: string }
        throw new Error(err.error ?? "Error del servidor")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string; bandas?: BandasPricing }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.bandas) setBandas(parsed.bandas)
            if (parsed.text) {
              accumulated += parsed.text
              setStreamingText(accumulated)
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== data) throw parseErr
          }
        }
      }

      setResult(accumulated)
      setStreamingText("")
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
        title="Pricing de Locales"
        subtitle="Bandas de precio reales, calculadas a diario desde locales comerciales activos"
        breadcrumbs={[{ label: "Pricing" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-lg border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Comuna y operación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Comuna *</Label>
                    <Select value={form.comuna} onValueChange={(v) => v && setField("comuna", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona comuna" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMUNAS_MERCADO_LOCALES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo de propiedad</Label>
                    <Select value={form.tipoPropiedad} onValueChange={(v) => v && setField("tipoPropiedad", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_PROPIEDAD.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Operación</Label>
                    <Select value={form.operacion} onValueChange={(v) => v && setField("operacion", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arriendo">Arriendo</SelectItem>
                        <SelectItem value="venta">Venta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Precio de referencia (UF)</Label>
                    <Input
                      type="number"
                      placeholder="opcional"
                      value={form.precioReferenciaUf}
                      onChange={(e) => setField("precioReferenciaUf", e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-primary/90 w-full sm:w-auto">
                  {loading ? (
                    <><Loader2 className="size-4 animate-spin" /> Consultando bandas…</>
                  ) : (
                    <><TrendingUp className="size-4" /> Ver pricing</>
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

          {bandas && (
            <BandaPrecioChart
              bandas={bandas}
              precioReferenciaUf={Number(form.precioReferenciaUf) || null}
              tipoPropiedadLabel={TIPOS_PROPIEDAD.find((t) => t.value === form.tipoPropiedad)?.label ?? "Local comercial"}
            />
          )}

          {(streamingText || result) && (
            <div className="rounded-lg border border-line-fine bg-card px-5 py-4">
              <MarkdownRenderer content={result ?? streamingText} />
              {loading && <span className="inline-block w-1 h-4 bg-[var(--blueprint)] animate-pulse ml-0.5 align-middle" />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingPageInner />
    </Suspense>
  )
}
