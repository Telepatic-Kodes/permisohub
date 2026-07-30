"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Proyecto } from "@/types"
import { fixMojibakeArcGIS } from "@/lib/zonificacion-format"
import { ZonificacionMapa, type ZonaPolygon } from "./zonificacion-mapa"
import { ZonificacionDisclaimer } from "./zonificacion-disclaimer"
import { ZonificacionManualFallback } from "./zonificacion-manual-fallback"
import { UsoCompatibleCheck } from "./uso-compatible-check"

interface ZonificacionCardProps {
  proyecto: Proyecto
  onUpdated: (proyecto: Proyecto) => void
}

interface ZonaGeoResponse {
  ok: boolean
  lat: number | null
  lng: number | null
  geometria: ZonaPolygon | null
}

export function ZonificacionCard({ proyecto, onUpdated }: ZonificacionCardProps) {
  const [geo, setGeo] = useState<ZonaGeoResponse | null>(null)
  const [actualizando, setActualizando] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/proyectos/${proyecto.id}/zonificacion`)
      .then((r) => r.json())
      .then((data: ZonaGeoResponse) => { if (!cancelled) setGeo(data) })
      .catch(() => undefined)
    return () => { cancelled = true }
    // zona_consultada_el changes on every successful auto/manual lookup — this
    // is what makes the polygon re-fetch after "Actualizar" or a manual pick.
    // [proyecto.id] alone would never re-run (plan-checker blocker: the map
    // showed stale data forever after the first mount otherwise).
  }, [proyecto.id, proyecto.zona_consultada_el])

  const status = proyecto.zona_status ?? "pendiente"

  async function refetchProyecto() {
    const data = await fetch(`/api/proyectos/${proyecto.id}`).then((r) => r.json())
    if (data.proyecto) onUpdated(data.proyecto)
  }

  async function handleActualizar() {
    setActualizando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/zonificacion`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo actualizar la zonificación")
        return
      }
      await refetchProyecto()
      toast.success("Zonificación actualizada")
    } catch {
      toast.error("No se pudo actualizar la zonificación")
    } finally {
      setActualizando(false)
    }
  }

  const nombreZona = fixMojibakeArcGIS(proyecto.zona_nombre)
  const uperm = fixMojibakeArcGIS(proyecto.zona_uperm)
  const uproh = fixMojibakeArcGIS(proyecto.zona_uproh)

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Zonificación (PRC)</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            if (proyecto.zona_origen === "manual" && !window.confirm("Esta zona fue confirmada manualmente. ¿Reemplazarla con un nuevo intento automático de geocoding?")) return
            void handleActualizar()
          }}
          disabled={actualizando}
        >
          {actualizando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status === "pendiente" && (
          <p className="text-xs text-muted-foreground">Consultando zonificación…</p>
        )}

        {status === "sin_cobertura" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5" /> Sin cobertura automática
            </p>
            <p className="mt-1">
              La comuna &quot;{proyecto.municipio}&quot; no tiene capa PRC integrada todavía.
            </p>
            <div className="mt-2">
              <ZonificacionManualFallback proyectoId={proyecto.id} onApplied={refetchProyecto} />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-3.5" /> No se pudo determinar la zona
            </p>
            <p className="mt-1">Verifica la dirección del proyecto o intenta Actualizar.</p>
            <div className="mt-2">
              <ZonificacionManualFallback proyectoId={proyecto.id} onApplied={refetchProyecto} />
            </div>
          </div>
        )}

        {status === "encontrado" && (
          <>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Zona</p>
              <p className="font-semibold text-primary">
                {proyecto.zona_codigo ? `${proyecto.zona_codigo} — ` : ""}
                {nombreZona ?? "—"}
              </p>
              {proyecto.zona_sector && (
                <p className="text-[11px] text-muted-foreground">{proyecto.zona_sector}</p>
              )}
              {proyecto.zona_origen === "manual" && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Zona confirmada manualmente — sin punto geocodificado.
                </p>
              )}
            </div>

            <ZonificacionMapa lat={geo?.lat ?? null} lng={geo?.lng ?? null} geometria={geo?.geometria ?? null} />
            {proyecto.zona_origen === "manual" && !geo?.geometria && (
              <p className="text-[11px] text-muted-foreground">
                Zona seleccionada manualmente — no hay punto geocodificado, por lo que no se muestra un polígono de confirmación.
              </p>
            )}

            {proyecto.zona_usos_disponibles === false ? (
              <p className="text-xs text-muted-foreground">
                Usos permitidos/prohibidos no disponibles en la fuente para esta zona.
              </p>
            ) : (
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-primary">Usos permitidos</p>
                  <p className="text-xs text-muted-foreground">{uperm ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-primary">Usos prohibidos</p>
                  <p className="text-xs text-muted-foreground">{uproh ?? "—"}</p>
                </div>
              </div>
            )}

            <div className="text-xs">
              {proyecto.zona_fuente_url ? (
                <a
                  href={proyecto.zona_fuente_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Ver decreto de zona <ExternalLink className="size-3" />
                </a>
              ) : (
                <p className="text-muted-foreground">
                  Fuente: capa oficial {proyecto.municipio} — sin link directo disponible para esta zona (consulta el CIP oficial).
                </p>
              )}
            </div>

            <UsoCompatibleCheck proyectoId={proyecto.id} />
          </>
        )}

        <ZonificacionDisclaimer />
      </CardContent>
    </Card>
  )
}
