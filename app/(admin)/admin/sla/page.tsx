"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, Gauge } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SLA_METAS } from "@/lib/sla-config"

interface CadenaSLA {
  cadena_id: string
  cadena_nombre: string
  avg_dias_ingreso: number
  proyectos_sin_expediente: number
  obs_pendientes: number
  sla_ok: boolean
}

type EstadoGeneral = "CUMPLE" | "EN RIESGO" | "VENCIDO"

function estadoGeneral(c: CadenaSLA): EstadoGeneral {
  if (c.sla_ok) return "CUMPLE"
  if (c.avg_dias_ingreso > SLA_METAS.ingreso_dom_dias || c.proyectos_sin_expediente > 0) {
    return "VENCIDO"
  }
  return "EN RIESGO"
}

const ESTADO_STYLES: Record<EstadoGeneral, string> = {
  CUMPLE: "bg-emerald-100 text-emerald-700",
  "EN RIESGO": "bg-amber-100 text-amber-700",
  VENCIDO: "bg-red-100 text-red-700",
}

function Pill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const cls = ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {children}
    </span>
  )
}

function CountPill({ count }: { count: number }) {
  const cls = count > 0 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {count}
    </span>
  )
}

export default function AdminSlaPage() {
  const [cadenas, setCadenas] = useState<CadenaSLA[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/sla")
      .then((r) => r.json())
      .then((json: { cadenas?: CadenaSLA[] }) => {
        setCadenas(json.cadenas ?? [])
      })
      .catch(() => setCadenas([]))
      .finally(() => setLoading(false))
  }, [])

  const { enRiesgo, totalObs } = useMemo(() => {
    return {
      enRiesgo: cadenas.filter((c) => !c.sla_ok).length,
      totalObs: cadenas.reduce((acc, c) => acc + c.obs_pendientes, 0),
    }
  }, [cadenas])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-8 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <Gauge className="size-6" />
          SLA Board — Compromisos de Servicio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingreso DOM: {SLA_METAS.ingreso_dom_dias}d | Respuesta observaciones:{" "}
          {SLA_METAS.respuesta_obs_dias}d | Renovación patente:{" "}
          {SLA_METAS.patente_renovacion_dias}d
        </p>
      </header>

      <div className="flex-1 space-y-6 p-8">
        {/* Summary bar */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  enRiesgo > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <AlertTriangle className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{enRiesgo}</p>
                <p className="text-xs text-muted-foreground">Cadenas en riesgo</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <Clock className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{totalObs}</p>
                <p className="text-xs text-muted-foreground">Observaciones pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">
                  {cadenas.length - enRiesgo}
                </p>
                <p className="text-xs text-muted-foreground">Cadenas al día</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Cadena</TableHead>
                <TableHead className="font-semibold">Días prom. ingreso</TableHead>
                <TableHead className="font-semibold">Expedientes pendientes</TableHead>
                <TableHead className="font-semibold">Obs. pendientes</TableHead>
                <TableHead className="font-semibold">Estado general</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    Cargando SLA…
                  </TableCell>
                </TableRow>
              ) : cadenas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    No hay datos de SLA disponibles.
                  </TableCell>
                </TableRow>
              ) : (
                cadenas.map((c) => {
                  const estado = estadoGeneral(c)
                  return (
                    <TableRow key={c.cadena_id} className="hover:bg-background">
                      <TableCell className="font-medium text-primary">
                        {c.cadena_nombre}
                      </TableCell>
                      <TableCell>
                        <Pill ok={c.avg_dias_ingreso <= SLA_METAS.ingreso_dom_dias}>
                          {c.avg_dias_ingreso}d
                        </Pill>
                      </TableCell>
                      <TableCell>
                        <CountPill count={c.proyectos_sin_expediente} />
                      </TableCell>
                      <TableCell>
                        <CountPill count={c.obs_pendientes} />
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_STYLES[estado]}`}
                        >
                          {estado}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
