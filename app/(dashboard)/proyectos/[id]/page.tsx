"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react"

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
  MOCK_COMUNICACIONES,
  MOCK_DOCUMENTOS,
  MOCK_ETAPAS,
  MOCK_PROYECTOS,
} from "@/lib/mock-data"
import { ESTADO_CONFIG, TIPO_PERMISO_LABELS, type Proyecto, type Etapa, type Comunicacion, type Documento } from "@/types"
import { getEstadoPlazoLey21718, formatFecha } from "@/lib/dias-habiles"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/dashboard/page-header"
import { DocumentUpload } from "@/components/dashboard/document-upload"
import { WhatsAppDialog } from "@/components/dashboard/whatsapp-dialog"
import { ExpedienteScore } from "@/components/proyecto/expediente-score"
import { setCommandContext, clearCommandContext } from "@/hooks/use-command-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Observacion {
  id: string
  fecha: string
  numero: string
  texto: string
  estado: "pendiente" | "respondida"
}

const MOCK_OBSERVACIONES: Observacion[] = [
  {
    id: "1",
    fecha: "2024-03-15",
    numero: "OBS-001",
    texto: "Se requiere memoria descriptiva actualizada con superficies desagregadas por uso.",
    estado: "pendiente",
  },
  {
    id: "2",
    fecha: "2024-02-28",
    numero: "OBS-002",
    texto: "Plano de emplazamiento debe indicar rasantes y distanciamientos según Art. 2.6.3 OGUC.",
    estado: "respondida",
  },
]

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

const COMUNICACION_LABELS: Record<string, string> = {
  email: "Email",
  llamada: "Llamada",
  visita: "Visita",
  notificacion: "Notificación",
  otro: "Otro",
}

function docIcon(tipo: string) {
  if (tipo.toLowerCase().includes("especificaciones"))
    return <FileSpreadsheet className="size-5 text-primary" />
  return <FileText className="size-5 text-primary" />
}

interface ProyectoDetalleData {
  proyecto: Proyecto
  etapas: Etapa[]
  comunicaciones: Comunicacion[]
  documentos: Documento[]
  source: string
}

export default function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const initialProyecto = MOCK_PROYECTOS.find((p) => p.id === id) ?? MOCK_PROYECTOS[0]
  const [proyecto, setProyecto] = useState<Proyecto>(initialProyecto)
  const [etapas, setEtapas] = useState<Etapa[]>(
    MOCK_ETAPAS.filter((e) => e.proyecto_id === id),
  )
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>(
    MOCK_COMUNICACIONES.filter((c) => c.proyecto_id === id),
  )
  const [documentos, setDocumentos] = useState<Documento[]>(
    MOCK_DOCUMENTOS.filter((d) => d.proyecto_id === id),
  )
  const [observaciones, setObservaciones] = useState<Observacion[]>(MOCK_OBSERVACIONES.filter(() => false))

  useEffect(() => {
    fetch(`/api/proyectos/${id}`)
      .then((r) => r.json())
      .then((data: ProyectoDetalleData) => {
        if (data.source === 'db' && data.proyecto) {
          setProyecto(data.proyecto)
          setEtapas(data.etapas ?? [])
          setComunicaciones(data.comunicaciones ?? [])
          setDocumentos(data.documentos ?? [])
        }
      })
      .catch(() => undefined)

    // Load observaciones from dedicated endpoint
    fetch(`/api/proyectos/${id}/observaciones`)
      .then((r) => r.json())
      .then((data: { observaciones?: Observacion[] }) => {
        if (data.observaciones && data.observaciones.length > 0) {
          setObservaciones(data.observaciones)
        } else {
          // Show mock data in dev so the section is visible
          setObservaciones(MOCK_OBSERVACIONES)
        }
      })
      .catch(() => setObservaciones(MOCK_OBSERVACIONES))
  }, [id])

  const estadoCfg = ESTADO_CONFIG[proyecto.estado]

  // Calculate days since inicio
  const diasDesdeInicio = Math.floor(
    (new Date().getTime() - new Date(proyecto.fecha_inicio).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  const plazoLegalExcedido =
    diasDesdeInicio > 30 &&
    !["aprobado", "rechazado", "borrador"].includes(proyecto.estado)

  useEffect(() => {
    setCommandContext({
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      municipio: proyecto.municipio ?? '',
    })
    return () => clearCommandContext()
  }, [proyecto.id, proyecto.nombre, proyecto.municipio])

  const [compartirLoading, setCompartirLoading] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)

  const handleCompartir = async () => {
    setCompartirLoading(true)
    try {
      const res = await fetch('/api/portal/generate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId: proyecto.id }),
      })
      const data = await res.json() as { ok: boolean; url?: string }
      if (data.ok && data.url) {
        setPortalUrl(data.url)
        await navigator.clipboard.writeText(data.url)
      }
    } finally {
      setCompartirLoading(false)
    }
  }

  const [verificando, setVerificando] = useState(false)
  const [ultimaVerificacion, setUltimaVerificacion] = useState<{
    changed: boolean
    estadoAnterior?: string
    estadoNuevo?: string
    simulated?: boolean
    fetchedAt: string
    observaciones?: string | null
    expedienteNumero?: string
  } | null>(null)
  const [waDialogOpen, setWaDialogOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [notas, setNotas] = useState(proyecto.notas ?? "")
  const [notasSaving, setNotasSaving] = useState(false)

  const saveNotas = async () => {
    setNotasSaving(true)
    try {
      await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas }),
      })
    } finally {
      setNotasSaving(false)
    }
  }

  // Nueva comunicación
  const [comDialogOpen, setComDialogOpen] = useState(false)
  const [comTipo, setComTipo] = useState("email")
  const [comAsunto, setComAsunto] = useState("")
  const [comDesc, setComDesc] = useState("")

  const addComunicacion = async () => {
    if (!comAsunto.trim()) return
    const now = new Date().toISOString()
    const nueva: Comunicacion = {
      id: `com-${Date.now()}`,
      proyecto_id: proyecto.id,
      tipo: comTipo as Comunicacion["tipo"],
      asunto: comAsunto.trim(),
      descripcion: comDesc.trim() || undefined,
      fecha: now.slice(0, 10),
      created_at: now,
    }
    setComunicaciones((prev) => [nueva, ...prev])
    setComDialogOpen(false)
    setComAsunto("")
    setComDesc("")
    // Persist to Supabase (best-effort)
    fetch(`/api/proyectos/${proyecto.id}/comunicaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva),
    }).catch(() => undefined)
  }

  // Observaciones DOM
  const [obsDialogOpen, setObsDialogOpen] = useState(false)
  const [obsNumero, setObsNumero] = useState("")
  const [obsTexto, setObsTexto] = useState("")

  const addObservacion = async () => {
    if (!obsNumero.trim() || !obsTexto.trim()) return
    const fecha = new Date().toISOString().slice(0, 10)
    const nueva: Observacion = {
      id: `obs-${Date.now()}`,
      fecha,
      numero: obsNumero.trim(),
      texto: obsTexto.trim(),
      estado: "pendiente",
    }
    setObservaciones((prev) => [nueva, ...prev])
    setObsDialogOpen(false)
    setObsNumero("")
    setObsTexto("")
    fetch(`/api/proyectos/${proyecto.id}/observaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva),
    }).catch(() => undefined)
  }

  const marcarRespondida = (obsId: string) => {
    setObservaciones((prev) =>
      prev.map((o) => o.id === obsId ? { ...o, estado: "respondida" } : o)
    )
    fetch(`/api/proyectos/${proyecto.id}/observaciones?obsId=${obsId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "respondida" }),
    }).catch(() => undefined)
  }

  // Inline info edit state
  const [editMode, setEditMode] = useState(false)
  const [editEstado, setEditEstado] = useState(proyecto.estado)
  const [editNumExp, setEditNumExp] = useState(proyecto.numero_expediente ?? "")
  const [editFechaEst, setEditFechaEst] = useState(proyecto.fecha_estimada ?? "")
  const [editSaving, setEditSaving] = useState(false)

  const saveInfoEdit = async () => {
    setEditSaving(true)
    try {
      await fetch(`/api/proyectos/${proyecto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: editEstado,
          numero_expediente: editNumExp || null,
          fecha_estimada: editFechaEst || null,
        }),
      })
      setProyecto((prev) => ({
        ...prev,
        estado: editEstado,
        numero_expediente: editNumExp || undefined,
        fecha_estimada: editFechaEst || undefined,
      }))
      setEditMode(false)
    } finally {
      setEditSaving(false)
    }
  }

  const handleVerificarEstado = async () => {
    setVerificando(true)
    try {
      const res = await fetch(`/api/check-status/${proyecto.id}`)
      const data = await res.json()
      setUltimaVerificacion(data)
      if (data.changed) {
        // Show success - estado changed
      }
    } catch (e) {
      console.error("Error verificando estado:", e)
    } finally {
      setVerificando(false)
    }
  }

  const handleGenerarEmailSeguimiento = () => {
    const domEmail = "dom@municipio.cl" // would come from municipios KB in real version
    const subject = encodeURIComponent(
      `Seguimiento Expediente N° ${proyecto.numero_expediente ?? "[número]"} — ${proyecto.nombre}`
    )
    const body = encodeURIComponent(
      `Estimado/a equipo DOM ${proyecto.municipio},\n\nMe dirijo a ustedes para solicitar información sobre el estado del expediente:\n\nN° Expediente: ${proyecto.numero_expediente ?? "[número]"}\nProyecto: ${proyecto.nombre}\nDirección: ${proyecto.direccion}\n\nFecha de ingreso: ${proyecto.fecha_inicio}\nDías en tramitación: ${diasDesdeInicio}\n\nAgradecería información sobre el estado actual y los próximos pasos.\n\nSaludos cordiales,\nEstefanía Parada\nArquitecta — EP Gestión Arquitectónica\nestefania@epgestion.cl`
    )
    window.open(`mailto:${domEmail}?subject=${subject}&body=${body}`)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📄"
        title={proyecto.nombre}
        breadcrumbs={[
          { label: "Proyectos", href: "/proyectos" },
          { label: proyecto.nombre },
        ]}
        action={
          <div className="flex items-center gap-2">
            {!["aprobado", "rechazado"].includes(proyecto.estado) && (
              <Button
                nativeButton={false}
                render={<Link href={`/proyectos/${proyecto.id}/ingreso`} />}
                variant="outline"
                size="sm"
              >
                <Upload className="size-4" />
                Preparar ingreso DOM
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={compartirLoading}
              onClick={() => void handleCompartir()}
              title={portalUrl ? `Link copiado: ${portalUrl}` : 'Generar link para cliente'}
            >
              {portalUrl ? (
                <><Check className="size-4 text-green-600" /> Link copiado</>
              ) : (
                <><Link2 className="size-4" /> Compartir</>
              )}
            </Button>
            <Button
              nativeButton={false}
              render={
                <a
                  href={`/api/export/proyecto/${proyecto.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              variant="outline"
              size="sm"
            >
              <Download className="size-4" />
              Exportar PDF
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-8">
        {/* Barra de estadísticas rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Días en tramitación
            </p>
            <p className="text-xl font-semibold text-primary font-display mt-1">
              {diasDesdeInicio}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Estado actual
            </p>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${estadoCfg.color}`}
            >
              {estadoCfg.label}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Documentos
            </p>
            <p className="text-xl font-semibold text-primary font-display mt-1">
              {documentos.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              N° Expediente
            </p>
            <p className="text-xl font-semibold text-primary font-display mt-1">
              {proyecto.numero_expediente ?? "Sin asignar"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoCfg.color}`}
              >
                {estadoCfg.label}
              </span>
              <Badge variant="outline">{TIPO_PERMISO_LABELS[proyecto.tipo]}</Badge>
              {plazoLegalExcedido && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                  <AlertTriangle className="size-3" />
                  Plazo legal excedido ({diasDesdeInicio} días)
                </span>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" />
              {proyecto.direccion}, {proyecto.municipio}
            </p>
          </div>

          {/* Etapas */}
          <Card>
            <CardHeader>
              <CardTitle>Etapas</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-0">
                {etapas.map((etapa, idx) => {
                  const isLast = idx === etapas.length - 1
                  const completed = etapa.estado === "completada"
                  const current = etapa.estado === "en_curso"
                  return (
                    <li key={etapa.id} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                            completed &&
                              "border-primary bg-primary text-white",
                            current &&
                              "border-primary bg-white text-primary",
                            !completed &&
                              !current &&
                              "border-border bg-white text-muted-foreground"
                          )}
                        >
                          {completed ? (
                            <Check className="size-4" />
                          ) : current ? (
                            <Clock className="size-4" />
                          ) : (
                            <span className="text-xs font-medium">
                              {etapa.orden}
                            </span>
                          )}
                        </span>
                        {!isLast && (
                          <span
                            className={cn(
                              "mt-1 w-0.5 flex-1",
                              completed ? "bg-primary" : "bg-border"
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
                                : "text-muted-foreground"
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
                                new Date(`${etapa.fecha_inicio}T00:00:00`).getTime()) /
                                (1000 * 60 * 60 * 24)
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

          {/* Observaciones DOM */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Observaciones DOM</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`/herramientas/auditor?proyectoId=${proyecto.id}`} />}
                >
                  <CheckCircle2 className="size-4" />
                  Responder con IA
                </Button>
                <Dialog open={obsDialogOpen} onOpenChange={setObsDialogOpen}>
                  <DialogTrigger>
                    <Button variant="outline" size="sm">
                      <Plus className="size-4" />
                      Nueva
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Nueva observación DOM</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Número *</p>
                        <Input
                          value={obsNumero}
                          onChange={(e) => setObsNumero(e.target.value)}
                          placeholder="OBS-001"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Texto de la observación *</p>
                        <Textarea
                          value={obsTexto}
                          onChange={(e) => setObsTexto(e.target.value)}
                          placeholder="Se requiere memoria descriptiva actualizada..."
                          rows={4}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => void addObservacion()}
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
                <p className="text-sm text-muted-foreground py-4 text-center">Sin observaciones registradas.</p>
              ) : observaciones.map((obs) => (
                <div
                  key={obs.id}
                  className={cn(
                    "pl-4 py-2 pr-2 group",
                    obs.estado === "pendiente"
                      ? "border-l-2 border-amber-400"
                      : "border-l-2 border-green-400"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(obs.fecha)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {obs.numero}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        obs.estado === "pendiente"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
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
                        onClick={() => marcarRespondida(obs.id)}
                        className="ml-auto text-xs text-primary/50 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Marcar respondida
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground">{obs.texto}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Comunicaciones */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Comunicaciones</CardTitle>
              <Dialog open={comDialogOpen} onOpenChange={setComDialogOpen}>
                <DialogTrigger>
                  <Button variant="outline" size="sm">
                    <Plus className="size-4" />
                    Agregar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Nueva comunicación</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Tipo</p>
                      <Select value={comTipo} onValueChange={(v) => setComTipo(v ?? "email")}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COMUNICACION_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Asunto *</p>
                      <Input
                        value={comAsunto}
                        onChange={(e) => setComAsunto(e.target.value)}
                        placeholder="Email DOM solicitando estado expediente"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Descripción (opcional)</p>
                      <Textarea
                        value={comDesc}
                        onChange={(e) => setComDesc(e.target.value)}
                        placeholder="Detalles adicionales..."
                        rows={3}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => void addComunicacion()}
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
                  <p className="mt-1 text-sm font-medium text-primary">
                    {c.asunto}
                  </p>
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
                    onClick={handleGenerarEmailSeguimiento}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Mail className="size-4" />
                    Generar email de seguimiento a DOM
                  </button>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Info card */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Información</CardTitle>
              {editMode ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(false)}
                    disabled={editSaving}
                    className="text-muted-foreground text-xs"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void saveInfoEdit()}
                    disabled={editSaving}
                    className="text-xs"
                  >
                    {editSaving ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Editar"
                  onClick={() => {
                    setEditEstado(proyecto.estado)
                    setEditNumExp(proyecto.numero_expediente ?? "")
                    setEditFechaEst(proyecto.fecha_estimada ?? "")
                    setEditMode(true)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={<Users className="size-4" />} label="Cliente">
                {proyecto.cliente?.nombre ?? "—"}
              </InfoRow>
              <InfoRow icon={<MapPin className="size-4" />} label="Municipio">
                {proyecto.municipio}
              </InfoRow>
              {editMode ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <Select value={editEstado} onValueChange={(v) => setEditEstado(v as typeof editEstado)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["borrador", "ingresado", "en_revision", "con_observaciones", "aprobado", "rechazado"] as const).map((e) => (
                          <SelectItem key={e} value={e} className="text-xs">
                            {ESTADO_CONFIG[e]?.label ?? e}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">N° Expediente</p>
                    <Input
                      className="h-8 text-xs"
                      value={editNumExp}
                      onChange={(e) => setEditNumExp(e.target.value)}
                      placeholder="EXP-2026-0001"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Fecha estimada resolución</p>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={editFechaEst}
                      onChange={(e) => setEditFechaEst(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="N° Expediente">
                    {proyecto.numero_expediente ?? "—"}
                  </InfoRow>
                  <InfoRow label="Fecha inicio">
                    {formatDate(proyecto.fecha_inicio)}
                  </InfoRow>
                  <InfoRow label="Fecha estimada">
                    {formatDate(proyecto.fecha_estimada)}
                  </InfoRow>
                </>
              )}

              <div className="pt-2">
                <button
                  onClick={handleVerificarEstado}
                  disabled={verificando}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  {verificando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-4" /> Verificar estado en portal
                    </>
                  )}
                </button>
                {ultimaVerificacion && (
                  <div className={`mt-2 rounded-lg border p-3 text-xs ${
                    ultimaVerificacion.changed
                      ? 'border-green-200 bg-green-50'
                      : 'border-border bg-muted/40'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-primary">
                        {ultimaVerificacion.changed
                          ? `Estado actualizado: ${ultimaVerificacion.estadoNuevo}`
                          : 'Sin cambios en el portal'}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(ultimaVerificacion.fetchedAt).toLocaleTimeString('es-CL')}
                      </span>
                    </div>
                    {ultimaVerificacion.expedienteNumero && (
                      <p className="text-muted-foreground">
                        Expediente: <span className="font-medium text-primary">{ultimaVerificacion.expedienteNumero}</span>
                      </p>
                    )}
                    {ultimaVerificacion.observaciones && (
                      <div className="mt-1.5 rounded border border-amber-200 bg-amber-50 p-2">
                        <p className="font-medium text-amber-800">Observaciones:</p>
                        <p className="mt-0.5 text-amber-700">{ultimaVerificacion.observaciones}</p>
                      </div>
                    )}
                    {ultimaVerificacion.simulated && (
                      <p className="mt-1 italic text-muted-foreground">(simulado en desarrollo)</p>
                    )}
                  </div>
                )}
              </div>
              {proyecto.cliente?.telefono && (
                <button
                  onClick={() => setWaDialogOpen(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-green-700 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  Notificar cliente por WhatsApp
                </button>
              )}
            </CardContent>
          </Card>

          {/* Expediente Score */}
          <ExpedienteScore
            tipo={proyecto.tipo}
            municipio={proyecto.municipio}
            documentos={documentos}
            proyectoId={proyecto.id}
          />

          {/* Herramientas IA del proyecto */}
          <div className="rounded-xl border border-border bg-white p-4 space-y-2">
            <p className="text-xs font-semibold text-primary/60 uppercase tracking-wider">Herramientas IA</p>
            {[
              {
                label: "Generar Memoria Descriptiva",
                href: `/herramientas/memoria?nombre=${encodeURIComponent(proyecto.nombre)}&municipio=${encodeURIComponent(proyecto.municipio)}&direccion=${encodeURIComponent(proyecto.direccion ?? "")}&tipo=${encodeURIComponent(proyecto.tipo)}`,
                icon: "📄",
              },
              {
                label: "Predecir observaciones DOM",
                href: `/herramientas/predictor?municipio=${encodeURIComponent(proyecto.municipio)}&tipo=${encodeURIComponent(proyecto.tipo)}`,
                icon: "🔮",
              },
              {
                label: "Consultar OGUC",
                href: `/herramientas/oguc-chat?municipio=${encodeURIComponent(proyecto.municipio)}`,
                icon: "💬",
              },
              {
                label: "Ver ficha DOM",
                href: `/municipios/${encodeURIComponent(proyecto.municipio.toLowerCase().replace(/\s+/g, "-"))}`,
                icon: "🏛️",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[11.5px] font-medium text-primary/70 hover:bg-[#F9F7F3] hover:text-primary transition-colors"
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>

          {/* Plazo Ley 21.718 */}
          {proyecto.fecha_inicio && (
            <PlazoLey21718Card
              fechaIngreso={proyecto.fecha_inicio}
              tieneRevisorIndependiente={false}
              proyecto={proyecto}
            />
          )}

          {/* Documentos */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Documentos</CardTitle>
              <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogTrigger>
                  <Button variant="outline" size="sm">
                    <Upload className="size-4" />
                    Subir
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Subir documentos</DialogTitle>
                  </DialogHeader>
                  <DocumentUpload
                    proyectoId={proyecto.id}
                    onUploadComplete={(doc) => {
                      setDocumentos((prev) => [
                        ...prev,
                        {
                          id: `new-${Date.now()}`,
                          proyecto_id: proyecto.id,
                          nombre: doc.nombre,
                          tipo: doc.tipo,
                          url: doc.url,
                          tamano: doc.tamano,
                          created_at: new Date().toISOString(),
                        },
                      ])
                    }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-2">
              {documentos.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  {docIcon(d.tipo)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">
                      {d.nombre}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.tipo} · {formatDate(d.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Descargar"
                    className="text-muted-foreground"
                  >
                    <Download className="size-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Notas */}
          <Card>
            <CardHeader>
              <CardTitle>Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas internas del proyecto..."
                rows={5}
              />
              <Button
                className="bg-primary text-white hover:bg-primary/90"
                onClick={() => void saveNotas()}
                disabled={notasSaving}
              >
                {notasSaving ? "Guardando…" : "Guardar notas"}
              </Button>
            </CardContent>
          </Card>
        </div>
        </div>

        {proyecto.cliente?.telefono && (
          <WhatsAppDialog
            open={waDialogOpen}
            onClose={() => setWaDialogOpen(false)}
            telefono={proyecto.cliente.telefono}
            proyectoNombre={proyecto.nombre}
            municipio={proyecto.municipio}
            clienteNombre={proyecto.cliente?.nombre ?? 'Cliente'}
          />
        )}
      </div>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium text-primary">{children}</span>
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
    tieneRevisorIndependiente
  )
  const cfg = PLAZO_ESTADO_CONFIG[estado.estado]

  const [generando, setGenerando] = useState(false)
  const [carta, setCarta] = useState<string | null>(null)
  const [cartaOpen, setCartaOpen] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const necesitaCarta = estado.estado === 'VENCIDO' || estado.estado === 'PROXIMO_VENCER'

  async function handleGenerarCarta() {
    setGenerando(true)
    try {
      const res = await fetch('/api/ai/generate-communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: estado.estado === 'VENCIDO' ? 'reclamo_ley21718' : 'seguimiento_dom',
          proyectoNombre: proyecto.nombre,
          municipio: proyecto.municipio,
          numeroExpediente: proyecto.numero_expediente,
          fechaIngreso: proyecto.fecha_inicio,
          diasHabiles: estado.diasHabilesDesdeIngreso,
          direccion: proyecto.direccion,
        }),
      })
      const data = await res.json() as { ok: boolean; texto?: string }
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
              cfg.badge
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

          <p
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              cfg.badge
            )}
          >
            {estado.labelEstado}
          </p>

          {necesitaCarta && (
            <button
              onClick={() => void handleGenerarCarta()}
              disabled={generando}
              className={cn(
                "w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
                estado.estado === 'VENCIDO'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'border border-amber-600 text-amber-700 hover:bg-amber-50'
              )}
            >
              {generando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              {generando
                ? 'Generando...'
                : estado.estado === 'VENCIDO'
                  ? 'Generar reclamo Ley 21.718 (IA)'
                  : 'Generar aviso preventivo a DOM'}
            </button>
          )}
        </CardContent>
      </Card>

      <Dialog open={cartaOpen} onOpenChange={v => { if (!v) setCartaOpen(false) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">
              {estado.estado === 'VENCIDO' ? 'Reclamo Ley 21.718' : 'Aviso preventivo a DOM'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              readOnly
              value={carta ?? ''}
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
                {copiado ? 'Copiado' : 'Copiar carta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
