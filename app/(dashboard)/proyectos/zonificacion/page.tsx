"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ListFilter, MapPin } from "lucide-react"

import { Dato } from "@/components/arch/dato"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { fixMojibakeArcGIS } from "@/lib/zonificacion-format"
import type { Proyecto } from "@/types"

// ---------------------------------------------------------------------------
// Dashboard de zonificación a nivel portafolio (backlog de PROJECT.md): antes
// había que entrar proyecto por proyecto para saber cuáles tenían zona
// resuelta. Reusa GET /api/proyectos (mismo endpoint del listado principal,
// ya trae zona_* completo) y el mismo mapeo zona_status→Veredicto que
// /terrenos/page.tsx — no se inventa un estado nuevo ni una fuente de datos
// paralela.
// ---------------------------------------------------------------------------

type ZonaStatus = NonNullable<Proyecto["zona_status"]>

const ZONA_STATUS_LABEL: Record<ZonaStatus, string> = {
  pendiente: "Consultando…",
  encontrado: "Zonificación encontrada",
  sin_cobertura: "Sin cobertura",
  error: "Error al consultar",
}

const ZONA_STATUS_VEREDICTO: Record<ZonaStatus, Veredicto> = {
  pendiente: "neutro",
  encontrado: "cumple",
  sin_cobertura: "observa",
  error: "rechaza",
}

export default function ZonificacionPortafolioPage() {
  const [proyectos, setProyectos] = useState<Proyecto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [filtroMunicipio, setFiltroMunicipio] = useState("todos")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch("/api/proyectos")
      .then((r) => r.json())
      .then((data: { data?: Proyecto[] }) => {
        if (!cancelled) setProyectos(data.data ?? [])
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // "Activos" = no archivados. El listado principal (/proyectos) mezcla
  // ambos; acá el propósito es operativo (qué falta resolver hoy), así que
  // los archivados se excluyen sin toggle — no hay caso de uso pedido para
  // volver a mirarlos desde este dashboard.
  const activos = useMemo(() => proyectos.filter((p) => !p.esta_archivado), [proyectos])

  const municipios = useMemo(
    () => Array.from(new Set(activos.map((p) => p.municipio).filter(Boolean))).sort(),
    [activos],
  )

  const resumen = useMemo(() => {
    const conteo: Record<ZonaStatus, number> = { pendiente: 0, encontrado: 0, sin_cobertura: 0, error: 0 }
    for (const p of activos) conteo[p.zona_status ?? "pendiente"]++
    return conteo
  }, [activos])

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activos.filter((p) => {
      if (filtroEstado !== "todos" && (p.zona_status ?? "pendiente") !== filtroEstado) return false
      if (filtroMunicipio !== "todos" && p.municipio !== filtroMunicipio) return false
      if (q && !p.nombre.toLowerCase().includes(q) && !(p.municipio ?? "").toLowerCase().includes(q)) return false
      return true
    })
  }, [activos, search, filtroEstado, filtroMunicipio])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Zonificación · Portafolio"
        subtitle="Estado de zonificación (PRC) de todos los proyectos activos, en una sola vista"
        breadcrumbs={[
          { label: "Proyectos", href: "/proyectos" },
          { label: "Zonificación" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        {!loading && (
          <div className="rotulo mb-6 grid grid-cols-2 divide-x divide-y divide-line-fine bg-card lg:grid-cols-4 lg:divide-y-0">
            <Dato className="px-4 py-3" label="Proyectos activos" valor={activos.length} />
            <Dato
              className="px-4 py-3"
              label="Zonificación encontrada"
              valor={resumen.encontrado}
              estado="cumple"
            />
            <Dato
              className="px-4 py-3"
              label="Pendientes"
              valor={resumen.pendiente}
            />
            <Dato
              className="px-4 py-3"
              label="Requiere atención"
              valor={resumen.sin_cobertura + resumen.error}
              estado={resumen.sin_cobertura + resumen.error > 0 ? "observa" : undefined}
            />
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre del proyecto o municipio..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado de zonificación</Label>
            <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as string)}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Estado de zonificación" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(Object.keys(ZONA_STATUS_LABEL) as ZonaStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{ZONA_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Municipio</Label>
            <Select value={filtroMunicipio} onValueChange={(v) => setFiltroMunicipio(v as string)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Municipio" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los municipios</SelectItem>
                {municipios.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando proyectos…</p>
        ) : filtrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {activos.length === 0
              ? "No hay proyectos activos todavía."
              : "Ningún proyecto calza con los filtros seleccionados."}
          </div>
        ) : (
          <>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ListFilter className="size-3.5" /> {filtrados.length} de {activos.length} proyectos activos
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Municipio</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Estado de zonificación</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const status = p.zona_status ?? "pendiente"
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Link href={`/proyectos/${p.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                          {p.nombre}
                        </Link>
                      </TableCell>
                      <TableCell>{p.municipio ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {status === "encontrado" ? (fixMojibakeArcGIS(p.zona_nombre) ?? "—") : "—"}
                      </TableCell>
                      <TableCell>
                        <EstadoNormativo estado={ZONA_STATUS_VEREDICTO[status]} label={ZONA_STATUS_LABEL[status]} />
                      </TableCell>
                      <TableCell className="text-xs capitalize text-muted-foreground">
                        {status === "encontrado" ? (p.zona_origen ?? "automático") : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/proyectos/${p.id}`} className="text-xs font-medium text-primary hover:underline">
                          Ver proyecto
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </div>
  )
}
