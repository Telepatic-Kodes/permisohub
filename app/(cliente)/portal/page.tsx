"use client"

import Link from "next/link"

const BRAND_GREEN = "#1A3328"
const EMPRESA = "Retail Andino SpA"

type EstadoCliente =
  | "ingresado"
  | "en_revision"
  | "con_observaciones"
  | "aprobado"

type ProyectoCliente = {
  id: string
  nombre: string
  direccion: string
  municipio: string
  estado: EstadoCliente
  etapa_actual: string
  etapa_numero: number
  fecha_inicio: string
  fecha_estimada: string
  numero_expediente: string
  alerta?: string
}

const PROYECTOS_CLIENTE: ProyectoCliente[] = [
  {
    id: "rc1",
    nombre: "Local Maipú — Mall Plaza Vespucio",
    direccion: "Av. Américo Vespucio 595, Maipú",
    municipio: "Maipú",
    estado: "en_revision",
    etapa_actual: "Revisión DOM",
    etapa_numero: 4,
    fecha_inicio: "2026-03-15",
    fecha_estimada: "2026-09-30",
    numero_expediente: "2026-0847-MAI",
  },
  {
    id: "rc2",
    nombre: "Local Pudahuel — Strip Center Poniente",
    direccion: "Av. Pudahuel 1230, Pudahuel",
    municipio: "Pudahuel",
    estado: "con_observaciones",
    etapa_actual: "Respuesta observaciones",
    etapa_numero: 5,
    fecha_inicio: "2026-02-01",
    fecha_estimada: "2026-10-15",
    numero_expediente: "2026-0312-PUD",
    alerta:
      "Observación recibida el 12/06. Plazo de respuesta: 25/06/2026",
  },
  {
    id: "rc3",
    nombre: "Local La Florida — Arauco Express",
    direccion: "Av. Vicuña Mackenna 7110, La Florida",
    municipio: "La Florida",
    estado: "ingresado",
    etapa_actual: "Ingreso DOM",
    etapa_numero: 3,
    fecha_inicio: "2026-05-10",
    fecha_estimada: "2026-12-20",
    numero_expediente: "2026-1102-LAF",
  },
  {
    id: "rc4",
    nombre: "Local Providencia — Av. Providencia",
    direccion: "Av. Providencia 2010, Providencia",
    municipio: "Providencia",
    estado: "aprobado",
    etapa_actual: "Aprobado",
    etapa_numero: 7,
    fecha_inicio: "2025-11-01",
    fecha_estimada: "2026-04-30",
    numero_expediente: "2025-2341-PRO",
  },
]

const ESTADO_CONFIG: Record<
  EstadoCliente,
  { label: string; badge: string }
> = {
  ingresado: {
    label: "Ingresado",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  en_revision: {
    label: "En revisión",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  con_observaciones: {
    label: "Con observaciones",
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  },
  aprobado: {
    label: "Aprobado",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function PortalPage() {
  const hoy = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  const activos = PROYECTOS_CLIENTE.filter(
    (p) => p.estado === "en_revision" || p.estado === "ingresado",
  ).length
  const conObservaciones = PROYECTOS_CLIENTE.filter(
    (p) => p.estado === "con_observaciones",
  ).length
  const aprobados = PROYECTOS_CLIENTE.filter(
    (p) => p.estado === "aprobado",
  ).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Hola, {EMPRESA}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Aquí puedes ver el estado de todos tus proyectos
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          Actualizado el {hoy}
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Proyectos activos"
          value={activos}
          accent="#1A3328"
        />
        <StatCard
          label="Con observaciones"
          value={conObservaciones}
          accent="#EA580C"
        />
        <StatCard label="Aprobados" value={aprobados} accent="#059669" />
      </div>

      {/* Projects list */}
      <div className="space-y-4">
        {PROYECTOS_CLIENTE.map((p) => (
          <ProjectCard key={p.id} proyecto={p} />
        ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div
      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="mt-0.5 text-sm text-neutral-500">{label}</p>
    </div>
  )
}

function ProjectCard({ proyecto }: { proyecto: ProyectoCliente }) {
  const cfg = ESTADO_CONFIG[proyecto.estado]
  const progreso = Math.round((proyecto.etapa_numero / 7) * 100)

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Alert banner */}
      {proyecto.estado === "con_observaciones" && proyecto.alerta ? (
        <div className="flex items-start gap-2 border-b border-orange-200 bg-orange-50 px-5 py-3 text-sm text-orange-800">
          <span aria-hidden="true">⚠️</span>
          <span>
            <span className="font-semibold">Requiere acción</span> —{" "}
            {proyecto.alerta}
          </span>
        </div>
      ) : null}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
          >
            {cfg.label}
          </span>
          <span className="text-xs text-neutral-400">{proyecto.municipio}</span>
        </div>

        <h2 className="mt-3 text-lg font-semibold tracking-tight text-neutral-900">
          {proyecto.nombre}
        </h2>
        <p className="mt-0.5 text-sm text-neutral-500">{proyecto.direccion}</p>

        <hr className="my-4 border-neutral-100" />

        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-500">Etapa actual:</span>
          <span className="font-medium text-neutral-800">
            {proyecto.etapa_actual}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progreso}%`, backgroundColor: BRAND_GREEN }}
            />
          </div>
          <p className="mt-1 text-right text-xs text-neutral-400">
            Etapa {proyecto.etapa_numero} de 7 · {progreso}%
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="text-xs text-neutral-500">
            <p>
              Inicio:{" "}
              <span className="font-medium text-neutral-700">
                {formatDate(proyecto.fecha_inicio)}
              </span>
            </p>
            <p>
              Est. aprobación:{" "}
              <span className="font-medium text-neutral-700">
                {formatDate(proyecto.fecha_estimada)}
              </span>
            </p>
          </div>
          <Link
            href={`/portal/${proyecto.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            Ver detalle →
          </Link>
        </div>
      </div>
    </div>
  )
}
