import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  BookText,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Plus,
  ShieldCheck,
  Tag,
  Target,
  TrendingDown,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { EstadoNormativo, colorDeVeredicto, type Veredicto } from "@/components/arch/estado"
import { cn } from "@/lib/utils"
import type { EstadoExpediente, Proyecto } from "@/types"
import { createClient } from "@/lib/supabase/server"
import { getEstadoPlazoLey21718 } from "@/lib/dias-habiles"
import { obtenerBandasMercadoLocales, obtenerOportunidadesMercadoLocales } from "@/lib/mercado-locales-server"
import { obtenerResumenInstrumentosIptPorComunaId } from "@/lib/instrumentos-ipt-server"
import { fetchMacroData } from "@/lib/indicadores-macro"

// Mapea el estado del expediente al veredicto normativo (único color saturado).
function veredictoDeEstado(estado: EstadoExpediente): Veredicto {
  if (estado === "aprobado") return "cumple"
  if (estado === "con_observaciones") return "observa"
  if (estado === "rechazado") return "rechaza"
  return "neutro"
}

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


// ---------------------------------------------------------------------------
// Timeline data types
// ---------------------------------------------------------------------------

interface AlertaItem {
  titulo: string
  detalle: string
  href: string
  diasRestantes: number
}

function buildAlertasLey21718(proyectos: Proyecto[]): AlertaItem[] {
  const estados = new Set(['ingresado', 'en_revision', 'con_observaciones'])
  const alertas: AlertaItem[] = []
  for (const p of proyectos) {
    if (!p.fecha_inicio || !estados.has(p.estado)) continue
    const plazo = getEstadoPlazoLey21718(
      new Date(`${p.fecha_inicio}T00:00:00`),
      false
    )
    if (plazo.estado === 'VENCIDO') {
      alertas.push({
        titulo: `Plazo DOM VENCIDO — ${p.nombre}`,
        detalle: `${p.municipio} · ${plazo.diasHabilesDesdeIngreso} días hábiles transcurridos (límite 30)`,
        href: `/proyectos/${p.id}`,
        diasRestantes: 0,
      })
    } else if (plazo.estado === 'PROXIMO_VENCER') {
      alertas.push({
        titulo: `Plazo DOM próximo a vencer — ${p.nombre}`,
        detalle: `${p.municipio} · ${plazo.diasHabilesRestantes} días hábiles restantes`,
        href: `/proyectos/${p.id}`,
        diasRestantes: plazo.diasHabilesRestantes,
      })
    }
  }
  return alertas
}

type TimelineRow =
  | { kind: "proyecto"; proyecto: Proyecto; dias: number | null }
  | { kind: "alerta"; alerta: AlertaItem }

interface TimelineSections {
  accionRequerida: TimelineRow[]
  proximos30d: TimelineRow[]
  enProceso: TimelineRow[]
  completado: TimelineRow[]
}

function buildTimeline(proyectos: Proyecto[]): { sections: TimelineSections; stats: { activos: number; urgentes: number; diasPromedio: number; byEstado: Partial<Record<EstadoExpediente, number>>; alertasLey: number } } {
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
  const sorted = [...proyectos].sort((a, b) => {
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

  // Add Ley 21.718 deadline alerts to ACCIÓN REQUERIDA
  const alertasLey = buildAlertasLey21718(proyectos)
  for (const alerta of alertasLey) {
    accionRequerida.push({ kind: "alerta", alerta })
  }

  const activos = proyectos.filter((p) => !["aprobado", "rechazado"].includes(p.estado)).length
  const urgentes = proyectos.filter((p) => p.estado === "con_observaciones").length

  const activosConFecha = proyectos.filter(
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
    stats: { activos, urgentes, diasPromedio, byEstado, alertasLey: alertasLey.length },
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
  const veredicto = veredictoDeEstado(proyecto.estado)
  const isVencido = dias !== null && dias < 0

  // Color de plazo = estado normativo del plazo (vencido/próximo), nunca decorativo.
  const colorPlazo = isVencido
    ? "var(--state-error)"
    : dias !== null && dias <= 7
      ? "var(--state-warn)"
      : "var(--muted-foreground)"

  return (
    <Link
      href={`/proyectos/${proyecto.id}`}
      className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 cursor-pointer"
    >
      {/* Semáforo normativo */}
      <span
        className="mt-[7px] size-2 shrink-0 rounded-full"
        style={{ background: colorDeVeredicto(veredicto) }}
      />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-foreground">{proyecto.nombre}</span>
          {dias !== null && (
            <span className="num text-[11px] font-medium" style={{ color: colorPlazo }}>
              {isVencido
                ? `${Math.abs(dias)}d vencidas`
                : proyecto.fecha_estimada
                  ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" })
                      .format(new Date(`${proyecto.fecha_estimada}T00:00:00`))
                  : `${dias}d`}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
          {proyecto.cliente?.nombre ?? "—"} · {proyecto.municipio}
        </p>
      </div>

      {/* Estado normativo + arrow */}
      <div className="mt-0.5 flex shrink-0 items-center gap-2">
        <EstadoNormativo estado={veredicto} dot={false} className="hidden sm:inline-flex" />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-primary/40" />
      </div>
    </Link>
  )
}

function AlertaRow({ alerta }: { alerta: AlertaItem }) {
  const vencido = alerta.diasRestantes <= 0
  const color = vencido ? "var(--state-error)" : "var(--state-warn)"
  return (
    <Link
      href={alerta.href}
      className="group flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 cursor-pointer"
    >
      <span className="mt-[3px] flex size-4 shrink-0 items-center justify-center">
        <AlertTriangle className="size-3.5" style={{ color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-medium" style={{ color }}>{alerta.titulo}</span>
          <span className="num text-[11px] font-medium" style={{ color }}>
            {vencido ? "vencido" : `${alerta.diasRestantes}d restantes`}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{alerta.detalle}</p>
      </div>
      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-primary/40" />
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
      <h2 className="mb-1.5 flex items-center gap-1.5 px-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <span
          className="inline-block h-2 w-2 border border-[var(--blueprint)]"
          style={{ borderRightWidth: 0, borderBottomWidth: 0 }}
        />
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
// Panel de Mercado Inmobiliario — mitad derecha del hub compartido.
// Reusa exclusivamente funciones server ya construidas y verificadas en
// fases anteriores (Fase 1, 7, 8, Portal IPT) — no inventa ninguna query
// nueva. Cada llamada es independiente (Promise.allSettled): un problema en
// los datos de Mercado nunca debe romper la mitad de Permisos del hub.
// ---------------------------------------------------------------------------

interface OportunidadResumen {
  id: string
  titulo: string
  url: string
  comuna: string
  precioUf: number
}

interface MercadoResumenData {
  uf: number | null
  ufFecha: string | null
  medianaUfArriendo: number | null
  statsDate: string | null
  comunasConIpt: number
  oportunidadesActivas: number
  topOportunidades: OportunidadResumen[]
}

async function obtenerResumenMercado(): Promise<MercadoResumenData> {
  const [macroR, iptR, oportArriendoR, oportVentaR, bandasR] = await Promise.allSettled([
    fetchMacroData(),
    obtenerResumenInstrumentosIptPorComunaId(),
    obtenerOportunidadesMercadoLocales('arriendo', { limit: 5 }),
    obtenerOportunidadesMercadoLocales('venta', { limit: 5 }),
    obtenerBandasMercadoLocales('__TODAS__', 'arriendo'),
  ])

  const oportArriendo = oportArriendoR.status === 'fulfilled' ? oportArriendoR.value : []
  const oportVenta = oportVentaR.status === 'fulfilled' ? oportVentaR.value : []

  return {
    uf: macroR.status === 'fulfilled' ? macroR.value.uf : null,
    ufFecha: macroR.status === 'fulfilled' ? macroR.value.ufFecha : null,
    comunasConIpt: iptR.status === 'fulfilled' ? Object.keys(iptR.value).length : 0,
    oportunidadesActivas: oportArriendo.length + oportVenta.length,
    medianaUfArriendo: bandasR.status === 'fulfilled' ? (bandasR.value?.medianaUf ?? null) : null,
    statsDate: bandasR.status === 'fulfilled' ? (bandasR.value?.statsDate ?? null) : null,
    topOportunidades: [...oportArriendo, ...oportVenta]
      .sort((a, b) => (a.precioUfM2Normalizado ?? a.precioUfNormalizado) - (b.precioUfM2Normalizado ?? b.precioUfNormalizado))
      .slice(0, 3)
      .map((o) => ({ id: o.id, titulo: o.titulo, url: o.url, comuna: o.comuna, precioUf: o.precioUfNormalizado })),
  }
}

const MERCADO_QUICK_LINKS = [
  { label: "Pricing", href: "/mercado-inmobiliario/pricing", Icon: Tag },
  { label: "Oportunidades", href: "/mercado-inmobiliario/oportunidades", Icon: TrendingDown },
  { label: "Copiloto", href: "/mercado-inmobiliario/copiloto", Icon: Bot },
]

function formatFechaCorta(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "America/Santiago" }).format(new Date(`${iso}T00:00:00`))
}

function formatUf(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 1 })
}

async function MercadoInmobiliarioPanel() {
  const data = await obtenerResumenMercado()
  const fecha = formatFechaCorta(data.statsDate)

  return (
    <div className="flex h-full flex-col rounded-lg border border-line-fine bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line-fine bg-modulo-mercado-subtle px-4 py-3">
        <p className="font-technical text-[10px] font-semibold uppercase tracking-[0.18em] text-modulo-mercado">
          Mercado Inmobiliario
        </p>
        {fecha && <span className="num text-[10px] text-muted-foreground/60">Datos al {fecha}</span>}
      </div>

      <div className="grid grid-cols-2 divide-x divide-line-fine border-b border-line-fine sm:grid-cols-4">
        <div className="px-3 py-3">
          <p className="num text-lg font-semibold leading-none text-primary">
            {data.uf !== null ? data.uf.toLocaleString("es-CL", { maximumFractionDigits: 0 }) : "—"}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">UF hoy</p>
        </div>
        <div className="px-3 py-3">
          <p className="num text-lg font-semibold leading-none text-primary">{data.comunasConIpt || "—"}</p>
          <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">Comunas c/ IPT</p>
        </div>
        <div className="px-3 py-3">
          <p className="num text-lg font-semibold leading-none text-primary">{data.oportunidadesActivas}</p>
          <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">Oportunidades</p>
        </div>
        <div className="px-3 py-3">
          <p className="num text-lg font-semibold leading-none text-primary">
            {data.medianaUfArriendo !== null ? data.medianaUfArriendo.toLocaleString("es-CL", { maximumFractionDigits: 0 }) : "—"}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground">Mediana UF (arr.)</p>
        </div>
      </div>

      <section className="flex-1 border-b border-line-fine py-4">
        <h2 className="mb-1.5 flex items-center gap-1.5 px-4 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span
            className="inline-block h-2 w-2 border border-modulo-mercado"
            style={{ borderRightWidth: 0, borderBottomWidth: 0 }}
          />
          Mejores oportunidades
        </h2>
        {data.topOportunidades.length === 0 ? (
          <p className="px-10 py-2 text-[12px] text-muted-foreground/40 italic">Sin oportunidades activas hoy</p>
        ) : (
          <div>
            {data.topOportunidades.map((o) => (
              <a
                key={o.id}
                href={o.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 px-4 py-2 transition-colors hover:bg-modulo-mercado-subtle"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{o.titulo}</p>
                  <p className="text-[11px] text-muted-foreground">{o.comuna}</p>
                </div>
                <span className="num shrink-0 text-[13px] font-semibold text-modulo-mercado">{formatUf(o.precioUf)} UF</span>
              </a>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2 p-4 mt-auto">
        {MERCADO_QUICK_LINKS.map(({ label, href, Icon }) => (
          <Link
            key={href}
            href={href}
            className="inline-flex items-center gap-1.5 rounded-full border border-modulo-mercado/20 bg-modulo-mercado-subtle px-3 py-1.5 text-[12px] font-medium text-modulo-mercado transition-colors hover:bg-modulo-mercado/20"
          >
            <Icon className="size-3.5" />
            {label}
            <ExternalLink className="size-3 opacity-50" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  let proyectos: Proyecto[] = []
  let nombreUsuario = "Arquitecto"

  try {
    const supabase = await createClient()

    const [proyectosRes, profileRes] = await Promise.all([
      supabase
        .from('proyectos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('nombre')
        .single(),
    ])

    if (!proyectosRes.error && proyectosRes.data && proyectosRes.data.length > 0) {
      proyectos = proyectosRes.data as unknown as Proyecto[]
    }

    if (!profileRes.error && profileRes.data?.nombre) {
      // Use first name only for the greeting
      nombreUsuario = profileRes.data.nombre.split(' ')[0]
    }
  } catch {
    // Supabase not configured — leave projects empty
  }

  const { saludo, fechaCorta } = saludoFecha()
  const { sections, stats } = buildTimeline(proyectos)

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
        title={`${saludo}, ${nombreUsuario}`}
        subtitle={fechaCorta}
        moduloOverride={null}
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

      <div className="flex-1 bg-blueprint-grid">
      <div className="mx-auto max-w-7xl px-6 py-5">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">

        {/* ── Hero Stats ── */}
        <div className="rounded-lg border border-line-fine bg-card px-4 py-5">
          <div className="flex items-end gap-8">
            <div>
              <p className={cn(
                "num text-[3rem] font-light leading-none",
                stats.urgentes > 0 ? "text-[var(--state-error)]" : "text-muted-foreground/30"
              )}>
                {stats.urgentes}
              </p>
              <p className={cn(
                "mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                stats.urgentes > 0 ? "text-[var(--state-error)]" : "text-muted-foreground/40"
              )}>
                Urgentes
              </p>
            </div>
            <div>
              <p className="num text-[3rem] font-light leading-none text-primary">{stats.activos}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">Activos</p>
            </div>
            <div>
              <p className="num text-[3rem] font-light leading-none text-primary/50">{stats.diasPromedio}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">Días prom.</p>
            </div>
          </div>

          {/* ── Quick Action Pills ── */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
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
        </div>

        {/* ── Timeline ── */}
        <div className="rounded-lg border border-line-fine bg-card py-4 space-y-4">

          {proyectos.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aún no tienes proyectos. Crea tu primer proyecto para comenzar.
            </p>
          )}

          <TimelineSection
            title="Acción requerida"
            rows={sections.accionRequerida}
            empty={proyectos.length > 0 ? "Sin observaciones pendientes" : undefined}
          />

          {(sections.accionRequerida.length > 0 && sections.proximos30d.length > 0) && (
            <div className="mx-4 border-t border-line-fine" />
          )}

          <TimelineSection
            title="Próximos 30 días"
            rows={sections.proximos30d}
          />

          {sections.proximos30d.length > 0 && sections.enProceso.length > 0 && (
            <div className="mx-4 border-t border-line-fine" />
          )}

          <TimelineSection
            title="En proceso"
            rows={sections.enProceso}
          />

          {sections.enProceso.length > 0 && sections.completado.length > 0 && (
            <div className="mx-4 border-t border-line-fine" />
          )}

          <TimelineSection
            title="Completado"
            rows={sections.completado}
          />

          {/* Legend / pipeline */}
          {pipelineStr && (
            <>
              <div className="mx-4 border-t border-line-fine" />
              <p className="num px-4 text-center text-[11px] tracking-wide text-muted-foreground/50">
                {pipelineStr}
              </p>
            </>
          )}
        </div>

      </div>

      {/* ── Mercado Inmobiliario (columna derecha) ── */}
      <div className="space-y-6 h-full">
        <MercadoInmobiliarioPanel />
      </div>

      </div>
      </div>
      </div>
    </div>
  )
}
