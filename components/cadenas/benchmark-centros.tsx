"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface BenchmarkCentro {
  id: string
  nombre: string
  municipio: string
  locales_total: number
  con_permiso: number
  sin_permiso: number
  cobertura_pct: number
  tendencia: number
}

interface BenchmarkData {
  centros: BenchmarkCentro[]
  mejor_id: string
  peor_id: string
}

function PosBadge({ pos }: { pos: number }) {
  if (pos === 1) {
    return (
      <span className="inline-block border bg-amber-100 text-amber-800 border-amber-300 rounded px-2 font-bold text-xs">
        1
      </span>
    )
  }
  if (pos === 2) {
    return (
      <span className="inline-block border bg-slate-100 text-slate-600 border-slate-300 rounded px-2 font-bold text-xs">
        2
      </span>
    )
  }
  if (pos === 3) {
    return (
      <span className="inline-block border bg-orange-100 text-orange-700 border-orange-200 rounded px-2 font-bold text-xs">
        3
      </span>
    )
  }
  return <span className="text-muted-foreground text-xs px-2">{pos}</span>
}

function CoberturaCell({ pct }: { pct: number }) {
  const colorClass =
    pct >= 80 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
  const textClass =
    pct >= 80 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-600"

  return (
    <div className="flex flex-col gap-1">
      <span className={cn("text-sm font-medium", textClass)}>{pct}%</span>
      <div className="w-24 bg-muted rounded-full h-1.5">
        <div
          style={{ width: `${pct}%` }}
          className={cn("h-1.5 rounded-full", colorClass)}
        />
      </div>
    </div>
  )
}

function TendenciaCell({ tendencia }: { tendencia: number }) {
  if (tendencia > 0) {
    return (
      <span className="text-green-600 text-sm font-medium">
        ▲ +{tendencia}%
      </span>
    )
  }
  if (tendencia < 0) {
    return (
      <span className="text-red-500 text-sm font-medium">
        ▼ {tendencia}%
      </span>
    )
  }
  return <span className="text-muted-foreground text-sm">—</span>
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="animate-pulse bg-muted rounded h-4 w-8" />
          <div className="animate-pulse bg-muted rounded h-4 flex-1" />
          <div className="animate-pulse bg-muted rounded h-4 w-24" />
          <div className="animate-pulse bg-muted rounded h-4 w-16" />
          <div className="animate-pulse bg-muted rounded h-4 w-20" />
          <div className="animate-pulse bg-muted rounded h-4 w-16" />
          <div className="animate-pulse bg-muted rounded h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

export function BenchmarkCentros({ cadenaId }: { cadenaId: string }) {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/cadenas/${cadenaId}/benchmark`)
      .then((res) => res.json())
      .then((json: BenchmarkData) => {
        setData(json)
      })
      .catch(() => {
        setData(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [cadenaId])

  const mejorCentro = data?.centros.find((c) => c.id === data.mejor_id)
  const peorCentro = data?.centros.find((c) => c.id === data.peor_id)

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <span className="font-semibold">Ranking de centros</span>
        </div>
        <span className="text-muted-foreground text-sm">
          Cobertura de permisos comparativa
        </span>
      </div>

      {/* Callout cards */}
      {!loading && data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-green-200 bg-green-500/5 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Mejor centro</p>
            <p className="font-medium text-sm">{mejorCentro?.nombre ?? "—"}</p>
            <p className="text-green-600 font-semibold text-lg">
              {mejorCentro?.cobertura_pct ?? 0}%
            </p>
          </div>
          <div className="border border-red-200 bg-red-500/5 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Requiere atención</p>
            <p className="font-medium text-sm">{peorCentro?.nombre ?? "—"}</p>
            <p className="text-red-600 font-semibold text-lg">
              {peorCentro?.cobertura_pct ?? 0}%
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && <LoadingSkeleton />}

      {/* Table */}
      {!loading && data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">POS</TableHead>
              <TableHead>CENTRO</TableHead>
              <TableHead>MUNICIPIO</TableHead>
              <TableHead className="text-right">LOCALES</TableHead>
              <TableHead className="text-right">CON PERMISO</TableHead>
              <TableHead>COBERTURA</TableHead>
              <TableHead>TENDENCIA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.centros.map((centro, index) => (
              <TableRow key={centro.id}>
                <TableCell>
                  <PosBadge pos={index + 1} />
                </TableCell>
                <TableCell className="font-medium">{centro.nombre}</TableCell>
                <TableCell className="text-muted-foreground">{centro.municipio}</TableCell>
                <TableCell className="text-right">{centro.locales_total}</TableCell>
                <TableCell className="text-right">{centro.con_permiso}</TableCell>
                <TableCell>
                  <CoberturaCell pct={centro.cobertura_pct} />
                </TableCell>
                <TableCell>
                  <TendenciaCell tendencia={centro.tendencia} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Empty state */}
      {!loading && (!data || data.centros.length === 0) && (
        <p className="text-muted-foreground text-sm text-center py-6">
          No hay centros disponibles para esta cadena.
        </p>
      )}
    </div>
  )
}
