"use client"

import { useMemo, useState } from "react"
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
import { EstadoBadge } from "@/components/dashboard/estado-badge"
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
import { MOCK_PROYECTOS } from "@/lib/mock-data"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"
import { PLAN_LIMITS } from "@/lib/plan-limits"
import {
  TIPO_PERMISO_LABELS,
  type EstadoExpediente,
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

const ESTADO_COLUMN_DOT: Record<EstadoExpediente, string> = {
  borrador:          "bg-gray-400",
  ingresado:         "bg-sky-500",
  en_revision:       "bg-blue-500",
  con_observaciones: "bg-amber-500",
  aprobado:          "bg-emerald-500",
  rechazado:         "bg-red-500",
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
function ProyectoCard({
  proyecto,
  compact = false,
}: {
  proyecto: (typeof MOCK_PROYECTOS)[number]
  compact?: boolean
}) {
  const fecha = formatDate(proyecto.fecha_estimada)

  return (
    <Link href={`/proyectos/${proyecto.id}`} className="block group">
      <div
        className={cn(
          "rounded-xl border border-border bg-white transition-all hover:border-primary/20 hover:shadow-md",
          compact ? "p-3" : "p-4"
        )}
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <EstadoBadge estado={proyecto.estado} />
          {fecha && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
              <Calendar className="size-3" />
              {fecha}
            </span>
          )}
        </div>

        <h3
          className={cn(
            "mt-2.5 font-medium leading-snug text-primary group-hover:text-primary/80 transition-colors line-clamp-2",
            compact ? "text-[13px]" : "text-sm"
          )}
        >
          {proyecto.nombre}
        </h3>

        <div
          className={cn(
            "mt-2 flex flex-col gap-1",
            compact ? "mt-1.5" : "mt-2"
          )}
        >
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

        {!compact && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {TIPO_PERMISO_LABELS[proyecto.tipo]}
            </span>
          </div>
        )}
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
  proyectos: (typeof MOCK_PROYECTOS)
}) {
  return (
    <div className="flex w-[272px] shrink-0 flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span className={cn("size-2 rounded-full shrink-0", ESTADO_COLUMN_DOT[estado])} />
        <span className="text-sm font-medium text-foreground">
          {ESTADO_COLUMN_LABEL[estado]}
        </span>
        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
          {proyectos.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 min-h-[80px]">
        {proyectos.map((p) => (
          <ProyectoCard key={p.id} proyecto={p} compact />
        ))}
        {proyectos.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-5 text-center">
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

  const totalProyectos = MOCK_PROYECTOS.length
  const starterLimit = PLAN_LIMITS.starter.projects
  const atStarterLimit = totalProyectos >= starterLimit

  const proyectos = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_PROYECTOS.filter((p) => {
      const matchSearch =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.cliente?.nombre.toLowerCase().includes(q) ||
        p.municipio.toLowerCase().includes(q)
      const matchEstado = estado === "todos" || p.estado === estado
      const matchMunicipio = municipio === "todos" || p.municipio === municipio
      return matchSearch && matchEstado && matchMunicipio
    })
  }, [search, estado, municipio])

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
        emoji="📁"
        title="Proyectos"
        action={
          <Button
            nativeButton={false}
            render={<Link href="/proyectos/nuevo" />}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <Plus className="size-4" />
            Nuevo proyecto
          </Button>
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
                      ? "bg-white text-primary shadow-sm"
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

      <div className="flex-1 overflow-auto p-8 space-y-4">
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
        <p className="-mt-1 text-xs text-muted-foreground">
          {proyectos.length} proyecto{proyectos.length !== 1 ? "s" : ""}
          {search || estado !== "todos" || municipio !== "todos" ? " filtrados" : " en total"}
        </p>

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
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Proyecto</TableHead>
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Municipio</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="font-semibold">Fecha estimada</TableHead>
                <TableHead className="text-right font-semibold">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proyectos.map((p) => (
                <TableRow key={p.id} className="hover:bg-background">
                  <TableCell>
                    <div>
                      <p className="font-medium text-primary text-sm">{p.nombre}</p>
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
                    <EstadoBadge estado={p.estado} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
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
              ))}
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
      </div>
    </div>
  )
}
