"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, CheckCircle2, FileText, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import type { EstadoExpediente } from "@/types"

interface HistorialEntry {
  proyecto_id: string
  nombre: string
  estado: EstadoExpediente
  tipo?: string
  fecha_inicio?: string
  fecha_estimada?: string
  dias_tramite?: number
  created_at: string
}

interface HistorialResponse {
  local: {
    numero: string
    nombre_negocio?: string
    centro?: string
  }
  historial: HistorialEntry[]
}

interface LocalHistorialDrawerProps {
  localId: string
  localNumero: string
  negocio: string
  open: boolean
  onClose: () => void
}

const ESTADO_CIRCLE_COLOR: Record<EstadoExpediente, string> = {
  aprobado: "bg-green-500",
  en_revision: "bg-amber-500",
  ingresado: "bg-blue-500",
  borrador: "bg-gray-400",
  con_observaciones: "bg-gray-400",
  rechazado: "bg-gray-400",
}

const ESTADO_BADGE_CLASS: Record<EstadoExpediente, string> = {
  aprobado: "bg-green-100 text-green-700",
  en_revision: "bg-amber-100 text-amber-700",
  ingresado: "bg-blue-100 text-blue-700",
  borrador: "bg-secondary text-secondary-foreground",
  con_observaciones: "bg-secondary text-secondary-foreground",
  rechazado: "bg-red-100 text-red-700",
}

const ESTADO_LABEL: Record<EstadoExpediente, string> = {
  aprobado: "Aprobado",
  en_revision: "En revisión",
  ingresado: "Ingresado",
  borrador: "Borrador",
  con_observaciones: "Con observaciones",
  rechazado: "Rechazado",
}

export function LocalHistorialDrawer({
  localId,
  localNumero,
  negocio,
  open,
  onClose,
}: LocalHistorialDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<HistorialResponse | null>(null)

  useEffect(() => {
    if (!open) return

    setLoading(true)
    setData(null)

    fetch(`/api/locales/${localId}/historial`)
      .then(res => res.json())
      .then((json: HistorialResponse) => {
        setData(json)
      })
      .catch(() => {
        setData(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [localId, open])

  const historial = data?.historial ?? []

  const tramiteDays = historial
    .map(e => e.dias_tramite)
    .filter((d): d is number => d !== undefined)

  const avgDias =
    tramiteDays.length > 0
      ? Math.round(tramiteDays.reduce((a, b) => a + b, 0) / tramiteDays.length)
      : null

  const lastEntry = historial.length > 0 ? historial[historial.length - 1] : null

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial · Local #{localNumero}</DialogTitle>
          <p className="text-sm text-muted-foreground">{negocio}</p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              {/* Total permisos */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="size-3.5" />
                  <span className="text-xs font-medium">Total permisos</span>
                </div>
                <span className="text-2xl font-bold leading-none">{historial.length}</span>
              </div>

              {/* Promedio tramitación */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span className="text-xs font-medium">Prom. tramitación</span>
                </div>
                <span className="text-2xl font-bold leading-none">
                  {avgDias !== null ? `${avgDias}` : "—"}
                </span>
                {avgDias !== null && (
                  <span className="text-xs text-muted-foreground">días</span>
                )}
              </div>

              {/* Último estado */}
              <div className="rounded-lg border border-border bg-muted/40 p-3 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-3.5" />
                  <span className="text-xs font-medium">Último estado</span>
                </div>
                {lastEntry ? (
                  <Badge
                    className={cn(
                      "mt-1 self-start text-xs",
                      ESTADO_BADGE_CLASS[lastEntry.estado]
                    )}
                  >
                    {ESTADO_LABEL[lastEntry.estado]}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>

            {/* Timeline */}
            {historial.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sin historial de permisos para este local.
              </p>
            ) : (
              <div className="mt-2 flex flex-col">
                {historial.map((entry, idx) => {
                  const isLast = idx === historial.length - 1
                  return (
                    <div key={entry.proyecto_id} className="flex gap-3">
                      {/* Left: circle + line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "size-4 rounded-full shrink-0 mt-0.5",
                            ESTADO_CIRCLE_COLOR[entry.estado]
                          )}
                        />
                        {!isLast && (
                          <div className="w-px flex-1 bg-border mt-1 mb-1 min-h-[24px]" />
                        )}
                      </div>

                      {/* Right: content */}
                      <div className={cn("pb-5 min-w-0 flex-1", isLast && "pb-0")}>
                        <p className="font-medium text-sm leading-snug">{entry.nombre}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            className={cn(
                              "text-xs",
                              ESTADO_BADGE_CLASS[entry.estado]
                            )}
                          >
                            {ESTADO_LABEL[entry.estado]}
                          </Badge>
                          {entry.fecha_inicio && (
                            <span className="text-xs text-muted-foreground">
                              {entry.fecha_inicio}
                            </span>
                          )}
                        </div>
                        {entry.dias_tramite !== undefined && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Tramitado en {entry.dias_tramite} días
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <DialogClose render={<Button ref={closeRef} variant="outline" onClick={onClose} />}>
            Cerrar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
