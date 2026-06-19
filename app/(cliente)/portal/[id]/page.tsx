"use client"

import { use } from "react"
import Link from "next/link"

const BRAND_GREEN = "#1A3328"

type EstadoCliente =
  | "ingresado"
  | "en_revision"
  | "con_observaciones"
  | "aprobado"

type Hito = {
  estado: "completado" | "en_curso" | "pendiente"
  fecha: string
  texto: string
}

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
  hitos: Hito[]
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
    hitos: [
      {
        estado: "completado",
        fecha: "15/03/2026",
        texto: "Expediente preparado y completado",
      },
      {
        estado: "completado",
        fecha: "20/03/2026",
        texto: "Ingresado a DOM Maipú",
      },
      {
        estado: "en_curso",
        fecha: "En curso",
        texto: "Revisión DOM (estimado: 30/09/2026)",
      },
    ],
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
    alerta: "Observación recibida el 12/06. Plazo de respuesta: 25/06/2026",
    hitos: [
      {
        estado: "completado",
        fecha: "01/02/2026",
        texto: "Expediente preparado y completado",
      },
      {
        estado: "completado",
        fecha: "08/02/2026",
        texto: "Ingresado a DOM Pudahuel",
      },
      {
        estado: "completado",
        fecha: "12/06/2026",
        texto: "Observaciones recibidas de la DOM",
      },
      {
        estado: "en_curso",
        fecha: "En curso",
        texto: "Preparando respuesta a observaciones",
      },
    ],
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
    hitos: [
      {
        estado: "completado",
        fecha: "10/05/2026",
        texto: "Expediente preparado y completado",
      },
      {
        estado: "en_curso",
        fecha: "En curso",
        texto: "Ingreso a DOM La Florida",
      },
    ],
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
    hitos: [
      {
        estado: "completado",
        fecha: "01/11/2025",
        texto: "Expediente preparado y completado",
      },
      {
        estado: "completado",
        fecha: "10/11/2025",
        texto: "Ingresado a DOM Providencia",
      },
      {
        estado: "completado",
        fecha: "15/04/2026",
        texto: "Permiso aprobado y recepción final",
      },
    ],
  },
]

const ESTADO_CONFIG: Record<EstadoCliente, { label: string; badge: string }> = {
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

const ETAPAS = [
  "Pre-revisión",
  "Preparación",
  "Ingreso",
  "Revisión",
  "Observaciones",
  "Aprobación",
  "Recepción",
]

const ESTADO_EXPLICADO: Record<string, string> = {
  "Revisión DOM":
    "La Dirección de Obras está revisando tu expediente. Este proceso toma entre 30-60 días hábiles. No requiere acción de tu parte.",
  "Respuesta observaciones":
    "La DOM ha emitido observaciones técnicas. EP Gestión está preparando la respuesta. Te notificaremos cuando esté lista.",
  "Ingreso DOM":
    "Estamos ingresando tu expediente a la Dirección de Obras Municipales. Una vez recibido, comenzará la revisión técnica.",
  Aprobado:
    "¡Felicitaciones! Tu permiso fue aprobado y cuenta con la recepción final de la Dirección de Obras.",
}

function formatLargo(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export default function PortalDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const proyecto =
    PROYECTOS_CLIENTE.find((p) => p.id === id) ?? PROYECTOS_CLIENTE[0]
  const cfg = ESTADO_CONFIG[proyecto.estado]
  const explicacion =
    ESTADO_EXPLICADO[proyecto.etapa_actual] ??
    "Estamos trabajando en tu permiso. Te mantendremos informado en cada etapa."

  const whatsappMsg = encodeURIComponent(
    `Hola Estefanía, tengo una consulta sobre mi proyecto "${proyecto.nombre}" (Exp. ${proyecto.numero_expediente}).`,
  )

  return (
    <div className="space-y-8">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-[#1A3328]"
      >
        ← Mis proyectos
      </Link>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            {proyecto.nombre}
          </h1>
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}
          >
            {cfg.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Expediente {proyecto.numero_expediente} · {proyecto.municipio}
        </p>
      </div>

      {/* Progress tracker */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-sm font-semibold text-neutral-700">
          Avance del proyecto
        </h2>
        <ol className="flex items-start justify-between">
          {ETAPAS.map((etapa, idx) => {
            const stageNum = idx + 1
            const completed = stageNum < proyecto.etapa_numero
            const current = stageNum === proyecto.etapa_numero
            const isLast = idx === ETAPAS.length - 1
            const segmentDone = stageNum < proyecto.etapa_numero

            return (
              <li
                key={etapa}
                className="relative flex flex-1 flex-col items-center"
              >
                {/* Connecting line to next node */}
                {!isLast ? (
                  <span
                    className="absolute left-1/2 top-4 -z-0 h-0.5 w-full"
                    style={{
                      backgroundColor: segmentDone ? BRAND_GREEN : "#e5e5e5",
                    }}
                    aria-hidden="true"
                  />
                ) : null}

                {/* Node */}
                <span
                  className={[
                    "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-medium",
                    completed
                      ? "border-[#1A3328] bg-[#1A3328] text-white"
                      : current
                        ? "animate-pulse border-[#1A3328] bg-[#1A3328] text-white ring-4 ring-[#1A3328]/15"
                        : "border-neutral-300 bg-white text-neutral-400",
                  ].join(" ")}
                >
                  {completed ? "✓" : stageNum}
                </span>

                <span
                  className={[
                    "mt-2 max-w-[4.5rem] text-center text-[10px] leading-tight sm:text-xs",
                    current
                      ? "font-semibold text-[#1A3328]"
                      : completed
                        ? "text-neutral-700"
                        : "text-neutral-400",
                  ].join(" ")}
                >
                  {etapa}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Info cards row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoCard label="Fecha de inicio" value={formatLargo(proyecto.fecha_inicio)} />
        <InfoCard
          label="Fecha estimada"
          value={formatLargo(proyecto.fecha_estimada)}
        />
        <InfoCard label="N° Expediente" value={proyecto.numero_expediente} />
        <InfoCard label="Municipio" value={proyecto.municipio} />
      </div>

      {/* Estado explicado */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="text-sm font-semibold text-neutral-800">
          ¿Qué significa la etapa actual?
        </h2>
        <p className="mt-1 text-sm font-medium text-[#1A3328]">
          {proyecto.etapa_actual}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          {explicacion}
        </p>
      </div>

      {/* Timeline de hitos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">
          Hitos del proyecto
        </h2>
        <ul className="space-y-4">
          {proyecto.hitos.map((hito, idx) => {
            const done = hito.estado === "completado"
            return (
              <li key={idx} className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
                    done
                      ? "bg-[#1A3328] text-white"
                      : "bg-amber-100 text-amber-700",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {done ? "✓" : "►"}
                </span>
                <div className="text-sm">
                  <span className="font-medium text-neutral-800">
                    {hito.fecha}
                  </span>
                  <span className="text-neutral-400"> — </span>
                  <span className="text-neutral-600">{hito.texto}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Contact box */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: BRAND_GREEN }}
            aria-hidden="true"
          >
            EP
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-neutral-900">
              ¿Tienes preguntas sobre tu proyecto?
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Estefanía Parada · EP Gestión Arquitectónica
            </p>
            <a
              href="mailto:estefania@epgestion.cl"
              className="mt-0.5 inline-block text-sm font-medium text-[#1A3328] hover:underline"
            >
              estefania@epgestion.cl
            </a>
          </div>
          <a
            href={`https://wa.me/56900000000?text=${whatsappMsg}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            Contactar a Estefanía
          </a>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-neutral-900">{value}</p>
    </div>
  )
}
