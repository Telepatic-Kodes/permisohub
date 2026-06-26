"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import {
  Clock,
  HelpCircle,
  Receipt,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/dashboard/page-header"
import { RenovacionAlert } from "@/components/patentes/renovacion-alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { Proyecto } from "@/types"

type EstadoVigencia = "vigente" | "por_vencer" | "vencida" | "sin_datos"

type PatenteConVigencia = Proyecto & {
  dias_para_vencer: number | null
  estado_vigencia: EstadoVigencia
}

interface ResumenPatentes {
  total: number
  vigentes: number
  por_vencer: number
  vencidas: number
  sin_datos: number
}

interface PatentesResponse {
  ok: boolean
  patentes: PatenteConVigencia[]
  resumen: ResumenPatentes
}

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

function formatCLP(n: number | undefined): string {
  return typeof n === "number" ? CLP.format(n) : "—"
}

const VIGENCIA_BADGE: Record<EstadoVigencia, { label: string; className: string }> = {
  vigente: { label: "Vigente", className: "bg-green-100 text-green-700 border-green-200" },
  por_vencer: { label: "Por vencer", className: "bg-amber-100 text-amber-700 border-amber-200" },
  vencida: { label: "Vencida", className: "bg-red-100 text-red-700 border-red-200" },
  sin_datos: { label: "Sin datos", className: "bg-slate-100 text-slate-500 border-slate-200" },
}

const AÑOS: { label: string; value: string }[] = [
  { label: "2025", value: "2025" },
  { label: "2026", value: "2026" },
  { label: "Todos", value: "todos" },
]

const TABS_VIGENCIA: { label: string; value: "todas" | EstadoVigencia }[] = [
  { label: "Todas", value: "todas" },
  { label: "Vigentes", value: "vigente" },
  { label: "Por vencer", value: "por_vencer" },
  { label: "Vencidas", value: "vencida" },
  { label: "Sin datos", value: "sin_datos" },
]

const KPI_CONFIG: {
  key: keyof Omit<ResumenPatentes, "total">
  label: string
  icon: typeof ShieldCheck
  tone: string
}[] = [
  { key: "vigentes", label: "Vigentes", icon: ShieldCheck, tone: "text-green-600 bg-green-50 border-green-100" },
  { key: "por_vencer", label: "Por vencer <30d", icon: Clock, tone: "text-amber-600 bg-amber-50 border-amber-100" },
  { key: "vencidas", label: "Vencidas", icon: XCircle, tone: "text-red-600 bg-red-50 border-red-100" },
  { key: "sin_datos", label: "Sin datos", icon: HelpCircle, tone: "text-slate-500 bg-slate-50 border-slate-200" },
]

const EMPTY_RESUMEN: ResumenPatentes = {
  total: 0,
  vigentes: 0,
  por_vencer: 0,
  vencidas: 0,
  sin_datos: 0,
}

export default function PatentesPage() {
  const [año, setAño] = useState<string>("2026")
  const [tab, setTab] = useState<"todas" | EstadoVigencia>("todas")
  const [patentes, setPatentes] = useState<PatenteConVigencia[]>([])
  const [resumen, setResumen] = useState<ResumenPatentes>(EMPTY_RESUMEN)
  const [loading, setLoading] = useState(true)
  const [ufValor, setUfValor] = useState<number | null>(null)

  const fetchPatentes = useCallback(() => {
    setLoading(true)
    const qs = año !== "todos" ? `?año=${año}` : ""
    fetch(`/api/patentes${qs}`)
      .then((r) => r.json())
      .then((json: PatentesResponse) => {
        if (json.ok) {
          setPatentes(json.patentes)
          setResumen(json.resumen)
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [año])

  useEffect(() => {
    fetchPatentes()
  }, [fetchPatentes])

  useEffect(() => {
    fetch('/api/utils/uf')
      .then((r) => r.json())
      .then((d: { valor?: number }) => {
        if (d.valor) setUfValor(d.valor)
      })
      .catch(() => undefined)
  }, [])

  const patentesFiltradas = useMemo(
    () => (tab === "todas" ? patentes : patentes.filter((p) => p.estado_vigencia === tab)),
    [patentes, tab],
  )

  const handleRegistro = useCallback(
    (id: string, datos: Pick<Proyecto, "numero_patente" | "giro_sii" | "valor_derechos">) => {
      setPatentes((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...datos } : p)),
      )
    },
    [],
  )

  const handleRenovar = useCallback(async (patente: PatenteConVigencia, nuevoAño: number) => {
    try {
      const res = await fetch(`/api/patentes/${patente.id}/renovar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nuevo_año: nuevoAño }),
      })
      const json = (await res.json()) as { ok: boolean; patente?: PatenteConVigencia }
      if (json.ok && json.patente) {
        const nueva: PatenteConVigencia = {
          ...json.patente,
          dias_para_vencer: json.patente.dias_para_vencer ?? null,
          estado_vigencia: json.patente.estado_vigencia ?? "vigente",
        }
        setPatentes((prev) => [nueva, ...prev])
        toast.success("Renovación creada")
      } else {
        toast.error("No se pudo crear la renovación")
      }
    } catch {
      toast.error("No se pudo crear la renovación")
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Patentes Comerciales"
        subtitle="Gestión de patentes municipales y renovaciones anuales"
        action={
          <div className="flex size-10 items-center justify-center rounded-xl border border-primary/12 bg-primary/8 text-primary">
            <Receipt className="size-5" />
          </div>
        }
      />

      <div className="flex-1 space-y-6 overflow-auto p-8">
        {/* Banner de recargo por renovación tardía */}
        {(() => {
          const hoy = new Date()
          const añoActual = hoy.getFullYear()
          const marcheFin = new Date(añoActual, 2, 31) // 31 de marzo
          const hayPendientes = patentes.some(
            (p) => p.estado_vigencia === 'vencida' || p.estado_vigencia === 'por_vencer'
          )
          if (hoy > marcheFin && hayPendientes) {
            return (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="mt-0.5 text-amber-500">⚠</span>
                <div className="text-sm">
                  <span className="font-semibold text-amber-800">Renovaciones con recargo</span>
                  <span className="ml-1 text-amber-700">
                    El plazo sin recargo venció el 31 de marzo. Las patentes pendientes de renovación
                    incurrirán en recargos adicionales al presentarlas.
                  </span>
                </div>
              </div>
            )
          }
          return null
        })()}

        <RenovacionAlert patentes={patentes} />

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {KPI_CONFIG.map(({ key, label, icon: Icon, tone }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl border border-border bg-white p-4"
            >
              <div className={cn("flex size-10 items-center justify-center rounded-lg border", tone)}>
                <Icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-primary tabular-nums">{resumen[key]}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros: año + vigencia */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
            {AÑOS.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setAño(a.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  año === a.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="inline-flex flex-wrap gap-1">
            {TABS_VIGENCIA.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t.value
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Local / Dirección</TableHead>
                <TableHead>Municipio</TableHead>
                <TableHead>N° Patente</TableHead>
                <TableHead>Giro SII</TableHead>
                <TableHead>Año</TableHead>
                <TableHead>Derechos CLP</TableHead>
                <TableHead>Fecha pago</TableHead>
                <TableHead>Vence</TableHead>
                <TableHead>Días</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    <TableCell colSpan={12}>
                      <div className="h-12 animate-pulse rounded-md bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : patentesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-10 text-center text-sm text-muted-foreground">
                    No hay patentes para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              ) : (
                patentesFiltradas.map((p) => {
                  const badge = VIGENCIA_BADGE[p.estado_vigencia]
                  const proximoAño = (p.año_ejercicio ?? new Date().getFullYear()) + 1
                  return (
                    <TableRow key={p.id} className="hover:bg-primary/[0.02]">
                      <TableCell className="font-medium text-primary">
                        {p.cliente?.nombre ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.direccion}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.municipio}</TableCell>
                      <TableCell className="font-mono text-xs">{p.numero_patente ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.giro_sii ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">{p.año_ejercicio ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        <div>
                          <span>{formatCLP(p.valor_derechos)}</span>
                          {ufValor && p.valor_derechos ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ≈{(p.valor_derechos / ufValor).toFixed(1)} UF
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums text-sm">
                        {p.fecha_pago_derechos
                          ? new Date(`${p.fecha_pago_derechos}T00:00:00`).toLocaleDateString('es-CL', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {p.fecha_vencimiento_permiso ?? "—"}
                      </TableCell>
                      <TableCell>
                        {p.dias_para_vencer === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : p.dias_para_vencer < 0 ? (
                          <span className="font-medium text-red-600">Vencida</span>
                        ) : (
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              p.dias_para_vencer <= 30 ? "text-amber-600" : "text-green-600",
                            )}
                          >
                            {p.dias_para_vencer}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            badge.className,
                          )}
                        >
                          {badge.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <RegistrarNumeroDialog patente={p} onSaved={handleRegistro} />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRenovar(p, proximoAño)}
                          >
                            <RefreshCw className="size-3.5" />
                            Renovar {proximoAño}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Las patentes municipales vencen el 31 de diciembre de cada año. La renovación debe
          tramitarse antes del 31 de marzo para evitar recargos.
        </p>
      </div>
    </div>
  )
}

interface RegistrarNumeroDialogProps {
  patente: PatenteConVigencia
  onSaved: (
    id: string,
    datos: Pick<Proyecto, "numero_patente" | "giro_sii" | "valor_derechos">,
  ) => void
}

function RegistrarNumeroDialog({ patente, onSaved }: RegistrarNumeroDialogProps) {
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const numero_patente = (form.get("numero_patente") as string).trim()
    const giro_sii = (form.get("giro_sii") as string).trim()
    const valorRaw = (form.get("valor_derechos") as string).trim()
    const valor = valorRaw ? Number(valorRaw.replace(/\D/g, "")) : undefined

    onSaved(patente.id, {
      numero_patente: numero_patente || undefined,
      giro_sii: giro_sii || undefined,
      valor_derechos: typeof valor === "number" && !Number.isNaN(valor) ? valor : undefined,
    })
    toast.success("Datos de patente registrados")
    setSaving(false)
    closeRef.current?.click()
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Registrar número</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar número de patente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="numero_patente">N° Patente</Label>
            <Input
              id="numero_patente"
              name="numero_patente"
              placeholder="2026-LAS-04412"
              defaultValue={patente.numero_patente ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="giro_sii">Giro SII</Label>
            <Input
              id="giro_sii"
              name="giro_sii"
              placeholder="Venta al por menor…"
              defaultValue={patente.giro_sii ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valor_derechos">Derechos municipales (CLP)</Label>
            <Input
              id="valor_derechos"
              name="valor_derechos"
              inputMode="numeric"
              placeholder="285000"
              defaultValue={patente.valor_derechos ?? ""}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button ref={closeRef} variant="outline" type="button" />}>
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
