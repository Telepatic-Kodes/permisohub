"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { MOCK_CLIENTES, MOCK_PROYECTOS } from "@/lib/mock-data"
import {
  ESTADO_CONFIG,
  ETAPAS_PERMISO,
  TIPO_PERMISO_LABELS,
  type Cliente,
  type Proyecto,
} from "@/types"

const FOREST = "#1A3328"

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

/** Progress derived from the project's current stage within ETAPAS_PERMISO. */
function getProgreso(proyecto: Proyecto) {
  const total = ETAPAS_PERMISO.length
  const idx = proyecto.etapa_actual
    ? ETAPAS_PERMISO.indexOf(proyecto.etapa_actual)
    : -1
  // Aprobado projects are fully complete regardless of named stage.
  const completadas =
    proyecto.estado === "aprobado" ? total : idx >= 0 ? idx + 1 : 0
  const pct = Math.round((completadas / total) * 100)
  return { completadas, total, pct }
}

export default function InformeClientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const [cliente, setCliente] = useState<Cliente | undefined>(MOCK_CLIENTES.find((c) => c.id === id))
  const [proyectos, setProyectos] = useState<Proyecto[]>(MOCK_PROYECTOS.filter((p) => p.cliente_id === id))

  useEffect(() => {
    fetch(`/api/clientes/${id}`)
      .then((r) => r.json())
      .then((d: { cliente?: Cliente }) => { if (d.cliente) setCliente(d.cliente) })
      .catch(() => undefined)

    fetch(`/api/proyectos?clienteId=${id}`)
      .then((r) => r.json())
      .then((d: { data?: Proyecto[]; proyectos?: Proyecto[] }) => {
        const list = d.data ?? d.proyectos ?? []
        if (list.length > 0) setProyectos(list.filter((p) => p.cliente_id === id))
      })
      .catch(() => undefined)
  }, [id])

  const hoy = new Date()
  const fechaInforme = formatLongDate(hoy)

  if (!cliente) {
    return (
      <div className="space-y-6">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[#1A3328]"
        >
          <ArrowLeft className="size-4" />
          Clientes
        </Link>
        <p className="text-sm text-muted-foreground">
          No se encontró el cliente solicitado.
        </p>
      </div>
    )
  }

  const activos = proyectos.filter(
    (p) => p.estado !== "aprobado" && p.estado !== "rechazado"
  ).length
  const conObservaciones = proyectos.filter(
    (p) => p.estado === "con_observaciones"
  )
  const enFaseFinal = proyectos.filter((p) =>
    ["Aprobación", "Recepción final"].includes(p.etapa_actual ?? "")
  ).length
  const aprobados = proyectos.filter((p) => p.estado === "aprobado").length

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          body { background: white; }
          .report-shell { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
          .report-card { break-inside: avoid; }
        }
        @page { size: A4 portrait; margin: 20mm 15mm; }
      `}</style>

      {/* Screen-only top bar */}
      <div className="no-print sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#1A3328]">
            EP Gestión Arquitectónica — Informe cliente
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/clientes/${cliente.id}`} />}
          >
            <ArrowLeft className="size-4" />
            Volver al cliente
          </Button>
          <Button
            className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Imprimir / Guardar PDF
          </Button>
          <span className="text-xs text-muted-foreground">
            Instrucciones: Cmd+P → Guardar como PDF
          </span>
        </div>
      </div>

      {/* Report document */}
      <div className="report-shell mx-auto max-w-[210mm] bg-white text-[#1f2937] shadow-sm">
        {/* PAGE 1 — Portada */}
        <section
          className="flex min-h-[60vh] flex-col text-white"
          style={{ backgroundColor: FOREST }}
        >
          <div className="flex flex-1 flex-col justify-between p-12">
            <div className="flex items-center justify-between text-sm font-medium tracking-wide text-white/80">
              <span>PermisoHub</span>
              <span>EP Gestión Arquitectónica</span>
            </div>

            <div className="space-y-8 py-12">
              <div className="space-y-2">
                <div className="h-1 w-16 bg-white/40" />
                <h1 className="text-3xl font-semibold tracking-tight">
                  Informe de estado de proyectos
                </h1>
              </div>

              <dl className="space-y-3 text-sm">
                <PortadaRow label="Cliente" value={cliente.nombre} />
                <PortadaRow label="RUT" value={cliente.rut ?? "—"} />
                <PortadaRow label="Fecha del informe" value={fechaInforme} />
                <PortadaRow
                  label="Arquitecta responsable"
                  value="Estefanía Parada"
                />
                <PortadaRow label="Período" value="Junio 2026" />
              </dl>
            </div>

            <div className="text-xs text-white/60">
              Documento confidencial · Preparado para uso del cliente
            </div>
          </div>
        </section>

        {/* PAGE 2+ — Contenido */}
        <div className="page-break space-y-10 p-12">
          {/* Section 1 — Resumen ejecutivo */}
          <section>
            <SectionTitle>1. Resumen ejecutivo</SectionTitle>
            <div className="grid grid-cols-2 gap-4">
              <ResumenItem label="Total proyectos activos" value={activos} />
              <ResumenItem
                label="Proyectos con observaciones"
                value={conObservaciones.length}
                note={
                  conObservaciones.length > 0
                    ? "⚠️ requieren atención"
                    : undefined
                }
                highlight={conObservaciones.length > 0}
              />
              <ResumenItem label="Proyectos en fase final" value={enFaseFinal} />
              <ResumenItem label="Proyectos aprobados" value={aprobados} />
            </div>
          </section>

          {/* Section 2 — Estado detallado */}
          <section>
            <SectionTitle>2. Estado detallado por proyecto</SectionTitle>
            {proyectos.length === 0 ? (
              <p className="text-sm text-gray-500">
                Este cliente no tiene proyectos registrados.
              </p>
            ) : (
              <div className="space-y-5">
                {proyectos.map((p) => {
                  const estadoCfg = ESTADO_CONFIG[p.estado]
                  const { completadas, total, pct } = getProgreso(p)
                  return (
                    <article
                      key={p.id}
                      className="report-card rounded-lg border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-base font-semibold text-[#1A3328]">
                          {p.nombre}
                        </h3>
                        <span
                          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoCfg.color}`}
                        >
                          {estadoCfg.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {p.municipio} · {TIPO_PERMISO_LABELS[p.tipo]}
                        {p.numero_expediente
                          ? ` · N° ${p.numero_expediente}`
                          : ""}
                      </p>
                      <p className="text-xs text-gray-500">{p.direccion}</p>

                      {/* Progress */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                          <span>Progreso</span>
                          <span>
                            {completadas}/{total} etapas ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: FOREST,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gray-600">
                          Etapa actual:{" "}
                          <span className="font-medium text-[#1A3328]">
                            {p.etapa_actual ?? "—"}
                          </span>
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs text-gray-600">
                        <span>
                          Inicio:{" "}
                          <span className="font-medium">
                            {formatDate(p.fecha_inicio)}
                          </span>
                        </span>
                        <span>
                          Estimado:{" "}
                          <span className="font-medium">
                            {formatDate(p.fecha_estimada)}
                          </span>
                        </span>
                      </div>

                      {p.notas && (
                        <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-600">
                          <span className="font-medium text-gray-700">
                            Notas:
                          </span>{" "}
                          {p.notas}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Section 3 — Próximos pasos */}
          <section>
            <SectionTitle>3. Próximos pasos y recomendaciones</SectionTitle>
            {conObservaciones.length === 0 ? (
              <p className="text-sm text-gray-500">
                No hay observaciones pendientes. Todos los proyectos avanzan
                según lo planificado.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-gray-700">
                {conObservaciones.map((p) => (
                  <li key={p.id} className="flex gap-2">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: FOREST }}
                    />
                    <span>
                      <span className="font-medium text-[#1A3328]">
                        {p.nombre}
                      </span>{" "}
                      en {p.municipio}: responder observación
                      {p.fecha_estimada
                        ? ` antes del ${formatDate(p.fecha_estimada)}`
                        : " a la brevedad"}
                      .
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Section 4 — Pie del informe */}
          <section className="report-card space-y-6 border-t border-gray-200 pt-8 text-xs text-gray-500">
            <div className="space-y-1">
              <p>
                Este informe fue generado el {fechaInforme} por EP Gestión
                Arquitectónica.
              </p>
              <p>
                Para consultas: estefania@epgestion.cl · PermisoHub
              </p>
            </div>
            <div className="pt-10">
              <div className="w-72 border-t border-gray-400 pt-2 text-gray-700">
                Estefanía Parada · Arquitecta
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function PortadaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-44 shrink-0 text-white/60">{label}:</dt>
      <dd className="font-medium text-white">{value}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#1A3328]">
      {children}
    </h2>
  )
}

function ResumenItem({
  label,
  value,
  note,
  highlight,
}: {
  label: string
  value: number
  note?: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          highlight ? "text-orange-600" : "text-[#1A3328]"
        }`}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 text-xs font-medium text-orange-600">{note}</p>
      )}
    </div>
  )
}
