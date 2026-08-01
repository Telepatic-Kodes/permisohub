"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DataSourceRunRow } from "@/app/api/admin/salud-datos/route"

interface ResumenPorFuente {
  sourceId: string
  ultimoEstado: "ok" | "error"
  ultimaCorrida: string
  ultimoRowCount: number | null
  ultimoError: string | null
  corridasVistas: number
}

function agruparPorFuente(runs: DataSourceRunRow[]): ResumenPorFuente[] {
  const porFuente = new Map<string, DataSourceRunRow[]>()
  for (const run of runs) {
    const lista = porFuente.get(run.source_id) ?? []
    lista.push(run)
    porFuente.set(run.source_id, lista)
  }

  return Array.from(porFuente.entries())
    .map(([sourceId, corridas]) => {
      const [ultima] = corridas // ya viene ordenado desc por ran_at desde la API
      return {
        sourceId,
        ultimoEstado: ultima.status,
        ultimaCorrida: ultima.ran_at,
        ultimoRowCount: ultima.row_count,
        ultimoError: ultima.error_message,
        corridasVistas: corridas.length,
      }
    })
    .sort((a, b) => new Date(b.ultimaCorrida).getTime() - new Date(a.ultimaCorrida).getTime())
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(iso))
}

export default function AdminSaludDatosPage() {
  const [runs, setRuns] = useState<DataSourceRunRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/salud-datos")
      .then((r) => r.json())
      .then((json: { runs?: DataSourceRunRow[] }) => setRuns(json.runs ?? []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [])

  const resumen = useMemo(() => agruparPorFuente(runs), [runs])
  const enError = resumen.filter((r) => r.ultimoEstado === "error").length

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-8 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <Activity className="size-6" />
          Salud de Datos — Torre de Control
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Última corrida registrada por fuente. Ver <code>.planning/data-sources.yaml</code> para
          el catálogo completo de fuentes (incluye las que aún no reportan aquí).
        </p>
      </header>

      <div className="flex-1 space-y-6 p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  enError > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <AlertTriangle className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{enError}</p>
                <p className="text-xs text-muted-foreground">Fuentes con última corrida en error</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{resumen.length - enError}</p>
                <p className="text-xs text-muted-foreground">Fuentes al día</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Activity className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{runs.length}</p>
                <p className="text-xs text-muted-foreground">Corridas registradas (últimas {runs.length})</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Fuente (source_id)</TableHead>
                <TableHead className="font-semibold">Última corrida</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="font-semibold">Filas</TableHead>
                <TableHead className="font-semibold">Error (si aplica)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : resumen.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                    Sin corridas registradas todavía. Las fuentes wireadas a recordSourceRun()
                    aparecerán acá después de su próxima ejecución programada.
                  </TableCell>
                </TableRow>
              ) : (
                resumen.map((r) => (
                  <TableRow key={r.sourceId} className="hover:bg-background">
                    <TableCell className="font-medium text-primary">{r.sourceId}</TableCell>
                    <TableCell className="num text-sm text-muted-foreground">
                      {formatFecha(r.ultimaCorrida)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.ultimoEstado === "ok"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.ultimoEstado === "ok" ? "OK" : "ERROR"}
                      </span>
                    </TableCell>
                    <TableCell className="num">{r.ultimoRowCount ?? "—"}</TableCell>
                    <TableCell className="max-w-sm truncate text-xs text-red-700">
                      {r.ultimoError ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
