"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  GripVertical,
  Loader2,
  Mail,
  Plus,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { AsesorVia } from "@/components/proyecto/asesor-via"
import { ViaDecision } from "@/components/proyecto/via-decision"
import { CuadroCalculo } from "@/components/proyecto/cuadro-calculo"
import { getEstadoPlazoLey21718, formatFecha } from "@/lib/dias-habiles"
import type { Proyecto, Etapa, Comunicacion } from "@/types"
import type { DueDiligenceResult } from "@/lib/due-diligence"

export interface Observacion {
  id: string
  fecha: string
  numero: string
  texto: string
  estado: "pendiente" | "respondida"
}

interface PmoPanelProps {
  proyecto: Proyecto
  etapas: Etapa[]
  observaciones: Observacion[]
  comunicaciones: Comunicacion[]
  ddResult: DueDiligenceResult | null
  onAddObservacion: (numero: string, texto: string) => void
  onMarcarRespondida: (obsId: string) => void
  onAddComunicacion: (tipo: string, asunto: string, descripcion: string) => void
  onEmailSeguimiento: () => void
}

const COMUNICACION_LABELS: Record<string, string> = {
  email: "Email",
  llamada: "Llamada",
  visita: "Visita",
  notificacion: "Notificación",
  otro: "Otro",
}

function formatDate(value?: string) {
  if (!value) return "—"
  // Acepta date-only ("2026-07-02") y timestamps ISO completos ("2026-07-02T12:34:56Z").
  const iso = /[T ]\d{2}:\d{2}/.test(value) ? value : `${value}T00:00:00`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function PmoPanel({
  proyecto,
  etapas,
  observaciones,
  comunicaciones,
  ddResult,
  onAddObservacion,
  onMarcarRespondida,
  onAddComunicacion,
  onEmailSeguimiento,
}: PmoPanelProps) {
  // Observación DOM (dialog local)
  const [obsDialogOpen, setObsDialogOpen] = useState(false)
  const [obsNumero, setObsNumero] = useState("")
  const [obsTexto, setObsTexto] = useState("")

  // Comunicación (dialog local)
  const [comDialogOpen, setComDialogOpen] = useState(false)
  const [comTipo, setComTipo] = useState("email")
  const [comAsunto, setComAsunto] = useState("")
  const [comDesc, setComDesc] = useState("")

  // Etapas editables (clic para cambiar estado, arrastrar para reordenar).
  const [etapasLocal, setEtapasLocal] = useState<Etapa[]>(etapas)
  useEffect(() => setEtapasLocal(etapas), [etapas])
  const dragIdx = useRef<number | null>(null)

  const persistirEtapas = async (rows: Etapa[]) => {
    try {
      const res = await fetch(`/api/proyectos/${proyecto.id}/etapas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etapas: rows.map((e) => ({ id: e.id, estado: e.estado, orden: e.orden })),
        }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error("No se pudo guardar el cambio de etapa")
    }
  }

  const cicloEstado = (etapa: Etapa) => {
    const next: Etapa["estado"] =
      etapa.estado === "pendiente"
        ? "en_curso"
        : etapa.estado === "en_curso"
          ? "completada"
          : "pendiente"
    const updated = etapasLocal.map((e) => (e.id === etapa.id ? { ...e, estado: next } : e))
    setEtapasLocal(updated)
    void persistirEtapas(updated.filter((e) => e.id === etapa.id))
  }

  const onDropEtapa = (dropIdx: number) => {
    const from = dragIdx.current
    dragIdx.current = null
    if (from === null || from === dropIdx) return
    const arr = [...etapasLocal]
    const [moved] = arr.splice(from, 1)
    arr.splice(dropIdx, 0, moved)
    const reordered = arr.map((e, i) => ({ ...e, orden: i }))
    setEtapasLocal(reordered)
    void persistirEtapas(reordered)
  }

  const diasDesdeInicio = proyecto.fecha_inicio
    ? Math.floor(
        (Date.now() - new Date(proyecto.fecha_inicio).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0

  const handleGuardarObs = () => {
    if (!obsNumero.trim() || !obsTexto.trim()) return
    onAddObservacion(obsNumero.trim(), obsTexto.trim())
    setObsDialogOpen(false)
    setObsNumero("")
    setObsTexto("")
  }

  const handleGuardarCom = () => {
    if (!comAsunto.trim()) return
    onAddComunicacion(comTipo, comAsunto.trim(), comDesc.trim())
    setComDialogOpen(false)
    setComAsunto("")
    setComDesc("")
  }

  const proximosPasos = ddResult?.proximosPasos ?? []
  const vigencias = ddResult?.vigencias ?? []

  return (
    <div className="space-y-6">
      {/* ── Cómo continuar — decisor determinista de vía (instantáneo, citado)
          seguido del asesor de vía (IA, profundiza con los ajustes) ── */}
      <ViaDecision proyectoId={proyecto.id} destinoSii={proyecto.destino_sii} />
      <AsesorVia proyectoId={proyecto.id} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ── Columna izquierda: Etapas + Plan de acción ── */}
      <div className="space-y-6">
        {/* Etapas */}
        <Card>
          <CardHeader>
            <CardTitle>Etapas</CardTitle>
            <p className="text-xs text-muted-foreground">
              Arrastra para reordenar · clic en el círculo para cambiar el estado
            </p>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-0">
              {etapasLocal.map((etapa, idx) => {
                const isLast = idx === etapasLocal.length - 1
                const completed = etapa.estado === "completada"
                const current = etapa.estado === "en_curso"
                return (
                  <li
                    key={etapa.id}
                    draggable
                    onDragStart={() => {
                      dragIdx.current = idx
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropEtapa(idx)}
                    className="group/etapa flex gap-3 pb-6 last:pb-0"
                  >
                    <GripVertical className="mt-1 size-4 shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover/etapa:opacity-100" />
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={() => cicloEstado(etapa)}
                        title="Cambiar estado"
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors hover:opacity-80",
                          completed && "border-primary bg-primary text-white",
                          current && "border-primary bg-white text-primary",
                          !completed &&
                            !current &&
                            "border-border bg-white text-muted-foreground",
                        )}
                      >
                        {completed ? (
                          <Check className="size-4" />
                        ) : current ? (
                          <Clock className="size-4" />
                        ) : (
                          <span className="text-xs font-medium">{idx + 1}</span>
                        )}
                      </button>
                      {!isLast && (
                        <span
                          className={cn(
                            "mt-1 w-0.5 flex-1",
                            completed ? "bg-primary" : "bg-border",
                          )}
                        />
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          current
                            ? "text-primary"
                            : completed
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      >
                        {etapa.nombre}
                      </p>
                      {(etapa.fecha_fin || etapa.fecha_inicio) && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(etapa.fecha_fin ?? etapa.fecha_inicio)}
                        </p>
                      )}
                      {etapa.notas && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {etapa.notas}
                        </p>
                      )}
                      {completed && etapa.fecha_inicio && etapa.fecha_fin && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                          Duración:{" "}
                          {Math.floor(
                            (new Date(`${etapa.fecha_fin}T00:00:00`).getTime() -
                              new Date(
                                `${etapa.fecha_inicio}T00:00:00`,
                              ).getTime()) /
                              (1000 * 60 * 60 * 24),
                          )}{" "}
                          días
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>

        {/* Plan de acción */}
        <Card>
          <CardHeader>
            <CardTitle>Plan de acción</CardTitle>
          </CardHeader>
          <CardContent>
            {proximosPasos.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {ddResult
                  ? "El Due Diligence no arrojó pasos pendientes."
                  : "Genera el Due Diligence para obtener el plan de acción."}
              </p>
            ) : (
              <ol className="space-y-3">
                {proximosPasos.map((paso, idx) => (
                  <li
                    key={`${paso.titulo}-${idx}`}
                    className="flex gap-3"
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                        paso.critico
                          ? "bg-red-500 text-white"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          paso.critico ? "text-red-700" : "text-primary",
                        )}
                      >
                        {paso.titulo}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {paso.detalle}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Columna derecha: Observaciones + Plazo + Vigencias ── */}
      <div className="space-y-6">
        {/* Observaciones DOM */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Observaciones DOM</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={`/proyectos/${proyecto.id}/observaciones`} />}
              >
                <CheckCircle2 className="size-4" />
                Subsanar acta con IA
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setObsDialogOpen(true)}
              >
                <Plus className="size-4" />
                Nueva
              </Button>
              <Dialog open={obsDialogOpen} onOpenChange={setObsDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nueva observación DOM</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Número *
                      </p>
                      <Input
                        value={obsNumero}
                        onChange={(e) => setObsNumero(e.target.value)}
                        placeholder="OBS-001"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Texto de la observación *
                      </p>
                      <Textarea
                        value={obsTexto}
                        onChange={(e) => setObsTexto(e.target.value)}
                        placeholder="Se requiere memoria descriptiva actualizada..."
                        rows={4}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleGuardarObs}
                      disabled={!obsNumero.trim() || !obsTexto.trim()}
                    >
                      Guardar observación
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {observaciones.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin observaciones registradas.
              </p>
            ) : (
              observaciones.map((obs) => (
                <div
                  key={obs.id}
                  className={cn(
                    "pl-4 py-2 pr-2 group",
                    obs.estado === "pendiente"
                      ? "border-l-2 border-amber-400"
                      : "border-l-2 border-green-400",
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(obs.fecha)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {obs.numero}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        obs.estado === "pendiente"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700",
                      )}
                    >
                      {obs.estado === "pendiente" ? (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="size-3" />
                          Pendiente
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Respondida
                        </span>
                      )}
                    </span>
                    {obs.estado === "pendiente" && (
                      <button
                        onClick={() => onMarcarRespondida(obs.id)}
                        className="ml-auto text-xs text-primary/50 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      >
                        Marcar respondida
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{obs.texto}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Plazo Ley 21.718 */}
        {proyecto.fecha_inicio && (
          <PlazoLey21718Card
            fechaIngreso={proyecto.fecha_inicio}
            tieneRevisorIndependiente={false}
            proyecto={proyecto}
          />
        )}

        {/* Vigencias */}
        <Card>
          <CardHeader>
            <CardTitle>Vigencias</CardTitle>
          </CardHeader>
          <CardContent>
            {vigencias.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {ddResult
                  ? "Sin vigencias registradas en el Due Diligence."
                  : "Genera el Due Diligence para ver las vigencias."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {vigencias.map((vig, idx) => (
                  <li
                    key={`${vig.hito}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium text-primary">
                        {vig.hito}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {vig.fecha}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                        vig.nivel === "crit"
                          ? "border border-red-200 bg-red-50 text-red-700"
                          : vig.nivel === "warn"
                            ? "border border-amber-200 bg-amber-50 text-amber-700"
                            : "border border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {vig.estado}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Comunicaciones (ancho completo) ── */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Comunicaciones</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComDialogOpen(true)}
            >
              <Plus className="size-4" />
              Agregar
            </Button>
            <Dialog open={comDialogOpen} onOpenChange={setComDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Nueva comunicación</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Tipo</p>
                    <Select
                      value={comTipo}
                      onValueChange={(v) => setComTipo(v ?? "email")}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(COMUNICACION_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Asunto *
                    </p>
                    <Input
                      value={comAsunto}
                      onChange={(e) => setComAsunto(e.target.value)}
                      placeholder="Email DOM solicitando estado expediente"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Descripción (opcional)
                    </p>
                    <Textarea
                      value={comDesc}
                      onChange={(e) => setComDesc(e.target.value)}
                      placeholder="Detalles adicionales..."
                      rows={3}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleGuardarCom}
                    disabled={!comAsunto.trim()}
                  >
                    Guardar comunicación
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            {comunicaciones.map((c) => (
              <div
                key={c.id}
                className="border-l-2 border-border pl-4 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(c.fecha)}
                  </span>
                  <Badge variant="muted">{COMUNICACION_LABELS[c.tipo]}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-primary">{c.asunto}</p>
                {c.descripcion && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {c.descripcion}
                  </p>
                )}
              </div>
            ))}
            {diasDesdeInicio > 15 &&
              !["aprobado", "rechazado"].includes(proyecto.estado) && (
                <button
                  onClick={onEmailSeguimiento}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Mail className="size-4" />
                  Generar email de seguimiento a DOM
                </button>
              )}
          </CardContent>
        </Card>
      </div>

      {/* ── Cuadro de cálculo normativo (ancho completo) ── */}
      <CuadroCalculo proyectoId={proyecto.id} />
      </div>
    </div>
  )
}

const PLAZO_ESTADO_CONFIG = {
  EN_PLAZO: {
    badge: "bg-green-100 text-green-700",
    bar: "bg-green-600",
    label: "En plazo",
  },
  PROXIMO_VENCER: {
    badge: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
    label: "Próximo a vencer",
  },
  VENCIDO: {
    badge: "bg-red-100 text-red-700",
    bar: "bg-red-600",
    label: "Vencido",
  },
} as const

function PlazoLey21718Card({
  fechaIngreso,
  tieneRevisorIndependiente,
  proyecto,
}: {
  fechaIngreso: string
  tieneRevisorIndependiente: boolean
  proyecto: Proyecto
}) {
  const estado = getEstadoPlazoLey21718(
    new Date(`${fechaIngreso}T00:00:00`),
    tieneRevisorIndependiente,
  )
  const cfg = PLAZO_ESTADO_CONFIG[estado.estado]

  const [generando, setGenerando] = useState(false)
  const [carta, setCarta] = useState<string | null>(null)
  const [cartaOpen, setCartaOpen] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const necesitaCarta =
    estado.estado === "VENCIDO" || estado.estado === "PROXIMO_VENCER"

  async function handleGenerarCarta() {
    setGenerando(true)
    try {
      const res = await fetch("/api/ai/generate-communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo:
            estado.estado === "VENCIDO"
              ? "reclamo_ley21718"
              : "seguimiento_dom",
          proyectoNombre: proyecto.nombre,
          municipio: proyecto.municipio,
          numeroExpediente: proyecto.numero_expediente,
          fechaIngreso: proyecto.fecha_inicio,
          diasHabiles: estado.diasHabilesDesdeIngreso,
          direccion: proyecto.direccion,
        }),
      })
      const data = (await res.json()) as { ok: boolean; texto?: string }
      if (data.ok && data.texto) {
        setCarta(data.texto)
        setCartaOpen(true)
      }
    } finally {
      setGenerando(false)
    }
  }

  function handleCopiar() {
    if (!carta) return
    void navigator.clipboard.writeText(carta).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Plazo Ley 21.718</CardTitle>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              cfg.badge,
            )}
          >
            {estado.estado === "VENCIDO" && <AlertTriangle className="size-3" />}
            {cfg.label}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", cfg.bar)}
              style={{ width: `${estado.porcentajeUsado}%` }}
            />
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium text-primary">
              {estado.estado === "VENCIDO"
                ? `Plazo vencido (${estado.diasHabilesDesdeIngreso} días hábiles transcurridos)`
                : `${estado.diasHabilesRestantes} días hábiles restantes de ${estado.plazoTotal}`}
            </p>
            <p className="text-muted-foreground">
              Vence el {formatFecha(estado.fechaVencimiento)}
            </p>
            <p className="text-xs text-muted-foreground">
              {estado.tieneRevisorIndependiente
                ? "Plazo de 15 días hábiles (con revisor independiente)"
                : "Plazo de 30 días hábiles (sin revisor independiente)"}
            </p>
          </div>

          <p className={cn("rounded-lg px-3 py-2 text-xs font-medium", cfg.badge)}>
            {estado.labelEstado}
          </p>

          {necesitaCarta && (
            <button
              onClick={() => void handleGenerarCarta()}
              disabled={generando}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                estado.estado === "VENCIDO"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border border-amber-600 text-amber-700 hover:bg-amber-50",
              )}
            >
              {generando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              {generando
                ? "Generando..."
                : estado.estado === "VENCIDO"
                  ? "Generar reclamo Ley 21.718 (IA)"
                  : "Generar aviso preventivo a DOM"}
            </button>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={cartaOpen}
        onOpenChange={(v) => {
          if (!v) setCartaOpen(false)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">
              {estado.estado === "VENCIDO"
                ? "Reclamo Ley 21.718"
                : "Aviso preventivo a DOM"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              readOnly
              value={carta ?? ""}
              rows={14}
              className="w-full resize-none rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-gray-700 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCartaOpen(false)}>
                Cerrar
              </Button>
              <Button
                onClick={handleCopiar}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiado ? "Copiado" : "Copiar carta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
