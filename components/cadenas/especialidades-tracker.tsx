"use client"

import { useEffect, useState } from "react"
import {
  Zap,
  Flame,
  Droplets,
  Waves,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  MinusCircle,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type TipoEspecialidad = "electrica" | "gas" | "agua_potable" | "alcantarillado" | "estructura"
type EstadoEspecialidad = "pendiente" | "en_tramite" | "obtenido" | "no_aplica"
type Especialidad = {
  id: string
  local_id: string
  tipo: TipoEspecialidad
  estado: EstadoEspecialidad
  numero_certificado?: string
  fecha_vencimiento?: string
  empresa_certificadora?: string
}

const ESPECIAL_CONFIG: Record<TipoEspecialidad, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  electrica:      { label: "Eléctrica",      icon: Zap },
  gas:            { label: "Gas",             icon: Flame },
  agua_potable:   { label: "Agua Potable",    icon: Droplets },
  alcantarillado: { label: "Alcantarillado",  icon: Waves },
  estructura:     { label: "Estructura",      icon: Building2 },
}

const ESTADO_CONFIG: Record<EstadoEspecialidad, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendiente:  { label: "Pendiente",   color: "bg-slate-100 text-slate-600 border-slate-200",   icon: AlertCircle },
  en_tramite: { label: "En trámite",  color: "bg-blue-100 text-blue-700 border-blue-200",      icon: Clock },
  obtenido:   { label: "Obtenido",    color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  no_aplica:  { label: "No aplica",   color: "bg-slate-50 text-slate-400 border-slate-100",    icon: MinusCircle },
}

const TIPOS_ORDER: TipoEspecialidad[] = ["electrica", "gas", "agua_potable", "alcantarillado", "estructura"]

export function EspecialidadesTracker({ localId }: { localId: string }) {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/locales/${localId}/especialidades`)
      .then((res) => res.json())
      .then((data: { especialidades: Especialidad[] }) => {
        setEspecialidades(data.especialidades ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [localId])

  async function handleUpdate(tipo: TipoEspecialidad, newEstado: EstadoEspecialidad) {
    setUpdating(tipo)
    try {
      const res = await fetch(`/api/locales/${localId}/especialidades`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, estado: newEstado }),
      })
      if (res.ok) {
        setEspecialidades((prev) =>
          prev.some((e) => e.tipo === tipo)
            ? prev.map((e) => (e.tipo === tipo ? { ...e, estado: newEstado } : e))
            : [
                ...prev,
                {
                  id: tipo,
                  local_id: localId,
                  tipo,
                  estado: newEstado,
                },
              ]
        )
      }
    } finally {
      setUpdating(null)
    }
  }

  const obtenidos = especialidades.filter((e) => e.estado === "obtenido").length
  const hasObtenido = obtenidos > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800">Certificados de Especialidades</h3>
        <Badge
          variant="outline"
          className={
            hasObtenido
              ? "bg-green-100 text-green-700 border-green-200"
              : "bg-slate-100 text-slate-600 border-slate-200"
          }
        >
          {obtenidos}/5 obtenidos
        </Badge>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-gray-100 h-36 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {TIPOS_ORDER.map((tipo) => {
            const especialidad = especialidades.find((e) => e.tipo === tipo)
            const estado: EstadoEspecialidad = especialidad?.estado ?? "pendiente"
            const { label: tipoLabel, icon: TipoIcon } = ESPECIAL_CONFIG[tipo]
            const { label: estadoLabel, color: estadoColor, icon: EstadoIcon } = ESTADO_CONFIG[estado]
            const isUpdating = updating === tipo

            return (
              <div
                key={tipo}
                className="rounded-xl border bg-white p-3 shadow-sm flex flex-col gap-2"
              >
                <div className="flex items-center gap-1.5">
                  <TipoIcon className="size-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{tipoLabel}</span>
                </div>

                <Badge variant="outline" className={`w-fit text-xs ${estadoColor}`}>
                  <EstadoIcon className="size-3 mr-1" />
                  {estadoLabel}
                </Badge>

                <div className="flex flex-col gap-1 mt-auto">
                  {(["pendiente", "en_tramite", "obtenido"] as EstadoEspecialidad[]).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={estado === s ? "secondary" : "ghost"}
                      className="cursor-pointer text-xs h-7 justify-start px-2"
                      disabled={isUpdating}
                      onClick={() => handleUpdate(tipo, s)}
                    >
                      {isUpdating && estado !== s ? (
                        <Loader2 className="size-3 mr-1 animate-spin" />
                      ) : null}
                      {ESTADO_CONFIG[s].label}
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {hasObtenido && (
        <p className="text-xs text-slate-500">
          Guarda los números de certificado para la recepción final
        </p>
      )}
    </div>
  )
}
