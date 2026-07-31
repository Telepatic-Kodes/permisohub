"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fixMojibakeArcGIS } from "@/lib/zonificacion-format"

interface ComunaOption { comunaId: string; tier: string }
interface ZonaOption { zona: string; nombre: string }

interface ZonificacionManualFallbackProps {
  proyectoId: string
  onApplied: () => void | Promise<void>
}

export function ZonificacionManualFallback({ proyectoId, onApplied }: ZonificacionManualFallbackProps) {
  const [comunas, setComunas] = useState<ComunaOption[]>([])
  const [comunaId, setComunaId] = useState("")
  const [zonas, setZonas] = useState<ZonaOption[]>([])
  const [zona, setZona] = useState("")
  const [loadingZonas, setLoadingZonas] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/zonificacion/zonas")
      .then((r) => r.json())
      .then((data: { comunas?: ComunaOption[] }) => setComunas(data.comunas ?? []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    setZona("")
    if (!comunaId) { setZonas([]); return }
    setLoadingZonas(true)
    fetch(`/api/zonificacion/zonas?comuna=${encodeURIComponent(comunaId)}`)
      .then((r) => r.json())
      .then((data: { zonas?: ZonaOption[] }) => setZonas(data.zonas ?? []))
      .catch(() => toast.error("No se pudo cargar el listado de zonas"))
      .finally(() => setLoadingZonas(false))
  }, [comunaId])

  async function handleConfirmar() {
    if (!comunaId || !zona) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/zonificacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: { comunaId, zona } }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo guardar la selección manual")
        return
      }
      await onApplied()
      toast.success("Zona confirmada manualmente")
    } catch {
      toast.error("No se pudo guardar la selección manual")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <p className="text-xs font-medium text-primary">Seleccionar zona manualmente</p>
      <p className="text-[11px] text-muted-foreground">
        Disponible solo para comunas con cobertura ({comunas.map((c) => c.comunaId).join(", ") || "cargando…"}). Para otras comunas, consulta el CIP directamente.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={comunaId} onValueChange={(v) => setComunaId(v as string)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Comuna" /></SelectTrigger>
          <SelectContent>
            {comunas.map((c) => (
              <SelectItem key={c.comunaId} value={c.comunaId} className="text-xs">{c.comunaId}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={zona} onValueChange={(v) => setZona(v as string)} disabled={!comunaId || loadingZonas}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={loadingZonas ? "Cargando…" : "Zona"} /></SelectTrigger>
          <SelectContent>
            {zonas.map((z) => (
              <SelectItem key={z.zona} value={z.zona} className="text-xs">
                {z.zona} — {fixMojibakeArcGIS(z.nombre)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        size="sm"
        className="h-7 text-xs"
        disabled={!comunaId || !zona || submitting}
        onClick={() => void handleConfirmar()}
      >
        {submitting ? "Guardando…" : "Confirmar selección"}
      </Button>
    </div>
  )
}
