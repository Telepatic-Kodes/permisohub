"use client"

import { useEffect, useState } from "react"
import { TrendingUp, ChevronDown, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---- Types ----------------------------------------------------------------

interface DesgloseLine {
  concepto: string
  cantidad: number
  costo_unitario: number
  total: number
}

interface CentroCost {
  centro_id: string
  nombre: string
  municipio: string
  locales_sin_permiso: number
  costo_estimado_clp: number
  desglose: DesgloseLine[]
}

interface CronogramaEntry {
  mes: string
  acumulado: number
  nuevos: number
}

interface ForecastResumen {
  total_estimado_clp: number
  permisos_pendientes: number
  centros: number
}

interface ForecastData {
  ok: boolean
  resumen: ForecastResumen
  por_centro: CentroCost[]
  cronograma: CronogramaEntry[]
}

// ---- Helpers ---------------------------------------------------------------

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

function formatCLP(value: number): string {
  return clpFormatter.format(value)
}

// ---- Sub-components --------------------------------------------------------

function KpiCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function DesgloseRow({ centro }: { centro: CentroCost }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{centro.nombre}</TableCell>
        <TableCell>{centro.municipio}</TableCell>
        <TableCell className="text-center">{centro.locales_sin_permiso}</TableCell>
        <TableCell className="text-right font-medium">
          {formatCLP(centro.costo_estimado_clp)}
        </TableCell>
        <TableCell className="text-center">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            {open ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Ocultar
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                Ver detalle
              </>
            )}
          </button>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={5} className="py-0">
            <div className="py-3 pl-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Desglose de costos
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-1 pr-6 font-medium">Concepto</th>
                    <th className="pb-1 pr-6 font-medium text-center">Cantidad</th>
                    <th className="pb-1 pr-6 font-medium text-right">Unitario</th>
                    <th className="pb-1 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {centro.desglose.map((line) => (
                    <tr key={line.concepto} className="border-t border-border/50">
                      <td className="py-1 pr-6">{line.concepto}</td>
                      <td className="py-1 pr-6 text-center">{line.cantidad}</td>
                      <td className="py-1 pr-6 text-right">{formatCLP(line.costo_unitario)}</td>
                      <td className="py-1 text-right font-medium">{formatCLP(line.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function CronogramaBar({ cronograma }: { cronograma: CronogramaEntry[] }) {
  const maxValue = Math.max(...cronograma.map((e) => e.nuevos), 1)

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-foreground">
        Cronograma de costos — próximos 6 meses
      </p>
      <div className="flex items-end gap-3">
        {cronograma.map((entry) => {
          const heightPct = Math.round((entry.nuevos / maxValue) * 100)
          return (
            <div key={entry.mes} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs font-medium text-foreground">
                {formatCLP(entry.nuevos)}
              </span>
              <div className="w-full" style={{ height: "80px" }}>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${heightPct}%`,
                    backgroundColor: "#059669",
                    minHeight: entry.nuevos > 0 ? "4px" : "0",
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{entry.mes}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Main component --------------------------------------------------------

export function CostForecast({ cadenaId }: { cadenaId: string }) {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/cadenas/${cadenaId}/forecast`)
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? `Error ${res.status}`)
        }
        const json = (await res.json()) as ForecastData
        if (!cancelled) setData(json)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error desconocido")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [cadenaId])

  // ---- Loading state -------------------------------------------------------
  if (loading) {
    return (
      <div className="animate-pulse space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="h-6 w-64 rounded bg-muted" />
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-40 rounded bg-muted" />
      </div>
    )
  }

  // ---- Error state ---------------------------------------------------------
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
        <p className="text-sm font-medium text-destructive">
          No se pudo cargar la proyección de costos: {error}
        </p>
      </div>
    )
  }

  if (!data) return null

  const { resumen, por_centro, cronograma } = data

  // ---- Normal render -------------------------------------------------------
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          <h2 className="text-base font-semibold text-foreground">
            Proyección de Costos de Permisos
          </h2>
        </div>
        <span className="text-lg font-bold text-green-600">
          {formatCLP(resumen.total_estimado_clp)}
        </span>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <KpiCard
          label="Total estimado"
          value={formatCLP(resumen.total_estimado_clp)}
        />
        <KpiCard
          label="Permisos pendientes"
          value={resumen.permisos_pendientes}
        />
        <KpiCard
          label="Centros involucrados"
          value={resumen.centros}
        />
      </div>

      {/* Centro table */}
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centro</TableHead>
              <TableHead>Municipio</TableHead>
              <TableHead className="text-center">Locales sin permiso</TableHead>
              <TableHead className="text-right">Costo estimado</TableHead>
              <TableHead className="text-center">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {por_centro.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No hay centros para esta cadena.
                </TableCell>
              </TableRow>
            ) : (
              por_centro.map((centro) => (
                <DesgloseRow key={centro.centro_id} centro={centro} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cronograma */}
      {cronograma.length > 0 && <CronogramaBar cronograma={cronograma} />}
    </section>
  )
}
