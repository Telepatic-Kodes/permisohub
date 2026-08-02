"use client"

import { useState } from "react"
import { AlertCircle, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { InformeEjecutivo } from "@/components/mercado-inmobiliario/informe-ejecutivo"
import { leerEventosSSE } from "@/lib/sse-client"
import type { ResumenOportunidadContexto } from "@/lib/resumen-oportunidad-prompts"

interface ResumenTabProps {
  contexto: ResumenOportunidadContexto
}

export function ResumenTab({ contexto }: ResumenTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [result, setResult] = useState<string | null>(null)

  async function handleGenerar() {
    setLoading(true)
    setError(null)
    setResult(null)
    setStreamingText("")

    try {
      const response = await fetch("/api/oportunidades-resumen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contexto),
      })

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Error del servidor")
      }

      let accumulated = ""
      for await (const data of leerEventosSSE(response)) {
        const parsed = JSON.parse(data) as { text?: string; error?: string }
        if (parsed.error) throw new Error(parsed.error)
        if (parsed.text) {
          accumulated += parsed.text
          setStreamingText(accumulated)
        }
      }

      setResult(accumulated)
      setStreamingText("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el resumen — intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (!result && !streamingText && !loading && !error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-line-fine bg-card p-8 text-center">
        <Sparkles className="size-6 text-muted-foreground/50" />
        <p className="max-w-md text-sm text-muted-foreground">
          Genera un resumen ejecutivo narrado por IA a partir de los datos reales ya calculados de esta ficha
          (posicionamiento, historial, comparables) — no se genera automáticamente.
        </p>
        <Button onClick={() => void handleGenerar()} className="bg-primary text-white hover:bg-primary/90">
          <Sparkles className="size-4" /> Generar resumen ejecutivo
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="size-5 shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-2">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void handleGenerar()}>
              Reintentar
            </Button>
          </div>
        </div>
      )}

      {loading && !streamingText && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Generando resumen…
        </div>
      )}

      {result ? (
        <>
          <InformeEjecutivo
            content={result}
            fuentes={[
              { label: `Muestra de ${contexto.muestraN} avisos`, disponible: contexto.muestraN > 0 },
              { label: "Comparables reales", disponible: contexto.comparables.length > 0 },
              { label: "Rentabilidad de zona", disponible: contexto.rentabilidadZonaPct !== null },
            ]}
          />
          <Button variant="outline" size="sm" onClick={() => void handleGenerar()}>
            <Sparkles className="size-3.5" /> Regenerar
          </Button>
        </>
      ) : (
        streamingText && (
          <div className="rounded-lg border border-line-fine bg-card px-5 py-4">
            <MarkdownRenderer content={streamingText} />
            {loading && <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-[var(--blueprint)] align-middle" />}
          </div>
        )
      )}
    </div>
  )
}
