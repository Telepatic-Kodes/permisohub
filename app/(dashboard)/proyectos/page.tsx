"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Building2,
  Calendar,
  Columns3,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Search,
  Zap,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  EstadoNormativo,
  colorDeVeredicto,
  veredictoDeExpediente,
} from "@/components/arch/estado"
import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"
import { PLAN_LIMITS } from "@/lib/plan-limits"
import {
  TIPO_PERMISO_LABELS,
  type EstadoExpediente,
  type Proyecto,
} from "@/types"
import { cn } from "@/lib/utils"

type ViewMode = "kanban" | "grid" | "lista"

const ESTADOS_ORDERED: EstadoExpediente[] = [
  "borrador",
  "ingresado",
  "en_revision",
  "con_observaciones",
  "aprobado",
  "rechazado",
]

const ESTADO_COLUMN_LABEL: Record<EstadoExpediente, string> = {
  borrador:          "Borrador",
  ingresado:         "Ingresado",
  en_revision:       "En revisión",
  con_observaciones: "Con observaciones",
  aprobado:          "Aprobado",
  rechazado:         "Rechazado",
}

// El punto de la columna sigue la regla del sistema: color saturado SOLO
// cuando el estado es un veredicto de la DOM; las etapas previas van en tinta.
function estadoDotColor(estado: EstadoExpediente): string {
  const { veredicto } = veredictoDeExpediente(estado)
  return veredicto === "neutro" ? "var(--line-strong)" : colorDeVeredicto(veredicto)
}

const ESTADO_OPTIONS = [
  { value: "todos", label: "Todos los estados" },
  { value: "borrador", label: "Borrador" },
  { value: "ingresado", label: "Ingresado" },
  { value: "en_revision", label: "En revisión" },
  { value: "con_observaciones", label: "Con observaciones" },
  { value: "aprobado", label: "Aprobado" },
  { value: "rechazado", label: "Rechazado" },
]

function formatDate(value?: string) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  })
}

// ---------------------------------------------------------------------------
// Project card — used in kanban + grid
// ---------------------------------------------------------------------------
// La tarjeta es un mini-rótulo: esquina de escuadra, nombre en tipografía
// técnica, estado como veredicto normativo y pie de celdas con línea fina.
function ProyectoCard({
  proyecto,
  compact = false,
}: {
  proyecto: Proyecto
  compact?: boolean
}) {
  const fecha = formatDate(proyecto.fecha_estimada)
  const { veredicto, label } = veredictoDeExpediente(proyecto.estado)

  return (
    <Link href={`/proyectos/${proyecto.id}`} className="block group">
      <div className="rotulo overflow-hidden bg-card transition-colors hover:border-[var(--blueprint)]/40">
        <div className={cn(compact ? "px-3 pt-2.5 pb-2" : "px-4 pt-3 pb-2.5")}>
          <div className="flex items-start justify-between gap-2">
            <p className="flex min-w-0 items-center gap-1.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 border border-[var(--blueprint)]"
                style={{ borderRightWidth: 0, borderBottomWidth: 0 }}
              />
              <span className="truncate">{proyecto.numero_expediente ?? "Sin expediente"}</span>
            </p>
            {fecha && (
              <span className="num flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                <Calendar className="size-3" />
                {fecha}
              </span>
            )}
          </div>

          <h3
            className={cn(
              "font-technical mt-1.5 font-semibold leading-snug text-foreground transition-colors group-hover:text-primary line-clamp-2",
              compact ? "text-[13px]" : "text-sm"
            )}
          >
            {proyecto.nombre}
          </h3>

          <div className={cn("flex flex-col gap-1", compact ? "mt-1.5" : "mt-2")}>
            {proyecto.cliente?.nombre && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="size-3 shrink-0" />
                <span className="truncate">{proyecto.cliente.nombre}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{proyecto.municipio}</span>
            </div>
          </div>
        </div>

        {/* Pie de rótulo: veredicto + tipo de trámite en celdas */}
        <div className="flex items-center justify-between gap-2 border-t border-line-fine px-3 py-2">
          <EstadoNormativo estado={veredicto} label={label} className="text-[10px]" />
          {!compact && (
            <span className="truncate text-[10.5px] text-muted-foreground">
              {TIPO_PERMISO_LABELS[proyecto.tipo]}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Kanban column
// ---------------------------------------------------------------------------
function KanbanColumn({
  estado,
  proyectos,
}: {
  estado: EstadoExpediente
  proyectos: Proyecto[]
}) {
  return (
    <div className="flex w-[272px] shrink-0 flex-col">
      {/* Column header — cabecera de columna como título de sección de lámina */}
      <div className="mb-3 flex items-center gap-2 border-b border-line-med px-0.5 pb-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: estadoDotColor(estado) }}
        />
        <span className="font-technical text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">
          {ESTADO_COLUMN_LABEL[estado]}
        </span>
        <span className="num ml-auto rounded-[3px] border border-line-fine px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
          {proyectos.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 min-h-[80px]">
        {proyectos.map((p) => (
          <ProyectoCard key={p.id} proyecto={p} compact />
        ))}
        {proyectos.length === 0 && (
          <div className="rounded-[3px] border border-dashed border-line-med bg-muted/20 px-3 py-5 text-center">
            <p className="text-xs text-muted-foreground">Sin proyectos</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ProyectosPage() {
  const [search, setSearch] = useState("")
  const [estado, setEstado] = useState("todos")
  const [municipio, setMunicipio] = useState("todos")
  const [view, setView] = useState<ViewMode>("kanban")
  const [allProyectos, setAllProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((json: { data: Proyecto[]; source: string }) => {
        if (json.data && json.data.length > 0) {
          setAllProyectos(json.data)
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  const totalProyectos = allProyectos.length
  const starterLimit = PLAN_LIMITS.starter.projects
  const atStarterLimit = totalProyectos >= starterLimit

  const proyectos = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allProyectos.filter((p) => {
      const matchSearch =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.cliente?.nombre.toLowerCase().includes(q) ||
        p.municipio.toLowerCase().includes(q)
      const matchEstado = estado === "todos" || p.estado === estado
      const matchMunicipio = municipio === "todos" || p.municipio === municipio
      return matchSearch && matchEstado && matchMunicipio
    })
  }, [allProyectos, search, estado, municipio])

  const kanbanColumns = useMemo(
    () =>
      ESTADOS_ORDERED.map((e) => ({
        estado: e,
        proyectos: proyectos.filter((p) => p.estado === e),
      })),
    [proyectos]
  )

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Proyectos"
        subtitle="Expedientes de edificación de la oficina"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/proyectos/zonificacion" />}
            >
              <MapPin className="size-4" />
              Zonificación
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/proyectos/nuevo" />}
              className="bg-primary text-white hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Nuevo proyecto
            </Button>
          </div>
        }
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, cliente o municipio..."
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <Select value={estado} onValueChange={(v) => setEstado(v as string)}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {ESTADO_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={municipio} onValueChange={(v) => setMunicipio(v as string)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Municipio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los municipios</SelectItem>
                {COMUNAS_CHILE.slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.nombre}>
                      {c.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* View switcher */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
              {(
                [
                  { mode: "kanban" as ViewMode, Icon: Columns3, label: "Kanban" },
                  { mode: "grid" as ViewMode, Icon: LayoutGrid, label: "Cuadrícula" },
                  { mode: "lista" as ViewMode, Icon: List, label: "Lista" },
                ] as const
              ).map(({ mode, Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  title={label}
                  onClick={() => setView(mode)}
                  className={cn(
                    "flex items-center justify-center rounded-md p-1.5 transition-colors",
                    view === mode
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-auto bg-blueprint-grid p-8 space-y-4">
        {/* Upgrade banner */}
        {atStarterLimit && (
          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="size-4 text-primary" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium text-primary">
                Alcanzaste el límite de proyectos del plan Starter
              </p>
              <p className="text-muted-foreground text-xs mt-0.5">
                El plan Starter permite hasta {starterLimit} proyectos activos. Pasa al plan Pro para proyectos ilimitados.
              </p>
            </div>
            <Link
              href="/configuracion/billing"
              className="shrink-0 self-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
            >
              Ver planes Pro
            </Link>
          </div>
        )}

        {/* Results count */}
        {!(!loading && allProyectos.length === 0) && (
          <p className="-mt-1 text-xs text-muted-foreground">
            {proyectos.length} proyecto{proyectos.length !== 1 ? "s" : ""}
            {search || estado !== "todos" || municipio !== "todos" ? " filtrados" : " en total"}
          </p>
        )}

      {/* ------------------------------------------------------------------ */}
      {/* EMPTY STATE                                                         */}
      {/* ------------------------------------------------------------------ */}
      {!loading && allProyectos.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">Aún no tienes proyectos.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea tu primer proyecto para comenzar a gestionar tus permisos.
          </p>
        </div>
      )}

      {allProyectos.length > 0 && (
        <>
      {/* ------------------------------------------------------------------ */}
      {/* KANBAN VIEW                                                         */}
      {/* ------------------------------------------------------------------ */}
      {view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {kanbanColumns.map(({ estado: e, proyectos: cols }) => (
              <KanbanColumn key={e} estado={e} proyectos={cols} />
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* GRID VIEW                                                           */}
      {/* ------------------------------------------------------------------ */}
      {view === "grid" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 pb-4">
          {proyectos.map((p) => (
            <ProyectoCard key={p.id} proyecto={p} />
          ))}
          {proyectos.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
              No se encontraron proyectos con los filtros aplicados.
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* LIST VIEW                                                           */}
      {/* ------------------------------------------------------------------ */}
      {view === "lista" && (
        <div className="rotulo overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.12em]">Proyecto</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.12em]">Cliente</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.12em]">Municipio</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.12em]">Estado</TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-[0.12em]">Fecha estimada</TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-[0.12em]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyectos.map((p) => {
                const { veredicto, label } = veredictoDeExpediente(p.estado)
                return (
                <TableRow key={p.id} className="hover:bg-background">
                  <TableCell>
                    <div>
                      <p className="font-technical text-sm font-medium text-foreground">{p.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {TIPO_PERMISO_LABELS[p.tipo]}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.cliente?.nombre ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.municipio}
                  </TableCell>
                  <TableCell>
                    <EstadoNormativo estado={veredicto} label={label} />
                  </TableCell>
                  <TableCell className="num text-sm text-muted-foreground">
                    {formatDate(p.fecha_estimada) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      nativeButton={false}
                      render={<Link href={`/proyectos/${p.id}`} />}
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:bg-primary/5"
                    >
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
                )
              })}
              {proyectos.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron proyectos con los filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
        </>
      )}
      </div>
    </div>
  )
}
