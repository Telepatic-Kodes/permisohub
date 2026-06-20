"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Search, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { MOCK_PROYECTOS, MUNICIPIOS_PRINCIPALES } from "@/lib/mock-data"
import { PLAN_LIMITS } from "@/lib/plan-limits"
import { ESTADO_CONFIG, TIPO_PERMISO_LABELS, type EstadoExpediente } from "@/types"

const ESTADO_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "borrador", label: "Borrador" },
  { value: "ingresado", label: "Ingresado" },
  { value: "en_revision", label: "En revisión" },
  { value: "con_observaciones", label: "Con observaciones" },
  { value: "aprobado", label: "Aprobado" },
]

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function ProyectosPage() {
  const [search, setSearch] = useState("")
  const [estado, setEstado] = useState("todos")
  const [municipio, setMunicipio] = useState("todos")

  // Feature gating (Starter plan): proyectos activos limitados.
  // El plan real se resuelve server-side; aquí mostramos un aviso informativo
  // cuando el total de proyectos alcanza el límite del plan Starter para
  // empujar al upgrade sin bloquear la navegación.
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
          Proyectos
        </h1>
        <Button
          nativeButton={false}
          render={<Link href="/proyectos/nuevo" />}
          className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
        >
          <Plus className="size-4" />
          Nuevo proyecto
        </Button>
      </div>

      {atStarterLimit && (
        <div className="flex items-start gap-3 rounded-xl border border-[#1A3328]/15 bg-[#1A3328]/5 p-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1A3328]/10">
            <Zap className="size-4 text-[#1A3328]" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-[#1A3328]">
              Alcanzaste el límite de proyectos del plan Starter
            </p>
            <p className="text-muted-foreground">
              El plan Starter permite hasta {starterLimit} proyectos activos.
              Pasa al plan Pro para proyectos ilimitados.
            </p>
          </div>
          <Link
            href="/configuracion/billing"
            className="shrink-0 self-center rounded-lg bg-[#1A3328] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1A3328]/90"
          >
            Ver planes Pro
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cliente o municipio..."
            className="pl-9"
          />
        </div>
        <Select value={estado} onValueChange={(v) => setEstado(v as string)}>
          <SelectTrigger className="sm:w-52">
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
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Municipio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {MUNICIPIOS_PRINCIPALES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proyecto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Municipio</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha inicio</TableHead>
              <TableHead>Fecha estimada</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {proyectos.map((p) => {
              const estadoCfg = ESTADO_CONFIG[p.estado as EstadoExpediente]
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-[#1A3328]">
                    {p.nombre}
                  </TableCell>
                  <TableCell>{p.cliente?.nombre ?? "—"}</TableCell>
                  <TableCell>{p.municipio}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {TIPO_PERMISO_LABELS[p.tipo]}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoCfg.color}`}
                    >
                      {estadoCfg.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.fecha_inicio)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.fecha_estimada)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      nativeButton={false}
                      render={<Link href={`/proyectos/${p.id}`} />}
                      variant="ghost"
                      size="sm"
                      className="text-[#1A3328]"
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
                  colSpan={8}
                  className="py-10 text-center text-muted-foreground"
                >
                  No se encontraron proyectos con los filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
