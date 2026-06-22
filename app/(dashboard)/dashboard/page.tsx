import Link from "next/link"
import {
  AlertTriangle,
  BookText,
  ChevronRight,
  MessageSquare,
  Plus,
  ShieldCheck,
  Target,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { cn } from "@/lib/utils"
import { MOCK_PROYECTOS, MOCK_CLIENTES } from "@/lib/mock-data"
import type { EstadoExpediente, Proyecto } from "@/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saludoFecha(): { saludo: string; fechaCorta: string } {
  const now = new Date()
  const hour = parseInt(
    new Intl.DateTimeFormat("es-CL", { hour: "numeric", hour12: false, timeZone: "America/Santiago" }).format(now),
    10
  )
  const saludo = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"
  const fechaCorta = new Intl.DateTimeFormat("es-CL", {
    weekday: "short", day: "numeric", month: "short",
    timeZone: "America/Santiago",
  }).format(now)
  return { saludo, fechaCorta }
}

function daysFromNow(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  )
}

function clienteNombre(clienteId: string): string {
  return MOCK_CLIENTES.find((c) => c.id === clienteId)?.nombre ?? "—"
}

// ---------------------------------------------------------------------------
// Timeline data types
// ---------------------------------------------------------------------------

interface AlertaItem {
  titulo: string
  detalle: string
  href: string
  diasRestantes: number
}

const ALERTAS: AlertaItem[] = [
  { titulo: "Obs. DOM por responder", detalle: "Mall Plaza Egaña", href: "/proyectos/p1", diasRestantes: 3 },
]

type TimelineRow =
  | { kind: "proyecto"; proyecto: Proyecto; dias: number | null }
  | { kind: "alerta"; alerta: AlertaItem }

interface TimelineSections {
  accionRequerida: TimelineRow[]
  proximos30d: TimelineRow[]
  enProceso: TimelineRow[]
  completado: TimelineRow[]
}

function buildTimeline(): { sections: TimelineSections; stats: { activos: number; urgentes: number; diasPromedio: number; byEstado: Partial<Record<EstadoExpediente, number>> } } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const en30dias = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const accionRequerida: TimelineRow[] = []
  const proximos30d: TimelineRow[] = []
  const enProceso: TimelineRow[] = []
  const completado: TimelineRow[] = []

  const byEstado: Partial<Record<EstadoExpediente, number>> = {}
  const proyectosConObsIds = new Set<string>()

  // Sort projects: con_observaciones first, then by fecha_estimada
  const sorted = [...MOCK_PROYECTOS].sort((a, b) => {
    if (a.estado === "con_observaciones" && b.estado !== "con_observaciones") return -1
    if (b.estado === "con_observaciones" && a.estado !== "con_observaciones") return 1
    const da = a.fecha_estimada ? new Date(`${a.fecha_estimada}T00:00:00`).getTime() : Infinity
    const db = b.fecha_estimada ? new Date(`${b.fecha_estimada}T00:00:00`).getTime() : Infinity
    return da - db
  })

  for (const p of sorted) {
    byEstado[p.estado] = (byEstado[p.estado] ?? 0) + 1
    const dias = p.fecha_estimada ? daysFromNow(p.fecha_estimada) : null

    if (p.estado === "con_observaciones") {
      accionRequerida.push({ kind: "proyecto", proyecto: p, dias })
      proyectosConObsIds.add(p.id)
    } else if (p.estado === "aprobado" || p.estado === "rechazado") {
      completado.push({ kind: "proyecto", proyecto: p, dias })
    } else if (
      p.fecha_estimada &&
      new Date(`${p.fecha_estimada}T00:00:00`) >= now &&
      new Date(`${p.fecha_estimada}T00:00:00`) <= en30dias
    ) {
      proximos30d.push({ kind: "proyecto", proyecto: p, dias })
    } else {
      enProceso.push({ kind: "proyecto", proyecto: p, dias })
    }
  }

  // Add alerts to ACCIÓN REQUERIDA (avoid duplicating projects already there)
  for (const alerta of ALERTAS) {
    accionRequerida.push({ kind: "alerta", alerta })
  }

  const activos = MOCK_PROYECTOS.filter((p) => !["aprobado", "rechazado"].includes(p.estado)).length
  const urgentes = MOCK_PROYECTOS.filter((p) => p.estado === "con_observaciones").length

  const activosConFecha = MOCK_PROYECTOS.filter(
    (p) => p.fecha_inicio && !["aprobado", "rechazado", "borrador"].includes(p.estado)
  )
  const diasPromedio =
    activosConFecha.length > 0
      ? Math.round(
          activosConFecha.reduce((sum, p) => {
            const inicio = new Date(`${p.fecha_inicio}T00:00:00`).getTime()
            return sum + Math.floor((now.getTime() - inicio) / (1000 * 60 * 60 * 24))
          }, 0) / activosConFecha.length
        )
      : 0

  return {
    sections: { accionRequerida, proximos30d, enProceso, completado },
    stats: { activos, urgentes, diasPromedio, byEstado },
  }
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

const QUICK_ACTIONS = [
  { label: "Predictor", href: "/herramientas/predictor", Icon: Target },
  { label: "Memoria",   href: "/herramientas/memoria",   Icon: BookText },
  { label: "Verificador", href: "/herramientas/compliance-check", Icon: ShieldCheck },
  { label: "Chat OGUC", href: "/herramientas/oguc-chat", Icon: MessageSquare },
]

// ---------------------------------------------------------------------------
// Row components (inline render functions)
// ---------------------------------------------------------------------------

function ProyectoRow({ proyecto, dias }: { proyecto: Proyecto; dias: number | null }) {
  const isConObs = proyecto.estado === "con_observaciones"
  const isAprobado = proyecto.estado === "aprobado"
  const isVencido = dias !== null && dias < 0

  return (
    <Link
      href={`/proyectos/${proyecto.id}`}
      className="group flex items-start gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer"
    >
      {/* Indicator */}
      <span className="mt-[3px] flex size-5 shrink-0 items-center justify-center">
        {isAprobado ? (
          <span className="text-emerald-500 text-[15px] leading-none">✓</span>
        ) : isConObs ? (
          <span className="size-2.5 rounded-full bg-red-500 mt-[3px] block" />
        ) : (
          <span className="size-2 rounded-full bg-primary/25 mt-[3px] block" />
        )}
      </span>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-primary">{proyecto.nombre}</span>
          {dias !== null && (
            <span className={cn(
              "text-[11px] font-medium tabular-nums",
              isVencido ? "text-red-600" :
              dias <= 7  ? "text-amber-600" :
              dias <= 30 ? "text-sky-600" :
                           "text-muted-foreground/60"
            )}>
              {isVencido
                ? `${Math.abs(dias)}d vencidas`
                : proyecto.fecha_estimada
                  ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" })
                      .format(new Date(`${proyecto.fecha_estimada}T00:00:00`))
                  : `${dias}d`}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/70">
          {clienteNombre(proyecto.cliente_id)} · {proyecto.municipio}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-primary/40" />
    </Link>
  )
}

function AlertaRow({ alerta }: { alerta: AlertaItem }) {
  return (
    <Link
      href={alerta.href}
      className="group flex items-start gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer"
    >
      <span className="mt-[3px] flex size-5 shrink-0 items-center justify-center">
        <AlertTriangle className="size-3.5 text-amber-500" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-amber-700">{alerta.titulo}</span>
          <span className="text-[11px] font-medium text-amber-600 tabular-nums">
            {alerta.diasRestantes}d restantes
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/70">{alerta.detalle}</p>
      </div>
      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-amber-400/60" />
    </Link>
  )
}

function TimelineSection({
  title,
  rows,
  empty,
}: {
  title: string
  rows: TimelineRow[]
  empty?: string
}) {
  if (rows.length === 0 && !empty) return null
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
        <span className="text-primary/30">▸</span>
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-10 py-2 text-[12px] text-muted-foreground/40 italic">{empty}</p>
      ) : (
        <div>
          {rows.map((row, i) =>
            row.kind === "proyecto" ? (
              <ProyectoRow key={row.proyecto.id} proyecto={row.proyecto} dias={row.dias} />
            ) : (
              <AlertaRow key={i} alerta={row.alerta} />
            )
          )}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { saludo, fechaCorta } = saludoFecha()
  const { sections, stats } = buildTimeline()

  const PIPELINE_LABELS: Partial<Record<EstadoExpediente, string>> = {
    borrador: "Borrador",
    ingresado: "Ingresado",
    en_revision: "En rev.",
    con_observaciones: "Con obs.",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  }

  const pipelineStr = (["borrador", "ingresado", "en_revision", "con_observaciones", "aprobado"] as EstadoExpediente[])
    .filter((e) => (stats.byEstado[e] ?? 0) > 0)
    .map((e) => `${stats.byEstado[e]} ${PIPELINE_LABELS[e]}`)
    .join(" · ")

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title={`${saludo}, Estefanía`}
        subtitle={fechaCorta}
        action={
          <Link
            href="/proyectos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Nuevo proyecto
          </Link>
        }
      />

      <div className="flex-1 px-6 py-5 space-y-6 max-w-3xl">

        {/* ── Hero Stats ── */}
        <div className="flex items-end gap-8 px-4">
          <div>
            <p className={cn(
              "text-[3rem] font-light leading-none tabular-nums",
              stats.urgentes > 0 ? "text-red-600" : "text-muted-foreground/30"
            )}>
              {stats.urgentes}
            </p>
            <p className={cn(
              "mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
              stats.urgentes > 0 ? "text-red-500" : "text-muted-foreground/40"
            )}>
              Urgentes
            </p>
          </div>
          <div>
            <p className="text-[3rem] font-light leading-none tabular-nums text-primary">{stats.activos}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">Activos</p>
          </div>
          <div>
            <p className="text-[3rem] font-light leading-none tabular-nums text-primary/50">{stats.diasPromedio}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">Días prom.</p>
          </div>
        </div>

        {/* ── Quick Action Pills ── */}
        <div className="flex flex-wrap items-center gap-2 px-4">
          {QUICK_ACTIONS.map(({ label, href, Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/6 px-3 py-1.5 text-[12px] font-medium text-primary/70 transition-colors hover:bg-primary/14 hover:text-primary"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* ── Timeline ── */}
        <div className="rounded-2xl border border-border bg-white py-4 space-y-4">

          <TimelineSection
            title="Acción requerida"
            rows={sections.accionRequerida}
            empty="Sin observaciones pendientes"
          />

          {(sections.accionRequerida.length > 0 && sections.proximos30d.length > 0) && (
            <div className="mx-4 border-t border-border" />
          )}

          <TimelineSection
            title="Próximos 30 días"
            rows={sections.proximos30d}
          />

          {sections.proximos30d.length > 0 && sections.enProceso.length > 0 && (
            <div className="mx-4 border-t border-border" />
          )}

          <TimelineSection
            title="En proceso"
            rows={sections.enProceso}
          />

          {sections.enProceso.length > 0 && sections.completado.length > 0 && (
            <div className="mx-4 border-t border-border" />
          )}

          <TimelineSection
            title="Completado"
            rows={sections.completado}
          />

          {/* Status bar */}
          {pipelineStr && (
            <>
              <div className="mx-4 border-t border-border" />
              <p className="px-4 text-center text-[11px] text-muted-foreground/40">
                {pipelineStr}
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
