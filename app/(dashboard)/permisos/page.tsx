"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Clock,
  HelpCircle,
  Plus,
  Shield,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TIPO_PERMISO_LABELS, type VigenciaPermiso } from "@/types"
import type { ProyectoConVigencia } from "@/app/api/permisos/route"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Constantes de presentación
// ---------------------------------------------------------------------------
type FiltroVigencia = "todos" | VigenciaPermiso

const FILTROS: { value: FiltroVigencia; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vigente", label: "Vigentes" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "vencido", label: "Vencidos" },
  { value: "sin_fecha", label: "Sin datos" },
]

const VIGENCIA_BADGE: Record<VigenciaPermiso, string> = {
  vigente: "bg-green-100 text-green-700",
  por_vencer: "bg-amber-100 text-amber-700",
  vencido: "bg-red-100 text-red-700",
  sin_fecha: "bg-slate-100 text-slate-500",
}

const VIGENCIA_LABEL: Record<VigenciaPermiso, string> = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_fecha: "Sin datos",
}

interface KpiConfig {
  key: VigenciaPermiso
  label: string
  Icon: typeof Shield
  numberClass: string
  iconClass: string
}

const KPIS: KpiConfig[] = [
  {
    key: "vigente",
    label: "Vigentes",
    Icon: Shield,
    numberClass: "text-green-600",
    iconClass: "text-green-500",
  },
  {
    key: "por_vencer",
    label: "Por vencer",
    Icon: Clock,
    numberClass: "text-amber-600",
    iconClass: "text-amber-500",
  },
  {
    key: "vencido",
    label: "Vencidos",
    Icon: AlertTriangle,
    numberClass: "text-red-600",
    iconClass: "text-red-500",
  },
  {
    key: "sin_fecha",
    label: "Sin datos",
    Icon: HelpCircle,
    numberClass: "text-slate-500",
    iconClass: "text-slate-400",
  },
]

interface Resumen {
  total: number
  vigentes: number
  por_vencer: number
  vencidos: number
  sin_fecha: number
}

const RESUMEN_VACIO: Resumen = {
  total: 0,
  vigentes: 0,
  por_vencer: 0,
  vencidos: 0,
  sin_fecha: 0,
}

const RESUMEN_KEY: Record<VigenciaPermiso, keyof Resumen> = {
  vigente: "vigentes",
  por_vencer: "por_vencer",
  vencido: "vencidos",
  sin_fecha: "sin_fecha",
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatFecha(value?: string): string {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function DiasCell({ permiso }: { permiso: ProyectoConVigencia }) {
  const { vigencia, dias_restantes } = permiso

  if (vigencia === "sin_fecha" || dias_restantes === null) {
    return <span className="text-slate-400">—</span>
  }

  if (dias_restantes < 0) {
    return (
      <span className="font-medium text-red-600">
        Vencido hace {Math.abs(dias_restantes)} día
        {Math.abs(dias_restantes) !== 1 ? "s" : ""}
      </span>
    )
  }

  const colorClass =
    vigencia === "vigente"
      ? "text-green-600"
      : vigencia === "por_vencer"
        ? "text-amber-600"
        : "text-red-600"

  return (
    <span className={cn("font-medium", colorClass)}>
      {dias_restantes} día{dias_restantes !== 1 ? "s" : ""}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Dialog para registrar/actualizar datos del permiso
// ---------------------------------------------------------------------------
function RegistrarPermisoDialog({
  permiso,
  onSaved,
}: {
  permiso: ProyectoConVigencia
  onSaved: (campos: {
    numero_permiso: string
    fecha_otorgamiento: string
    fecha_vencimiento_permiso: string
  }) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [numeroPermiso, setNumeroPermiso] = useState(permiso.numero_permiso ?? "")
  const [fechaOtorgamiento, setFechaOtorgamiento] = useState(
    permiso.fecha_otorgamiento ?? "",
  )
  const [fechaVencimiento, setFechaVencimiento] = useState(
    permiso.fecha_vencimiento_permiso ?? "",
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const campos = {
      numero_permiso: numeroPermiso.trim(),
      fecha_otorgamiento: fechaOtorgamiento,
      fecha_vencimiento_permiso: fechaVencimiento,
    }

    try {
      await fetch(`/api/proyectos/${permiso.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campos),
      })
    } catch {
      // Optimistic: actualizamos la tabla aunque la red falle en dev
    }

    onSaved(campos)
    setSaving(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        <Plus className="size-3.5" />
        Registrar permiso
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar permiso</DialogTitle>
          <DialogDescription>{permiso.nombre}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="numero_permiso">N° de permiso</Label>
            <Input
              id="numero_permiso"
              value={numeroPermiso}
              onChange={(e) => setNumeroPermiso(e.target.value)}
              placeholder="Ej. PE-2026-0123"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fecha_otorgamiento">Fecha de otorgamiento</Label>
              <Input
                id="fecha_otorgamiento"
                type="date"
                value={fechaOtorgamiento}
                onChange={(e) => setFechaOtorgamiento(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha_vencimiento_permiso">Fecha de vencimiento</Label>
              <Input
                id="fecha_vencimiento_permiso"
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell colSpan={10}>
            <div className="h-12 animate-pulse rounded-md bg-muted" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------
export default function PermisosPage() {
  const [filtro, setFiltro] = useState<FiltroVigencia>("todos")
  const [permisos, setPermisos] = useState<ProyectoConVigencia[]>([])
  const [resumen, setResumen] = useState<Resumen>(RESUMEN_VACIO)
  const [loading, setLoading] = useState(true)
  const [domChecks, setDomChecks] = useState<Record<string, { estado: string; etapa: string; fecha: string } | 'loading' | 'error'>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const qs = filtro === "todos" ? "" : `?vigencia=${filtro}`

    fetch(`/api/permisos${qs}`)
      .then((r) => r.json())
      .then(
        (json: {
          ok: boolean
          permisos: ProyectoConVigencia[]
          resumen: Resumen
        }) => {
          if (cancelled) return
          setPermisos(json.permisos ?? [])
          setResumen(json.resumen ?? RESUMEN_VACIO)
        },
      )
      .catch(() => {
        if (!cancelled) {
          setPermisos([])
          setResumen(RESUMEN_VACIO)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filtro])

  async function verificarEnDOM(permiso: ProyectoConVigencia) {
    if (!permiso.numero_expediente) return
    setDomChecks((prev) => ({ ...prev, [permiso.id]: 'loading' }))
    try {
      const res = await fetch('/api/scraper/dom-en-linea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expediente: permiso.numero_expediente,
          municipio: permiso.municipio,
        }),
      })
      const json = await res.json() as { ok: boolean; estado?: string; etapa?: string; fechaUltimaActualizacion?: string }
      if (json.ok) {
        setDomChecks((prev) => ({
          ...prev,
          [permiso.id]: {
            estado: json.estado ?? '—',
            etapa: json.etapa ?? '—',
            fecha: json.fechaUltimaActualizacion ?? '—',
          },
        }))
      } else {
        setDomChecks((prev) => ({ ...prev, [permiso.id]: 'error' }))
      }
    } catch {
      setDomChecks((prev) => ({ ...prev, [permiso.id]: 'error' }))
    }
  }

  function handleSaved(
    id: string,
    campos: {
      numero_permiso: string
      fecha_otorgamiento: string
      fecha_vencimiento_permiso: string
    },
  ) {
    setPermisos((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...campos,
              ...recalcVigencia(campos.fecha_vencimiento_permiso),
            }
          : p,
      ),
    )
  }

  const resumenValores = useMemo(
    () => ({
      vigente: resumen.vigentes,
      por_vencer: resumen.por_vencer,
      vencido: resumen.vencidos,
      sin_fecha: resumen.sin_fecha,
    }),
    [resumen],
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-white px-8 py-6">
        <h1 className="text-xl font-semibold text-foreground">
          Permisos Municipales
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vigencia y estado de permisos otorgados
        </p>
      </header>

      <div className="flex-1 space-y-6 overflow-auto p-8">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {KPIS.map(({ key, label, Icon, numberClass, iconClass }) => (
            <div
              key={key}
              className="rounded-xl border border-border bg-white p-4"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
                <Icon className={cn("size-5", iconClass)} />
              </div>
              <p className={cn("mt-2 text-3xl font-semibold", numberClass)}>
                {resumenValores[key]}
              </p>
            </div>
          ))}
        </div>

        {/* Tabs de filtro */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {FILTROS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFiltro(value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filtro === value
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Cliente</TableHead>
                <TableHead className="font-semibold">Proyecto</TableHead>
                <TableHead className="font-semibold">Municipio</TableHead>
                <TableHead className="font-semibold">N° Permiso</TableHead>
                <TableHead className="font-semibold">Otorgado</TableHead>
                <TableHead className="font-semibold">Vence</TableHead>
                <TableHead className="font-semibold">Días</TableHead>
                <TableHead className="font-semibold">N° Expediente</TableHead>
                <TableHead className="font-semibold">Estado DOM</TableHead>
                <TableHead className="text-right font-semibold">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <SkeletonRows />
              ) : permisos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No hay permisos que coincidan con el filtro seleccionado.
                  </TableCell>
                </TableRow>
              ) : (
                permisos.map((p) => (
                  <TableRow key={p.id} className="hover:bg-background">
                    <TableCell className="text-sm text-muted-foreground">
                      {p.cliente?.nombre ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {p.nombre}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {TIPO_PERMISO_LABELS[p.tipo]}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              VIGENCIA_BADGE[p.vigencia],
                            )}
                          >
                            {VIGENCIA_LABEL[p.vigencia]}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.municipio}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.numero_permiso ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFecha(p.fecha_otorgamiento)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFecha(p.fecha_vencimiento_permiso)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <DiasCell permiso={p} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.numero_expediente ?? "—"}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const check = domChecks[p.id]
                        if (!check) {
                          return p.numero_expediente ? (
                            <button
                              type="button"
                              onClick={() => void verificarEnDOM(p)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              Verificar en DOM
                            </button>
                          ) : <span className="text-muted-foreground/40">—</span>
                        }
                        if (check === 'loading') return <span className="text-xs text-muted-foreground animate-pulse">Consultando…</span>
                        if (check === 'error') return <span className="text-xs text-red-500">Error</span>
                        return (
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium">{check.estado}</p>
                            <p className="text-[10px] text-muted-foreground">{check.etapa}</p>
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <RegistrarPermisoDialog
                        permiso={p}
                        onSaved={(campos) => handleSaved(p.id, campos)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground">
          Los permisos de recepción final tienen vigencia indefinida salvo
          modificación de uso. Consulta con la DOM respectiva.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recálculo de vigencia en cliente (espejo de calcVigencia del API)
// ---------------------------------------------------------------------------
function recalcVigencia(fecha?: string): {
  vigencia: VigenciaPermiso
  dias_restantes: number | null
} {
  if (!fecha) return { vigencia: "sin_fecha", dias_restantes: null }

  const vence = new Date(`${fecha}T00:00:00`)
  if (Number.isNaN(vence.getTime())) {
    return { vigencia: "sin_fecha", dias_restantes: null }
  }

  const ahora = new Date()
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const diffDias = Math.round(
    (vence.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (hoy.getTime() > vence.getTime()) {
    return { vigencia: "vencido", dias_restantes: diffDias }
  }
  if (diffDias <= 30) return { vigencia: "por_vencer", dias_restantes: diffDias }
  return { vigencia: "vigente", dias_restantes: diffDias }
}
