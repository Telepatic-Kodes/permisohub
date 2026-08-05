"use client"

import { useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Gauge } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DataSourceRunRow, ResumenProbe } from "@/app/api/admin/salud-datos/route"
import type { EstadoSalud } from "@/lib/salud-fuentes"

interface ResumenIngesta {
  sourceId: string
  ultimoEstado: "ok" | "error"
  ultimaCorrida: string
  ultimoRowCount: number | null
  ultimoError: string | null
  corridasVistas: number
}

function agruparIngesta(runs: DataSourceRunRow[]): ResumenIngesta[] {
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

/** ms → "756 ms" / "10,4 s". Null se muestra "—", NUNCA como 0. */
function formatMs(ms: number | null): string {
  if (ms === null) return "—"
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} s`
}

const ESTILO_ESTADO: Record<EstadoSalud, { texto: string; clase: string }> = {
  ok: { texto: "OK", clase: "bg-emerald-100 text-emerald-700" },
  lento: { texto: "LENTO", clase: "bg-amber-100 text-amber-700" },
  caido: { texto: "CAÍDO", clase: "bg-red-100 text-red-700" },
  // Gris y no verde: "no medido" no es "sano". Si el cron dejó de correr,
  // esta fila tiene que verse distinta de una que sí se midió y salió bien.
  sin_datos: { texto: "SIN DATOS", clase: "bg-muted text-muted-foreground" },
}

export default function AdminSaludDatosPage() {
  const [probes, setProbes] = useState<ResumenProbe[]>([])
  const [ingesta, setIngesta] = useState<DataSourceRunRow[]>([])
  const [ventanaDias, setVentanaDias] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/salud-datos")
      .then((r) => r.json())
      .then((json: { probes?: ResumenProbe[]; ingesta?: DataSourceRunRow[]; ventanaDias?: number }) => {
        setProbes(json.probes ?? [])
        setIngesta(json.ingesta ?? [])
        setVentanaDias(json.ventanaDias ?? null)
      })
      .catch(() => {
        setProbes([])
        setIngesta([])
      })
      .finally(() => setLoading(false))
  }, [])

  const resumenIngesta = useMemo(() => agruparIngesta(ingesta), [ingesta])
  const enError = resumenIngesta.filter((r) => r.ultimoEstado === "error").length
  const fuentesConAlerta = probes.filter((p) => p.estado === "caido" || p.estado === "lento").length
  const sinMedir = probes.filter((p) => p.estado === "sin_datos").length

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-8 py-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <Activity className="size-6" />
          Salud de Datos — Torre de Control
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dos preguntas distintas, dos tablas: <strong>disponibilidad</strong> de las fuentes externas
          del camino crítico, e <strong>ingesta</strong> de los scrapers.{" "}
          {ventanaDias !== null && `Ventana: últimos ${ventanaDias} días.`} Ver{" "}
          <code>.planning/data-sources.yaml</code> para el catálogo completo.
        </p>
      </header>

      <div className="flex-1 space-y-8 p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  fuentesConAlerta > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <Gauge className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{fuentesConAlerta}</p>
                <p className="text-xs text-muted-foreground">Fuentes externas caídas o lentas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  sinMedir > 0 ? "bg-amber-50 text-amber-600" : "bg-muted text-muted-foreground"
                }`}
              >
                <AlertTriangle className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{sinMedir}</p>
                <p className="text-xs text-muted-foreground">Probes sin ninguna medición en la ventana</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 px-5 py-4">
              <div
                className={`flex size-9 items-center justify-center rounded-lg ${
                  enError > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                <CheckCircle2 className="size-4" />
              </div>
              <div className="leading-tight">
                <p className="text-xl font-semibold tabular-nums">{enError}</p>
                <p className="text-xs text-muted-foreground">Scrapers con última corrida en error</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Fuentes externas (camino crítico)</h2>
            <p className="text-sm text-muted-foreground">
              Chequeo sintético diario. Mide si el servicio responde y qué tan rápido — no si la
              ingesta está al día.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Fuente</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold">Último chequeo</TableHead>
                  <TableHead className="font-semibold">Latencia</TableHead>
                  <TableHead className="font-semibold">Mediana / umbral</TableHead>
                  <TableHead className="font-semibold">Qué devolvió</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : (
                  probes.map((p) => (
                    <TableRow key={p.sourceId} className="hover:bg-background">
                      <TableCell>
                        <span className="font-medium text-primary">{p.sourceId}</span>
                        <span className="block text-xs text-muted-foreground">{p.nombre}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTILO_ESTADO[p.estado].clase}`}
                        >
                          {ESTILO_ESTADO[p.estado].texto}
                        </span>
                      </TableCell>
                      <TableCell className="num text-sm text-muted-foreground">
                        {p.ultimaCorrida ? formatFecha(p.ultimaCorrida) : "nunca"}
                      </TableCell>
                      <TableCell className="num">{formatMs(p.ultimaDuracionMs)}</TableCell>
                      <TableCell className="num text-sm text-muted-foreground">
                        {formatMs(p.medianaMs)} / {formatMs(p.umbralLatenciaMs)}
                      </TableCell>
                      <TableCell className="max-w-sm truncate text-xs">
                        {p.error ? (
                          <span className="text-red-700">{p.error}</span>
                        ) : (
                          <span className="text-muted-foreground">{p.detalle ?? "—"}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-primary">Ingesta (scrapers y crons)</h2>
            <p className="text-sm text-muted-foreground">
              Última corrida registrada por fuente. Una fuente que no aparece acá no corrió en la
              ventana — que no es lo mismo que haber corrido bien.
            </p>
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
                ) : resumenIngesta.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      Sin corridas de ingesta en la ventana. Las fuentes wireadas a recordSourceRun()
                      aparecerán acá después de su próxima ejecución programada.
                    </TableCell>
                  </TableRow>
                ) : (
                  resumenIngesta.map((r) => (
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
        </section>
      </div>
    </div>
  )
}
