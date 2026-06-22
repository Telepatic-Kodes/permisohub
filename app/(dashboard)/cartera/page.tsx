"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Filter,
  Search,
  TrendingUp,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MOCK_PROYECTOS, MOCK_CLIENTES } from "@/lib/mock-data"
import { ESTADO_CONFIG, TIPO_PERMISO_LABELS } from "@/types"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────
// Mock members / locatarios visible en la cartera
// ──────────────────────────────────────────────────
const MOCK_LOCATARIOS = [
  { id: "l1", nombre: "Parque Arauco S.A.", tipo: "inmobiliaria", proyectosIds: ["1", "2"] },
  { id: "l2", nombre: "Vial & Asociados AG", tipo: "estudio",    proyectosIds: ["3", "4", "5"] },
  { id: "l3", nombre: "CBRE Chile",          tipo: "inmobiliaria", proyectosIds: ["6"] },
]

const ESTADO_ORDEN = ["borrador", "ingresado", "en_revision", "con_observaciones", "aprobado", "rechazado"] as const

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado as keyof typeof ESTADO_CONFIG]
  if (!cfg) return null
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", cfg.color)}>
      {cfg.label}
    </span>
  )
}

function AlertIcon({ count }: { count: number }) {
  if (count === 0) return <CheckCircle2 className="size-3.5 text-green-500" />
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
      <AlertTriangle className="size-3.5" />
      {count}
    </span>
  )
}

export default function CarteraPage() {
  const [search, setSearch] = useState("")
  const [groupBy, setGroupBy] = useState<"cliente" | "estado">("cliente")
  const [expanded, setExpanded] = useState<string[]>(MOCK_LOCATARIOS.map((l) => l.id))

  const [proyectos, setProyectos] = useState(MOCK_PROYECTOS)
  const [clientes, setClientes] = useState(MOCK_CLIENTES)

  useEffect(() => {
    fetch('/api/proyectos')
      .then((r) => r.json())
      .then((data: { data?: typeof MOCK_PROYECTOS; proyectos?: typeof MOCK_PROYECTOS }) => {
        const list = data.data ?? data.proyectos
        if (list && list.length > 0) {
          setProyectos(list)
        }
      })
      .catch(() => undefined)

    fetch('/api/clientes')
      .then((r) => r.json())
      .then((data: { data?: typeof MOCK_CLIENTES; clientes?: typeof MOCK_CLIENTES }) => {
        const list = data.data ?? data.clientes
        if (list && list.length > 0) {
          setClientes(list)
        }
      })
      .catch(() => undefined)
  }, [])

  // Stats globales
  const stats = useMemo(() => {
    const total     = proyectos.length
    const activos   = proyectos.filter((p) => !["aprobado", "rechazado"].includes(p.estado)).length
    const urgentes  = proyectos.filter((p) => p.estado === "con_observaciones").length
    const aprobados = proyectos.filter((p) => p.estado === "aprobado").length
    return { total, activos, urgentes, aprobados }
  }, [proyectos])

  // Distribución por estado
  const porEstado = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of proyectos) {
      map[p.estado] = (map[p.estado] ?? 0) + 1
    }
    return map
  }, [proyectos])

  const filteredProyectos = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return proyectos
    return proyectos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.municipio.toLowerCase().includes(q) ||
        (p.cliente?.nombre?.toLowerCase() ?? "").includes(q)
    )
  }, [proyectos, search])

  // Agrupar por cliente
  const gruposPorCliente = useMemo(() => {
    const map = new Map<string, typeof proyectos>()
    for (const p of filteredProyectos) {
      const key = p.cliente?.nombre ?? "Sin cliente"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [filteredProyectos])

  function toggleGroup(key: string) {
    setExpanded((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📊"
        title="Vista de Cartera"
        subtitle="Portafolio completo del workspace · Todos los proyectos"
        action={
          <Link
            href="/portal"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-primary hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <ExternalLink className="size-3.5" />
            Portal de cliente
          </Link>
        }
      />

      <div className="flex-1 p-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total proyectos", value: stats.total,    color: "text-primary" },
            { label: "Activos",         value: stats.activos,  color: "text-blue-600" },
            { label: "Con alertas",     value: stats.urgentes, color: "text-rose-600" },
            { label: "Aprobados",       value: stats.aprobados, color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-4 text-center">
              <p className={cn("text-3xl font-semibold tabular-nums", color)}>{value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Distribución por estado */}
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Distribución por estado</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ESTADO_ORDEN.map((estado) => {
              const n   = porEstado[estado] ?? 0
              const cfg = ESTADO_CONFIG[estado]
              if (!n) return null
              return (
                <div key={estado} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1", cfg.color)}>
                  <span className="text-xs font-semibold">{n}</span>
                  <span className="text-[10.5px]">{cfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Search + group */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Buscar proyecto, cliente, municipio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
            <span>Agrupar:</span>
            {(["cliente", "estado"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setGroupBy(opt)}
                className={cn(
                  "rounded-lg px-2.5 py-1 capitalize transition-colors",
                  groupBy === opt
                    ? "bg-primary text-white"
                    : "bg-white border border-border hover:border-primary/30"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Grupos de proyectos */}
        <div className="space-y-3">
          {gruposPorCliente.map(([clienteNombre, pList]) => {
            const isOpen = expanded.includes(clienteNombre)
            const alertas = pList.filter((p) => p.estado === "con_observaciones").length
            return (
              <div key={clienteNombre} className="rounded-xl border border-border bg-white overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(clienteNombre)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F9F7F3] transition-colors"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8 shrink-0">
                    <Building2 className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{clienteNombre}</p>
                    <p className="text-[10.5px] text-muted-foreground">{pList.length} proyecto{pList.length !== 1 ? "s" : ""}</p>
                  </div>
                  <AlertIcon count={alertas} />
                  <ChevronDown className={cn("size-4 text-muted-foreground/40 transition-transform shrink-0", isOpen && "rotate-180")} />
                </button>

                {/* Project rows */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border/60">
                    {pList.map((p) => (
                      <Link
                        key={p.id}
                        href={`/proyectos/${p.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-[#F9F7F3] transition-colors group"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[12.5px] font-medium text-primary truncate">{p.nombre}</p>
                            <EstadoBadge estado={p.estado} />
                          </div>
                          <p className="text-[10.5px] text-muted-foreground">
                            {p.municipio} · {TIPO_PERMISO_LABELS[p.tipo] ?? p.tipo}
                            {p.numero_expediente && ` · N° ${p.numero_expediente}`}
                          </p>
                          {p.fecha_estimada && (
                            <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                              <Clock className="size-3" />
                              Est. {new Date(p.fecha_estimada).toLocaleDateString("es-CL", { month: "short", year: "numeric" })}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground/20 group-hover:text-primary/40 transition-colors shrink-0 mt-0.5" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {filteredProyectos.length === 0 && (
            <div className="rounded-xl border border-border bg-white py-12 text-center">
              <p className="text-sm text-muted-foreground">No se encontraron proyectos para &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
