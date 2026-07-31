"use client"

import { useEffect, useState } from "react"
import { DollarSign, Loader2, TrendingUp, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Tipos (contrato compartido con /api/billing/outsourcing)
// ---------------------------------------------------------------------------

interface CadenaBilling {
  cadena_id: string
  cadena_nombre: string
  n_locales: number
  tier: string
  fee_mensual_clp: number
}

interface OutsourcingBillingResponse {
  cadenas: CadenaBilling[]
  totals: {
    locales_total: number
    mrr_clp: number
    arr_clp: number
  }
}

// ---------------------------------------------------------------------------

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

function formatCLP(value: number): string {
  return clp.format(value)
}

// ---------------------------------------------------------------------------

export default function BillingPage() {
  const [data, setData] = useState<OutsourcingBillingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/billing/outsourcing")
        if (!res.ok) throw new Error("request failed")
        const json: OutsourcingBillingResponse = await res.json()
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) setError("No se pudo cargar el resumen de facturación.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const kpis = data
    ? [
        {
          label: "MRR total",
          value: formatCLP(data.totals.mrr_clp),
          icon: DollarSign,
        },
        {
          label: "ARR total",
          value: formatCLP(data.totals.arr_clp),
          icon: TrendingUp,
        },
        {
          label: "Cadenas activas",
          value: String(data.cadenas.length),
          icon: Users,
        },
        {
          label: "Locales bajo gestión",
          value: String(data.totals.locales_total),
          icon: Users,
        },
      ]
    : []

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
          Billing — Locales Gestionados
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Facturación del servicio de outsourcing de permisos por local activo.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      )}

      {error && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* KPI cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.label}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {kpi.label}
                      </CardTitle>
                      <Icon className="size-4 text-[#1A3328]" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold text-[#1A3328]">
                      {kpi.value}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Tabla */}
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cadena</TableHead>
                    <TableHead>N° locales</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Fee mensual</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.cadenas.map((cadena) => (
                    <TableRow key={cadena.cadena_id}>
                      <TableCell className="font-medium text-[#1A3328]">
                        {cadena.cadena_nombre}
                      </TableCell>
                      <TableCell>{cadena.n_locales}</TableCell>
                      <TableCell>{cadena.tier}</TableCell>
                      <TableCell>{formatCLP(cadena.fee_mensual_clp)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" disabled>
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Footer note */}
          <p className="mt-4 text-xs text-muted-foreground">
            Facturación por locales activos — actualizado al 1° de cada mes.
          </p>
        </>
      )}
    </div>
  )
}
