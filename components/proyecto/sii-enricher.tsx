"use client"

import { useState } from "react"
import { Building2, Loader2, Search, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SIIData } from "@/lib/sii-lookup"

interface SIIEnricherProps {
  /** Called when SII data is fetched — parent should pre-fill form fields */
  onEnrich: (data: SIIData) => void
  /**
   * Comuna del predio. OBLIGATORIA para consultar: el endpoint del SII resuelve
   * por código de comuna. Hasta el 06-08 este prop existía y no se usaba — la
   * consulta viajaba solo con el rol y el servidor asumía Región Metropolitana.
   */
  municipio?: string
  /** Texto del botón "Aplicar" — el default asume un formulario de proyecto */
  applyLabel?: string
}

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

interface LookupAPIResponse {
  ok: boolean
  rol?: string
  data?: {
    direccion_normalizada: string
    comuna: string
    destino: string
    avaluo_fiscal_clp: number | null
    avaluo_fiscal_uf: number | null
    lat: number | null
    lng: number | null
  }
  error?: string
}

export function SIIEnricher({ onEnrich, municipio, applyLabel = "Aplicar al proyecto" }: SIIEnricherProps) {
  const [rol, setRol] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SIIData | null>(null)

  const handleSearch = async () => {
    const trimmed = rol.trim()
    if (!trimmed || !municipio) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({ rol: trimmed, comuna: municipio })
      const res = await fetch(`/api/sii/lookup?${params.toString()}`)
      const json = (await res.json()) as LookupAPIResponse

      if (!json.ok || !json.data) {
        setError(json.error ?? "No se encontraron datos para ese rol.")
        return
      }

      // Sin `?? 0`: un avalúo ausente no es un avalúo de cero pesos. Antes se
      // coercía y la ficha mostraba "$0" como si fuera el dato del SII.
      const mapped: SIIData = {
        rol: json.rol ?? trimmed,
        avaluo_fiscal_clp: json.data.avaluo_fiscal_clp,
        avaluo_fiscal_uf: json.data.avaluo_fiscal_uf,
        destino: json.data.destino,
        direccion_normalizada: json.data.direccion_normalizada,
        comuna: json.data.comuna,
        lat: json.data.lat,
        lng: json.data.lng,
      }
      setResult(mapped)
    } catch {
      setError("Error de conexión. Intenta nuevamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (result) onEnrich(result)
  }

  const handleClear = () => {
    setResult(null)
    setError(null)
    setRol("")
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-primary shrink-0" />
        <p className="text-sm font-medium">Datos SII del predio</p>
        <span className="text-xs text-muted-foreground">(opcional)</span>
      </div>

      {!result ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="rol-sii" className="text-xs text-muted-foreground">
              Rol SII
            </Label>
            <div className="flex gap-2">
              <Input
                id="rol-sii"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                placeholder="Ej: 1234-056"
                className="h-9 text-sm font-mono"
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleSearch()}
                disabled={loading || !rol.trim() || !municipio}
                className="shrink-0"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {municipio
                ? `Busca por el rol del predio en ${municipio}. El SII no publica superficies: esas van a mano.`
                : "Selecciona primero la comuna — el SII busca el rol dentro de una comuna."}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <TriangleAlert className="size-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <span className="text-muted-foreground">Rol SII</span>
            <span className="font-mono font-medium">{result.rol}</span>

            <span className="text-muted-foreground">Destino</span>
            <span className="capitalize">{result.destino.toLowerCase()}</span>

            {result.avaluo_fiscal_clp !== null && (
              <>
                <span className="text-muted-foreground">Avalúo fiscal</span>
                <span className="font-medium">{CLP.format(result.avaluo_fiscal_clp)}</span>
              </>
            )}

            {result.avaluo_fiscal_uf !== null && result.avaluo_fiscal_uf > 0 && (
              <>
                <span className="text-muted-foreground">Avalúo fiscal (UF)</span>
                <span className="font-medium">{result.avaluo_fiscal_uf.toLocaleString("es-CL")} UF</span>
              </>
            )}

            {result.direccion_normalizada && (
              <>
                <span className="text-muted-foreground">Dirección SII</span>
                <span className="leading-snug">{result.direccion_normalizada}</span>
              </>
            )}

            {result.comuna && (
              <>
                <span className="text-muted-foreground">Comuna SII</span>
                <span className="leading-snug">{result.comuna}</span>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={handleApply} className="flex-1 text-xs">
              {applyLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClear}
              aria-label="Limpiar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
