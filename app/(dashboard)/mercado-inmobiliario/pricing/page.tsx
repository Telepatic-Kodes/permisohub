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

// Mismo universo de comunas que lib/scrapers/mercado-locales-common.ts
// (MERCADO_LOCALES_COMUNA_SLUGS) — duplicado acá como lista simple para no
// importar código server-only (createServiceClient) al bundle del cliente.
// Mantener en sync si se agregan comunas nuevas.
const COMUNAS_MERCADO_LOCALES = [
  "Santiago Centro", "Providencia", "Las Condes", "Vitacura", "Lo Barnechea",
  "Ñuñoa", "La Reina", "Macul", "Peñalolén", "La Florida", "Maipú",
  "San Miguel", "Estación Central", "Huechuraba", "Quilicura", "Recoleta",
]

function PricingPageInner() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [result, setResult] = useState<string | null>(null)

  const [form, setForm] = useState({
    comuna: searchParams.get("comuna") ?? "",
    operacion: (searchParams.get("operacion") as "arriendo" | "venta") ?? "arriendo",
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
            const parsed = JSON.parse(data) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
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
        breadcrumbs={[{ label: "Mercado Inmobiliario" }, { label: "Pricing" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-[4px] border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Comuna y operación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          {(streamingText || result) && (
            <div className="rounded-[4px] border border-line-fine bg-card px-5 py-4 text-sm leading-relaxed text-foreground/80" style={{ whiteSpace: "pre-wrap" }}>
              {result ?? streamingText}
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
