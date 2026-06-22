"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  MapPin,
  MessageSquare,
} from "lucide-react"
import Link from "next/link"
import { MOCK_PROYECTOS } from "@/lib/mock-data"
import { ESTADO_CONFIG, TIPO_PERMISO_LABELS } from "@/types"
import { cn } from "@/lib/utils"

// Portal view — simplified read-only for clients/tenants

const ESTADO_PLAIN: Record<string, string> = {
  borrador:          "En preparación",
  ingresado:         "Ingresado a la DOM",
  en_revision:       "La DOM lo está revisando",
  con_observaciones: "Hay observaciones que responder",
  aprobado:          "Aprobado ✓",
  rechazado:         "No aprobado",
}

const ESTADO_ICON: Record<string, typeof CheckCircle2> = {
  borrador:          Clock,
  ingresado:         FileText,
  en_revision:       Clock,
  con_observaciones: AlertTriangle,
  aprobado:          CheckCircle2,
  rechazado:         AlertTriangle,
}

const ESTADO_BG: Record<string, string> = {
  borrador:          "bg-gray-50 border-gray-200",
  ingresado:         "bg-blue-50 border-blue-200",
  en_revision:       "bg-yellow-50 border-yellow-200",
  con_observaciones: "bg-orange-50 border-orange-200",
  aprobado:          "bg-green-50 border-green-200",
  rechazado:         "bg-red-50 border-red-200",
}

const ESTADO_TEXT: Record<string, string> = {
  borrador:          "text-gray-700",
  ingresado:         "text-blue-700",
  en_revision:       "text-yellow-700",
  con_observaciones: "text-orange-700",
  aprobado:          "text-green-700",
  rechazado:         "text-red-700",
}

export default function PortalPage() {
  const proyectos = MOCK_PROYECTOS.slice(0, 6)
  const [selected, setSelected] = useState<string | null>(null)

  const stats = useMemo(() => ({
    total:   proyectos.length,
    activos: proyectos.filter((p) => !["aprobado", "rechazado"].includes(p.estado)).length,
    alertas: proyectos.filter((p) => p.estado === "con_observaciones").length,
  }), [proyectos])

  const selectedProyecto = proyectos.find((p) => p.id === selected)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-semibold text-primary">Bienvenido al portal de seguimiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí puedes ver el avance de tus proyectos en curso. Esta vista es de sólo lectura.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Proyectos", value: stats.total, color: "text-primary" },
          { label: "En curso", value: stats.activos, color: "text-blue-600" },
          { label: "Con alertas", value: stats.alertas, color: "text-orange-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-border bg-white p-4 text-center">
            <p className={cn("text-3xl font-semibold", color)}>{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Projects list + detail side-by-side on wider screens */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_360px]">

        {/* Project list */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            Mis proyectos
          </p>
          {proyectos.map((p) => {
            const Icon = ESTADO_ICON[p.estado] ?? FileText
            const isOpen = selected === p.id
            return (
              <button
                key={p.id}
                onClick={() => setSelected(isOpen ? null : p.id)}
                className={cn(
                  "w-full text-left rounded-xl border p-4 transition-all",
                  isOpen
                    ? "border-primary/30 bg-white shadow-sm"
                    : "border-border bg-white hover:border-primary/20 hover:shadow-sm"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl border", ESTADO_BG[p.estado])}>
                    <Icon className={cn("size-4", ESTADO_TEXT[p.estado])} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-primary truncate">{p.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="size-3 text-muted-foreground/50 shrink-0" />
                      <p className="text-[11px] text-muted-foreground truncate">{p.municipio}</p>
                    </div>
                    <p className={cn("mt-1.5 text-[11.5px] font-medium", ESTADO_TEXT[p.estado])}>
                      {ESTADO_PLAIN[p.estado] ?? p.estado}
                    </p>
                  </div>
                  <ChevronRight className={cn("size-4 text-muted-foreground/30 shrink-0 mt-0.5 transition-transform", isOpen && "rotate-90")} />
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1">
            Detalle
          </p>
          {selectedProyecto ? (
            <div className="rounded-xl border border-border bg-white p-5 space-y-4 sticky top-20">
              <div>
                <p className="text-base font-semibold text-primary">{selectedProyecto.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {TIPO_PERMISO_LABELS[selectedProyecto.tipo] ?? selectedProyecto.tipo}
                </p>
              </div>

              {/* Estado pill */}
              <div className={cn("rounded-lg border px-3 py-2.5", ESTADO_BG[selectedProyecto.estado])}>
                <p className={cn("text-xs font-semibold", ESTADO_TEXT[selectedProyecto.estado])}>
                  Estado: {ESTADO_PLAIN[selectedProyecto.estado]}
                </p>
                {selectedProyecto.estado === "con_observaciones" && (
                  <p className="text-[10.5px] text-orange-600 mt-1 leading-relaxed">
                    La DOM solicitó correcciones al expediente. Tu arquitecto está trabajando en la respuesta.
                  </p>
                )}
                {selectedProyecto.estado === "en_revision" && (
                  <p className="text-[10.5px] text-yellow-700 mt-1 leading-relaxed">
                    El expediente está dentro de la DOM. El plazo legal de respuesta es 30 días hábiles.
                  </p>
                )}
                {selectedProyecto.estado === "aprobado" && (
                  <p className="text-[10.5px] text-green-700 mt-1 leading-relaxed">
                    El permiso fue aprobado. Solicita la resolución oficial a tu arquitecto.
                  </p>
                )}
              </div>

              {/* Info rows */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Municipio DOM</p>
                    <p className="text-[12px] font-medium text-primary">{selectedProyecto.municipio}</p>
                  </div>
                </div>
                {selectedProyecto.numero_expediente && (
                  <div className="flex items-start gap-2">
                    <FileText className="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">N° expediente</p>
                      <p className="text-[12px] font-medium text-primary">{selectedProyecto.numero_expediente}</p>
                    </div>
                  </div>
                )}
                {selectedProyecto.fecha_estimada && (
                  <div className="flex items-start gap-2">
                    <Calendar className="size-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Fecha estimada</p>
                      <p className="text-[12px] font-medium text-primary">
                        {new Date(selectedProyecto.fecha_estimada).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Documents placeholder */}
              {(selectedProyecto.documentos?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-2">Documentos</p>
                  <div className="space-y-1">
                    {selectedProyecto.documentos!.slice(0, 3).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg bg-[#F9F7F3] px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="size-3.5 text-muted-foreground/50 shrink-0" />
                          <p className="text-[11px] text-primary truncate">{doc.nombre}</p>
                        </div>
                        <button className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors">
                          <Download className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg bg-[#F9F7F3] px-3 py-3 text-center">
                  <p className="text-[10.5px] text-muted-foreground/60">Sin documentos adjuntos aún</p>
                </div>
              )}

              {/* Contact */}
              <div className="rounded-lg border border-primary/15 bg-primary/4 px-3 py-2.5">
                <p className="text-[10.5px] text-primary/70 leading-relaxed">
                  ¿Tienes dudas sobre el avance?{" "}
                  <a href="mailto:estefania@arch.cl" className="font-semibold text-primary hover:underline">
                    Escríbenos →
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-white py-16 text-center sticky top-20">
              <MessageSquare className="mx-auto size-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground/60">Selecciona un proyecto para ver el detalle</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
