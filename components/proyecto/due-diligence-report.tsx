"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import PlanosAnotados from "@/components/proyecto/planos-anotados"
import { cn } from "@/lib/utils"
import type {
  DueDiligenceReportRow,
  DueDiligenceResult,
  EstadoInventario,
  EstadoRevision,
  Hallazgo,
  RefNormativa,
  RiesgoGlobal,
  Severidad,
  Vigencia,
} from "@/lib/due-diligence"

interface CambioHallazgo {
  codigo: string
  estadoRevision?: EstadoRevision
  tituloEditado?: string
  descripcionEditada?: string
}

const estadoRevisionDe = (h: Hallazgo): EstadoRevision => h.estadoRevision ?? "propuesto"

export interface DueDiligenceReportProps {
  proyectoId: string
  // Se llama tras poblar la PMO (etapas/observaciones) al completar un run nuevo.
  onApplied?: () => void
  // Notifica el estado del análisis (para reflejarlo en el wizard).
  onStatusChange?: (s: "idle" | "processing" | "done" | "error") => void
}

/** Estado de UI: incluye 'idle' además de los estados de la fila. */
type UiStatus = "idle" | "pending" | "processing" | "done" | "error"

const POLL_INTERVAL_MS = 2500

// ── Helpers de color ─────────────────────────────────────────────────────────

function riesgoClasses(riesgo: RiesgoGlobal): string {
  switch (riesgo) {
    case "ALTO":
      return "bg-red-50 text-red-700 border-red-500"
    case "MEDIO":
      return "bg-amber-50 text-amber-700 border-amber-500"
    case "BAJO":
      return "bg-emerald-50 text-emerald-700 border-emerald-500"
  }
}

function estadoInventarioClasses(estado: EstadoInventario): string {
  switch (estado) {
    case "faltante":
    case "acto_dom":
      return "bg-red-50 text-red-700 border border-red-200"
    case "revisar":
    case "corregir":
      return "bg-amber-50 text-amber-700 border border-amber-200"
    case "conforme":
    case "vigente":
    case "legible":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200"
    default:
      return "bg-muted text-muted-foreground border border-border"
  }
}

/** Stripe izquierdo + acento por severidad de hallazgo. */
function severidadClasses(severidad: Severidad): {
  stripe: string
  code: string
  label: string
} {
  switch (severidad) {
    case "critico":
      return { stripe: "border-l-red-500 bg-red-50/60", code: "text-red-700", label: "Crítico" }
    case "alto":
      return { stripe: "border-l-amber-500 bg-amber-50/60", code: "text-amber-700", label: "Alto" }
    case "medio":
      return { stripe: "border-l-blue-500 bg-blue-50/60", code: "text-blue-700", label: "Medio" }
  }
}

function vigenciaClasses(nivel: Vigencia["nivel"]): string {
  switch (nivel) {
    case "crit":
      return "bg-red-50 text-red-700 border border-red-200"
    case "warn":
      return "bg-amber-50 text-amber-700 border border-amber-200"
    case "ok":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200"
  }
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function DueDiligenceReport({ proyectoId, onApplied, onStatusChange }: DueDiligenceReportProps) {
  const [reportId, setReportId] = useState<string | null>(null)
  const [status, setStatus] = useState<UiStatus>("idle")
  const [progress, setProgress] = useState<DueDiligenceReportRow["progress"]>(null)
  const [result, setResult] = useState<DueDiligenceResult | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  // Verificación humana de los hallazgos.
  const [editando, setEditando] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState(false)

  // Persiste cambios de revisión (confirmar/editar/descartar) de forma
  // optimista y recalcula revisionEstado en memoria.
  const patchHallazgos = useCallback(
    async (cambios: CambioHallazgo[]) => {
      if (!reportId) return
      setResult((prev) => {
        if (!prev) return prev
        const map = new Map(cambios.map((c) => [c.codigo, c]))
        const hallazgos = prev.hallazgos.map((h) => {
          const c = map.get(h.codigo)
          if (!c) return h
          const next = { ...h }
          if (c.estadoRevision) next.estadoRevision = c.estadoRevision
          if (c.tituloEditado !== undefined) next.tituloEditado = c.tituloEditado || undefined
          if (c.descripcionEditada !== undefined) next.descripcionEditada = c.descripcionEditada || undefined
          return next
        })
        const quedan = hallazgos.some((h) => estadoRevisionDe(h) === "propuesto")
        return { ...prev, hallazgos, revisionEstado: quedan ? "pendiente" : "verificado" }
      })
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/due-diligence/hallazgos`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId, cambios }),
        })
        if (!res.ok) throw new Error(String(res.status))
      } catch {
        toast.error("No se pudo guardar la revisión. Reintenta.")
      }
    },
    [reportId, proyectoId],
  )

  const confirmarHallazgo = useCallback(
    (codigo: string) => void patchHallazgos([{ codigo, estadoRevision: "confirmado" }]),
    [patchHallazgos],
  )
  const descartarHallazgo = useCallback(
    (codigo: string) => void patchHallazgos([{ codigo, estadoRevision: "descartado" }]),
    [patchHallazgos],
  )
  const guardarEdicion = useCallback(
    (codigo: string, titulo: string, descripcion: string) => {
      void patchHallazgos([{ codigo, tituloEditado: titulo, descripcionEditada: descripcion, estadoRevision: "confirmado" }])
      setEditando(null)
    },
    [patchHallazgos],
  )

  // Confirmar el DD y poblar la PMO (solo con 0 hallazgos 'propuesto').
  const confirmarYContinuar = useCallback(async () => {
    if (!result) return
    const pendientes = result.hallazgos.filter((h) => estadoRevisionDe(h) === "propuesto").length
    if (pendientes > 0) {
      toast.error(`Revisa los ${pendientes} hallazgo(s) pendientes antes de continuar.`)
      return
    }
    setAplicando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/aplicar-dd`, { method: "POST" })
      if (!res.ok) {
        toast.error("No se pudo aplicar el due diligence.")
        return
      }
      toast.success("Due diligence verificado. Expediente actualizado.")
      onApplied?.()
    } finally {
      setAplicando(false)
    }
  }, [result, proyectoId, onApplied])

  const isProcessing = isStarting || status === "pending" || status === "processing"

  // Notifica el estado al padre (wizard) para reflejar el progreso.
  useEffect(() => {
    const s = isProcessing ? "processing" : status === "done" ? "done" : status === "error" ? "error" : "idle"
    onStatusChange?.(s)
  }, [isProcessing, status, onStatusChange])

  // Rehidratación: al montar, carga el último informe del proyecto. Si está
  // 'done' lo muestra; si sigue procesando, reanuda el polling.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/due-diligence`)
        if (!res.ok) return
        const { report } = (await res.json()) as { report: DueDiligenceReportRow | null }
        if (cancelled || !report) return
        if (report.status === "done" && report.result) {
          setResult(report.result)
          setStatus("done")
          setReportId(report.id) // necesario para PATCH de verificación
        } else if (report.status === "pending" || report.status === "processing") {
          setProgress(report.progress)
          setStatus(report.status)
          setReportId(report.id) // reanuda el polling
        }
      } catch {
        // sin rehidratación: queda el estado inicial (botón Generar)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyectoId])

  // Polling: se re-ejecuta solo cuando cambia reportId. Limpia el intervalo al
  // desmontar y cuando el status llega a 'done' o 'error'.
  useEffect(() => {
    if (!reportId) return

    let cancelled = false
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/ai/due-diligence/${reportId}`)
        if (!res.ok) return
        const row = (await res.json()) as DueDiligenceReportRow
        if (cancelled) return

        setStatus(row.status)
        setProgress(row.progress)

        if (row.status === "done") {
          setResult(row.result)
          clearInterval(intervalId)
          // Ya NO se auto-aplica: el DD queda 'pendiente' de verificación
          // humana. aplicar-dd lo dispara el botón "Confirmar y continuar".
        } else if (row.status === "error") {
          toast.error(row.error ?? "Ocurrió un error al generar el due diligence")
          clearInterval(intervalId)
        }
      } catch {
        // Error transitorio de red: se reintenta en el siguiente tick.
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [reportId])

  async function handleStart() {
    setIsStarting(true)
    setResult(null)
    setProgress(null)
    setReportId(null)
    setStatus("pending")

    try {
      const res = await fetch("/api/ai/due-diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId }),
      })

      if (res.status === 201) {
        const data = (await res.json()) as { reportId: string }
        setReportId(data.reportId)
        return
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.status === 402) {
        toast.error("Alcanzaste el límite de tu plan")
      } else if (res.status === 422) {
        toast.error("El proyecto no tiene documentos para analizar")
      } else if (res.status === 503) {
        toast.error("La IA no está configurada. Contacta al administrador.")
      } else {
        toast.error(data.error ?? "No se pudo iniciar el análisis")
      }
      setStatus("idle")
    } catch {
      toast.error("No se pudo iniciar el análisis")
      setStatus("idle")
    } finally {
      setIsStarting(false)
    }
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="size-4 text-primary/70" />
          Due Diligence documental
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Estado inicial / regenerar */}
        {!result && !isProcessing && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Lee todos los documentos del proyecto y genera un informe de completitud,
              hallazgos y estado ante la DOM.
            </p>
            <Button onClick={handleStart} disabled={isStarting}>
              <FileSearch className="size-4" />
              Generar Due Diligence
            </Button>
          </div>
        )}

        {/* Estado procesando */}
        {isProcessing && (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="size-4 animate-spin" />
              {progress?.label ?? "Iniciando análisis…"}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {progress && progress.total > 0 && (
              <p className="text-xs tabular-nums text-muted-foreground">
                {progress.current} / {progress.total} documentos
              </p>
            )}
          </div>
        )}

        {/* Informe */}
        {result && !isProcessing && (
          <div className="space-y-6">
            {/* Banner de rechazo */}
            {result.estadoDOM.rechazado && (
              <div className="rounded-lg border border-red-500 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <Ban className="size-5 shrink-0" />
                  <span className="text-sm font-bold tracking-tight">EXPEDIENTE RECHAZADO</span>
                </div>
                <div className="mt-2 space-y-0.5 text-xs text-red-700/90">
                  {result.estadoDOM.resolucion && (
                    <p>
                      <span className="font-semibold">Resolución:</span>{" "}
                      {result.estadoDOM.resolucion}
                    </p>
                  )}
                  {result.estadoDOM.fecha && (
                    <p>
                      <span className="font-semibold">Fecha:</span> {result.estadoDOM.fecha}
                    </p>
                  )}
                  {result.estadoDOM.expediente && (
                    <p>
                      <span className="font-semibold">Expediente:</span>{" "}
                      {result.estadoDOM.expediente}
                    </p>
                  )}
                  {result.estadoDOM.detalle && (
                    <p className="pt-1 leading-snug">{result.estadoDOM.detalle}</p>
                  )}
                </div>
              </div>
            )}

            {/* Encabezado del proyecto + regenerar */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{result.proyecto.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {[result.proyecto.direccion, result.proyecto.municipio, result.proyecto.rol]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleStart} disabled={isStarting}>
                <RefreshCw className="size-3.5" />
                Regenerar
              </Button>
            </div>

            {/* KPIs — cuadro de indicadores del expediente (dato con rigor de cota) */}
            <div className="grid grid-cols-2 divide-x divide-y divide-line-fine overflow-hidden rounded-[3px] border border-line-strong sm:grid-cols-4 sm:divide-y-0">
              <div className={cn("p-3", riesgoClasses(result.riesgoGlobal))}>
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5" />
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em]">Riesgo global</p>
                </div>
                <p className="font-technical mt-1.5 text-xl font-semibold leading-none">{result.riesgoGlobal}</p>
              </div>

              <div className="bg-card p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Completitud
                </p>
                <p className="num mt-1.5 text-xl font-semibold leading-none text-primary">
                  {result.completitud.presentes}
                  <span className="text-sm text-muted-foreground">/{result.completitud.esperados}</span>
                </p>
              </div>

              <div className="bg-card p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Hallazgos
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="num text-xl font-semibold leading-none" style={{ color: "var(--state-error)" }}>
                    {result.conteos.criticos}
                    <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">crít</span>
                  </span>
                  <span className="num text-xl font-semibold leading-none" style={{ color: "var(--state-warn)" }}>
                    {result.conteos.altos}
                    <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">alt</span>
                  </span>
                </div>
              </div>

              <div className="bg-card p-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Medios
                </p>
                <p className="num mt-1.5 text-xl font-semibold leading-none" style={{ color: "var(--blueprint)" }}>
                  {result.conteos.medios}
                </p>
              </div>
            </div>

            {/* Resumen ejecutivo */}
            {result.resumenEjecutivo && (
              <section className="space-y-1.5">
                <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Resumen ejecutivo
                </h3>
                <p className="text-sm leading-relaxed text-foreground">{result.resumenEjecutivo}</p>
              </section>
            )}

            {/* Inventario */}
            {result.inventario.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Inventario documental
                </h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">#</th>
                        <th className="px-3 py-2 font-medium">Documento</th>
                        <th className="px-3 py-2 font-medium">Estado</th>
                        <th className="px-3 py-2 font-medium">Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.inventario.map((item, idx) => (
                        <tr
                          key={`${item.indice}-${idx}`}
                          className="border-b border-border/60 last:border-0 align-top"
                        >
                          <td className="num px-3 py-2 text-muted-foreground">
                            {item.indice}
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-primary">{item.documento}</span>
                            {item.fecha && (
                              <span className="num ml-1.5 text-xs text-muted-foreground">
                                {item.fecha}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                                estadoInventarioClasses(item.estado)
                              )}
                            >
                              {item.estadoLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs leading-snug text-muted-foreground">
                            {item.observacion}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Hallazgos */}
            {result.hallazgos.length > 0 && (() => {
              const revisados = result.hallazgos.filter((h) => estadoRevisionDe(h) !== "propuesto").length
              const total = result.hallazgos.length
              const todoRevisado = revisados === total
              const yaVerificado = (result.revisionEstado ?? "pendiente") === "verificado"
              return (
              <section className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Hallazgos · verificación
                  </h3>
                  <span className="num text-[11px] text-muted-foreground">
                    {revisados} de {total} revisados
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Confirma, edita o descarta cada hallazgo. Solo lo confirmado pasa al PMO y a los planos.
                </p>
                <ul className="space-y-2">
                  {result.hallazgos.map((hallazgo) => (
                    <HallazgoCard
                      key={hallazgo.codigo}
                      hallazgo={hallazgo}
                      editando={editando === hallazgo.codigo}
                      onEditar={() => setEditando(hallazgo.codigo)}
                      onCancelar={() => setEditando(null)}
                      onGuardar={guardarEdicion}
                      onConfirmar={confirmarHallazgo}
                      onDescartar={descartarHallazgo}
                    />
                  ))}
                </ul>

                {/* Barra de verificación → poblar la PMO */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-line-strong bg-card px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {todoRevisado
                      ? yaVerificado
                        ? "Due diligence verificado. Puedes continuar al PMO."
                        : "Todos los hallazgos revisados. Confirma para actualizar el expediente."
                      : `Faltan ${total - revisados} hallazgo(s) por revisar.`}
                  </p>
                  <Button
                    size="sm"
                    disabled={!todoRevisado || aplicando}
                    onClick={() => void confirmarYContinuar()}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    {aplicando ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Confirmar Due Diligence y continuar →
                  </Button>
                </div>
              </section>
              )
            })()}

            {/* Historial */}
            {result.historial.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Historial
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.historial.map((nodo, idx) => (
                    <div
                      key={`${nodo.periodo}-${idx}`}
                      className={cn(
                        "rounded-lg border p-3",
                        nodo.critico ? "border-red-200 bg-red-50/50" : "border-border bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {nodo.periodo}
                        </span>
                        {nodo.m2 && (
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {nodo.m2}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-primary">{nodo.titulo}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {nodo.detalle}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Vigencias */}
            {result.vigencias.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Vigencias
                </h3>
                <ul className="space-y-1.5">
                  {result.vigencias.map((vig, idx) => (
                    <li
                      key={`${vig.hito}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-primary">{vig.hito}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {vig.fecha}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                          vigenciaClasses(vig.nivel)
                        )}
                      >
                        {vig.estado}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Próximos pasos */}
            {result.proximosPasos.length > 0 && (
              <section className="space-y-2">
                <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Próximos pasos
                </h3>
                <ol className="space-y-2">
                  {result.proximosPasos.map((paso, idx) => (
                    <li
                      key={`${paso.titulo}-${idx}`}
                      className={cn(
                        "flex gap-3 rounded-lg border p-3",
                        paso.critico ? "border-red-200 bg-red-50/50" : "border-border bg-muted/20"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                          paso.critico
                            ? "bg-red-500 text-white"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {paso.critico && (
                            <AlertTriangle className="size-3.5 shrink-0 text-red-500" />
                          )}
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              paso.critico ? "text-red-700" : "text-primary"
                            )}
                          >
                            {paso.titulo}
                          </p>
                        </div>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {paso.detalle}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Observaciones marcadas sobre los planos */}
            <PlanosAnotados proyectoId={proyectoId} result={result} />

            {/* Pie */}
            <footer className="space-y-1 border-t border-border pt-3">
              {result.generadoEl && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                  Generado el {result.generadoEl}
                </p>
              )}
              <p className="text-[11px] italic text-muted-foreground/70">
                Revisión documental preliminar, no constituye pronunciamiento de la DOM.
              </p>
            </footer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Cita normativa: link a la fuente o pill "sin fundamento verificado" ──────
function CitaBadges({ refs }: { refs: RefNormativa[] }) {
  const verificadas = refs.filter((r) => r.verificado)
  if (verificadas.length === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium"
        style={{
          color: "var(--state-warn)",
          borderColor: "var(--state-warn)",
          background: "color-mix(in oklch, var(--state-warn) 12%, transparent)",
        }}
        title="Ningún artículo de la base curada funda este hallazgo. Verifícalo contra la fuente oficial."
      >
        <AlertTriangle className="size-3" />
        Sin fundamento verificado
      </span>
    )
  }
  return (
    <>
      {verificadas.map((r) => (
        <a
          key={`${r.fuente}-${r.id}`}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="num inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
          title={`Ver ${r.etiqueta} en la fuente`}
        >
          {r.etiqueta}
          <ExternalLink className="size-2.5" />
        </a>
      ))}
    </>
  )
}

interface HallazgoCardProps {
  hallazgo: Hallazgo
  editando: boolean
  onEditar: () => void
  onCancelar: () => void
  onGuardar: (codigo: string, titulo: string, descripcion: string) => void
  onConfirmar: (codigo: string) => void
  onDescartar: (codigo: string) => void
}

function HallazgoCard({
  hallazgo,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
  onConfirmar,
  onDescartar,
}: HallazgoCardProps) {
  const sev = severidadClasses(hallazgo.severidad)
  const estado = estadoRevisionDe(hallazgo)
  const titulo = hallazgo.tituloEditado ?? hallazgo.titulo
  const descripcion = hallazgo.descripcionEditada ?? hallazgo.descripcion
  const refs = hallazgo.refNormativa ?? []
  const descartado = estado === "descartado"

  const [editTitulo, setEditTitulo] = useState(titulo)
  const [editDesc, setEditDesc] = useState(descripcion)

  if (editando) {
    return (
      <li className={cn("rounded-r-[3px] border-l-4 bg-card p-3", sev.stripe)}>
        <input
          value={editTitulo}
          onChange={(e) => setEditTitulo(e.target.value)}
          className="mb-2 w-full rounded-[3px] border border-line-med bg-background px-2 py-1 text-sm font-semibold text-primary"
        />
        <Textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          className="min-h-[64px] text-xs"
        />
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onGuardar(hallazgo.codigo, editTitulo, editDesc)}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <Check className="size-3.5" /> Guardar y confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelar}>
            Cancelar
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className={cn("rounded-r-[3px] border-l-4 p-3 transition-opacity", sev.stripe, descartado && "opacity-55")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("num text-xs font-bold", sev.code)}>{hallazgo.codigo}</span>
        <span className={cn("text-[10px] font-semibold uppercase", sev.code)}>{sev.label}</span>
        <span className={cn("text-sm font-semibold text-primary", descartado && "line-through")}>{titulo}</span>
        {estado === "confirmado" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--state-ok)" }}>
            <CheckCircle2 className="size-3" /> Confirmado
          </span>
        )}
        {descartado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Ban className="size-3" /> Descartado
          </span>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{descripcion}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CitaBadges refs={refs} />
        {hallazgo.refDOM && (
          <Badge variant="outline" className="num text-[10px]">
            {hallazgo.refDOM}
          </Badge>
        )}
        {hallazgo.refFuente && (
          <Badge variant="muted" className="text-[10px]">
            {hallazgo.refFuente}
          </Badge>
        )}
      </div>

      {/* Controles de verificación */}
      <div className="mt-2 flex items-center gap-1.5 border-t border-line-fine pt-2">
        <button
          type="button"
          onClick={() => onConfirmar(hallazgo.codigo)}
          className={cn(
            "inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] transition-colors",
            estado === "confirmado"
              ? "border-transparent text-white"
              : "border-line-med text-muted-foreground hover:border-[var(--state-ok)] hover:text-[var(--state-ok)]",
          )}
          style={estado === "confirmado" ? { background: "var(--state-ok)" } : undefined}
        >
          <Check className="size-3" /> Confirmar
        </button>
        <button
          type="button"
          onClick={onEditar}
          className="inline-flex items-center gap-1 rounded-[3px] border border-line-med px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
        >
          <Pencil className="size-3" /> Editar
        </button>
        <button
          type="button"
          onClick={() => onDescartar(hallazgo.codigo)}
          className={cn(
            "inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[11px] transition-colors",
            descartado
              ? "border-transparent text-white"
              : "border-line-med text-muted-foreground hover:border-[var(--state-error)] hover:text-[var(--state-error)]",
          )}
          style={descartado ? { background: "var(--state-error)" } : undefined}
        >
          <X className="size-3" /> Descartar
        </button>
      </div>
    </li>
  )
}
