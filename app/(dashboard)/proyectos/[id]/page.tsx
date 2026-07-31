"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Link2,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  RefreshCw,
  Sparkles,
  Upload,
  Users,
} from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { ESTADO_CONFIG, TIPO_PERMISO_LABELS, type Proyecto, type Etapa, type Comunicacion, type Documento } from "@/types"
import { cn } from "@/lib/utils"
import { Rotulo } from "@/components/arch/rotulo"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { Dato } from "@/components/arch/dato"
import { esPlano } from "@/lib/planos"
import { CopilotoTrigger } from "@/components/copiloto/copiloto-trigger"
import { DocumentUpload } from "@/components/dashboard/document-upload"
import { WhatsAppDialog } from "@/components/dashboard/whatsapp-dialog"
import { ChecklistCompletitud } from "@/components/proyecto/checklist-completitud"
import { DesarchivoPanel } from "@/components/proyecto/desarchivo-panel"
import { PredioMap } from "@/components/proyecto/predio-map"
import { ZonificacionCard } from "@/components/proyecto/zonificacion-card"
import DueDiligenceReport from "@/components/proyecto/due-diligence-report"
import { ExpedienteWizard } from "@/components/proyecto/expediente-wizard"
import { PmoPanel } from "@/components/proyecto/pmo-panel"
import { generarInformePDF } from "@/lib/informe-pdf"
import type { DueDiligenceResult, DueDiligenceReportRow } from "@/lib/due-diligence"
import { setCommandContext, clearCommandContext } from "@/hooks/use-command-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Observacion {
  id: string
  fecha: string
  numero: string
  texto: string
  estado: "pendiente" | "respondida"
}

// Acciones externas/retail (portal cliente, verificar estado scraper, WhatsApp)
// ocultas para enfocar la ficha en el flujo del expediente. Poner en true para
// volver a mostrarlas.
const MOSTRAR_ACCIONES_EXTERNAS = false

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

/** Rótulo de zona de la lámina: esquina de escuadra + etiqueta. */
function SeccionLamina({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      <span
        className="inline-block h-2 w-2 border border-[var(--blueprint)]"
        style={{ borderRightWidth: 0, borderBottomWidth: 0 }}
      />
      {children}
    </p>
  )
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

  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [loading, setLoading] = useState(true)
  const [etapas, setEtapas] = useState<Etapa[]>([])
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [observaciones, setObservaciones] = useState<Observacion[]>([])

  const [ddResult, setDdResult] = useState<DueDiligenceResult | null>(null)
  const [ddLoading, setDdLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  // Pestaña activa (controlada): al verificar el DD se aterriza en el PMO.
  const [activeTab, setActiveTab] = useState("resumen")

  // Re-carga los datos de la PMO (proyecto/etapas/observaciones/comunicaciones/documentos).
  const refetchPmo = useCallback(() => {
    fetch(`/api/proyectos/${id}`)
      .then((r) => r.json())
      .then((data: ProyectoDetalleData) => {
        if (!data.proyecto) return
        setProyecto(data.proyecto)
        setEtapas(data.etapas ?? [])
        setComunicaciones(data.comunicaciones ?? [])
        setDocumentos(data.documentos ?? [])
      })
      .catch(() => undefined)

    fetch(`/api/proyectos/${id}/observaciones`)
      .then((r) => r.json())
      .then((data: { observaciones?: Observacion[] }) => {
        setObservaciones(data.observaciones ?? [])
      })
      .catch(() => undefined)
  }, [id])

  // Re-carga el último due diligence del proyecto.
  const refetchDD = useCallback(() => {
    fetch(`/api/proyectos/${id}/due-diligence`)
      .then((r) => r.json())
      .then((data: { report: DueDiligenceReportRow | null }) => {
        const report = data.report
        if (report?.status === "done" && report.result) setDdResult(report.result)
      })
      .catch(() => undefined)
  }, [id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/proyectos/${id}`)
      .then((r) => r.json())
      .then((data: ProyectoDetalleData) => {
        if (cancelled || !data.proyecto) return
        setProyecto(data.proyecto)
        setEtapas(data.etapas ?? [])
        setComunicaciones(data.comunicaciones ?? [])
        setDocumentos(data.documentos ?? [])
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    fetch(`/api/proyectos/${id}/observaciones`)
      .then((r) => r.json())
      .then((data: { observaciones?: Observacion[] }) => {
        if (!cancelled) setObservaciones(data.observaciones ?? [])
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    let cancelled = false
    setDdLoading(true)
    fetch(`/api/proyectos/${id}/due-diligence`)
      .then((r) => r.json())
      .then((data: { report: DueDiligenceReportRow | null }) => {
        if (cancelled) return
        const report = data.report
        if (report?.status === "done" && report.result) setDdResult(report.result)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setDdLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const estadoCfg = ESTADO_CONFIG[proyecto?.estado ?? "borrador"]

  const diasDesdeInicio = proyecto
    ? Math.floor((Date.now() - new Date(proyecto.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24))
    : 0
  const plazoLegalExcedido =
    !!proyecto &&
    diasDesdeInicio > 30 &&
    !["aprobado", "rechazado", "borrador"].includes(proyecto.estado)

  useEffect(() => {
    if (!proyecto) return
    setCommandContext({
      proyectoId: proyecto.id,
      proyectoNombre: proyecto.nombre,
      municipio: proyecto.municipio ?? '',
    })
    return () => clearCommandContext()
  }, [proyecto])

  const [compartirLoading, setCompartirLoading] = useState(false)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)

  const handleCompartir = async () => {
    if (!proyecto) return
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
  const [notas, setNotas] = useState(proyecto?.notas ?? "")
  const [notasSaving, setNotasSaving] = useState(false)

  const saveNotas = async () => {
    if (!proyecto) return
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

  const addComunicacion = (tipo: string, asunto: string, descripcion: string) => {
    if (!proyecto || !asunto.trim()) return
    const now = new Date().toISOString()
    const nueva: Comunicacion = {
      id: `com-${Date.now()}`,
      proyecto_id: proyecto.id,
      tipo: tipo as Comunicacion["tipo"],
      asunto: asunto.trim(),
      descripcion: descripcion.trim() || undefined,
      fecha: now.slice(0, 10),
      created_at: now,
    }
    setComunicaciones((prev) => [nueva, ...prev])
    // Persist to Supabase (best-effort)
    fetch(`/api/proyectos/${proyecto.id}/comunicaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva),
    }).catch(() => toast.error("No se pudo guardar la comunicación"))
  }

  const addObservacion = (numero: string, texto: string) => {
    if (!proyecto || !numero.trim() || !texto.trim()) return
    const fecha = new Date().toISOString().slice(0, 10)
    const nueva: Observacion = {
      id: `obs-${Date.now()}`,
      fecha,
      numero: numero.trim(),
      texto: texto.trim(),
      estado: "pendiente",
    }
    setObservaciones((prev) => [nueva, ...prev])
    fetch(`/api/proyectos/${proyecto.id}/observaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nueva),
    }).catch(() => toast.error("No se pudo guardar la observación"))
  }

  const marcarRespondida = (obsId: string) => {
    if (!proyecto) return
    setObservaciones((prev) =>
      prev.map((o) => o.id === obsId ? { ...o, estado: "respondida" } : o)
    )
    fetch(`/api/proyectos/${proyecto.id}/observaciones?obsId=${obsId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "respondida" }),
    }).catch(() => toast.error("No se pudo actualizar la observación"))
  }

  // Inline info edit state
  const [editMode, setEditMode] = useState(false)
  const [editEstado, setEditEstado] = useState<Proyecto["estado"]>(proyecto?.estado ?? "borrador")
  const [editNumExp, setEditNumExp] = useState(proyecto?.numero_expediente ?? "")
  const [editFechaEst, setEditFechaEst] = useState(proyecto?.fecha_estimada ?? "")
  const [editSaving, setEditSaving] = useState(false)

  // Sincroniza los campos editables cuando el proyecto real termina de cargar.
  useEffect(() => {
    if (!proyecto) return
    setNotas(proyecto.notas ?? "")
    setEditEstado(proyecto.estado)
    setEditNumExp(proyecto.numero_expediente ?? "")
    setEditFechaEst(proyecto.fecha_estimada ?? "")
  }, [proyecto])

  const saveInfoEdit = async () => {
    if (!proyecto) return
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
      setProyecto((prev) =>
        prev
          ? {
              ...prev,
              estado: editEstado,
              numero_expediente: editNumExp || undefined,
              fecha_estimada: editFechaEst || undefined,
            }
          : prev,
      )
      setEditMode(false)
    } finally {
      setEditSaving(false)
    }
  }

  const handleVerificarEstado = async () => {
    if (!proyecto) return
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
    if (!proyecto) return
    const subject = encodeURIComponent(
      `Seguimiento Expediente N° ${proyecto.numero_expediente ?? "[número]"} — ${proyecto.nombre}`
    )
    const body = encodeURIComponent(
      `Estimado/a equipo DOM ${proyecto.municipio ?? ""},\n\nMe dirijo a ustedes para solicitar información sobre el estado del expediente:\n\nN° Expediente: ${proyecto.numero_expediente ?? "[número]"}\nProyecto: ${proyecto.nombre}\nDirección: ${proyecto.direccion ?? ""}\n\nFecha de ingreso: ${proyecto.fecha_inicio}\nDías en tramitación: ${diasDesdeInicio}\n\nAgradecería información sobre el estado actual y los próximos pasos.\n\nSaludos cordiales,`
    )
    // Sin destinatario fijo: el usuario elige el correo de la DOM en su cliente de correo.
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  async function handleExportInforme() {
    if (!ddResult) return
    setExporting(true)
    try {
      await generarInformePDF(id, ddResult)
    } finally {
      setExporting(false)
    }
  }

  if (loading || ddLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Cargando proyecto…
      </div>
    )
  }
  if (!proyecto) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">No encontramos este proyecto.</p>
        <Button nativeButton={false} render={<Link href="/proyectos" />} variant="outline" size="sm">
          Volver a Proyectos
        </Button>
      </div>
    )
  }

  // Estado del expediente → veredicto normativo (color restringido).
  const veredicto: Veredicto =
    proyecto.estado === "aprobado"
      ? "cumple"
      : proyecto.estado === "rechazado"
        ? "rechaza"
        : proyecto.estado === "con_observaciones"
          ? "observa"
          : "neutro"

  const acciones = (
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
      {MOSTRAR_ACCIONES_EXTERNAS && (
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
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={!ddResult || exporting}
        onClick={() => void handleExportInforme()}
        title={ddResult ? "Exportar informe PDF" : "Genera el Due Diligence primero"}
      >
        {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Exportar PDF
      </Button>
      <CopilotoTrigger proyecto={proyecto} />
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra slim: breadcrumb + acciones. El título vive en el rótulo. */}
      <div className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-8 py-3">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <nav className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Link href="/proyectos" className="transition-colors hover:text-primary">Proyectos</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="truncate text-muted-foreground/60">{proyecto.nombre}</span>
        </nav>
        {acciones}
      </div>

      <div className="flex-1 overflow-auto bg-blueprint-grid p-6 md:p-8">
        {/* Rótulo del expediente — cabecera como cajetín técnico */}
        <Rotulo
          className="mb-6"
          clase="Expediente de edificación"
          titulo={proyecto.nombre}
          subtitulo={[proyecto.direccion, proyecto.municipio].filter(Boolean).join(" · ") || undefined}
          estado={{ veredicto, label: estadoCfg.label }}
          campos={[
            { label: "Expediente", valor: proyecto.numero_expediente || "—" },
            { label: "Comuna / DOM", valor: proyecto.municipio || "—", mono: false },
            { label: "Tipo de trámite", valor: TIPO_PERMISO_LABELS[proyecto.tipo] ?? proyecto.tipo ?? "—", mono: false },
            { label: "Ingreso", valor: formatDate(proyecto.fecha_inicio) },
            { label: "Días en trámite", valor: diasDesdeInicio },
          ]}
        />
        {/* El expediente muestra las pestañas SOLO cuando el DD está verificado
            por el humano; mientras tanto vive el wizard (subir + verificar). */}
        {!(ddResult && (ddResult.revisionEstado ?? "pendiente") === "verificado") ? (
          <ExpedienteWizard
            proyectoId={id}
            documentosIniciales={documentos.length}
            onComplete={() => {
              refetchDD()
              refetchPmo()
              setActiveTab("pmo") // al verificar, aterriza en el PMO ("cómo continuar")
            }}
          />
        ) : (
          <Tabs defaultValue="resumen" value={activeTab} onValueChange={setActiveTab}>
            {/* Índice de láminas: las pestañas como códigos de lámina de una
                carpeta técnica (A-01…A-04), no como tabs de app web. */}
            <TabsList className="mb-6 w-full justify-start gap-0 overflow-x-auto rounded-[3px] border-line-strong bg-card p-0">
              {(
                [
                  { value: "resumen", code: "A-01", label: "Resumen" },
                  { value: "documentos", code: "A-02", label: "Documentos" },
                  { value: "dd", code: "A-03", label: "Due Diligence" },
                  { value: "pmo", code: "A-04", label: "PMO" },
                ] as const
              ).map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "rounded-none border-r border-line-fine px-4 py-2.5 shadow-none last:border-r-0",
                    "data-[state=active]:bg-transparent data-[state=active]:shadow-[inset_0_-2px_0_var(--blueprint)]",
                  )}
                >
                  <span className="num mr-2 text-[10px] text-muted-foreground">{t.code}</span>
                  <span className="font-technical text-[13px]">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Resumen ── */}
            <TabsContent value="resumen">
              {/* Cuadro de control: una sola pieza con celdas divididas por
                  línea fina, como el cuadro de superficies de una lámina. */}
              <div className="rotulo mb-6 grid grid-cols-2 divide-x divide-y divide-line-fine bg-card lg:grid-cols-4 lg:divide-y-0">
                <Dato
                  className="px-4 py-3"
                  label="Días en tramitación"
                  valor={diasDesdeInicio}
                  unidad="días"
                  estado={plazoLegalExcedido ? "observa" : undefined}
                />
                <div className="min-w-0 px-4 py-3">
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Estado actual
                  </p>
                  <EstadoNormativo estado={veredicto} label={estadoCfg.label} />
                </div>
                <Dato className="px-4 py-3" label="Documentos" valor={documentos.length} />
                <Dato
                  className="px-4 py-3"
                  label="N° Expediente"
                  valor={proyecto.numero_expediente ?? "Sin asignar"}
                />
              </div>

              {/* El estado, el tipo de trámite y la dirección ya viven en el
                  rótulo y en el cuadro de control: repetirlos aquí empujaba
                  hacia abajo lo que de verdad decide si el expediente avanza. */}
              {plazoLegalExcedido && (
                <div className="mb-6">
                  <EstadoNormativo
                    estado="observa"
                    label={`Plazo legal excedido — ${diasDesdeInicio} días desde el ingreso`}
                  />
                </div>
              )}

              {/* Desarchivo: cuando aplica es bloqueante, va arriba del todo. */}
              <DesarchivoPanel
                proyectoId={proyecto.id}
                estadoProyecto={proyecto.estado}
                proyectoNombre={proyecto.nombre}
                municipio={proyecto.municipio}
                numeroExpediente={proyecto.numero_expediente}
              />

              {/* ── Zona 1 — lo que define si el expediente avanza ──────────
                  La zonificación es mucho más alta que la completitud (lleva
                  mapa y advertencias), así que la columna izquierda apila las
                  herramientas debajo en vez de dejar el hueco. */}
              <section className="mt-6">
                <SeccionLamina>Verificación normativa</SeccionLamina>
                <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                  <div className="space-y-4">
                    <ChecklistCompletitud
                      proyectoId={proyecto.id}
                      tipo={proyecto.tipo}
                      refreshKey={documentos.length}
                    />

                    {/* Herramientas IA del proyecto — lista técnica, sin emojis:
                        el ícono de línea pertenece al idioma del plano. */}
                    <div className="rotulo bg-card">
                      <p className="border-b border-line-fine px-4 py-2.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Herramientas IA
                      </p>
                      <div className="divide-y divide-line-fine">
                        {[
                          {
                            label: "Generar Memoria Descriptiva",
                            href: `/herramientas/memoria?nombre=${encodeURIComponent(proyecto.nombre)}&municipio=${encodeURIComponent(proyecto.municipio)}&direccion=${encodeURIComponent(proyecto.direccion ?? "")}&tipo=${encodeURIComponent(proyecto.tipo)}`,
                            Icon: FileText,
                          },
                          {
                            label: "Predecir observaciones DOM",
                            href: `/herramientas/predictor?municipio=${encodeURIComponent(proyecto.municipio)}&tipo=${encodeURIComponent(proyecto.tipo)}`,
                            Icon: Sparkles,
                          },
                          {
                            label: "Consultar OGUC",
                            href: `/herramientas/oguc-chat?municipio=${encodeURIComponent(proyecto.municipio)}`,
                            Icon: MessageCircle,
                          },
                          {
                            label: "Ver ficha DOM",
                            href: `/municipios/${encodeURIComponent(proyecto.municipio.toLowerCase().replace(/\s+/g, "-"))}`,
                            Icon: Landmark,
                          },
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium text-foreground/75 transition-colors hover:bg-muted/40 hover:text-foreground"
                          >
                            <item.Icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  {proyecto.direccion && (
                    <ZonificacionCard proyecto={proyecto} onUpdated={setProyecto} />
                  )}
                </div>
              </section>

              {/* ── Zona 2 — antecedentes de consulta ─────────────────────── */}
              <section className="mt-6">
                <SeccionLamina>Antecedentes del predio</SeccionLamina>
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  {/* Info card */}
                  <Card className="rounded-[3px] border-line-strong shadow-none">
                    <CardHeader className="flex-row items-center justify-between">
                      <CardTitle className="font-technical">Información</CardTitle>
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

                      {/* SII Cadastral Data */}
                      {proyecto.rol_sii && (
                        <>
                          <div className="my-1 border-t border-dashed border-border/60" />
                          {proyecto.rol_sii && (
                            <InfoRow label="Rol SII">
                              <span className="font-mono">{proyecto.rol_sii}</span>
                            </InfoRow>
                          )}
                          {proyecto.destino_sii && (
                            <InfoRow label="Destino SII">
                              <span className="capitalize">{proyecto.destino_sii.toLowerCase()}</span>
                            </InfoRow>
                          )}
                          {proyecto.avaluo_fiscal_clp && (
                            <InfoRow label="Avalúo fiscal">
                              {new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(proyecto.avaluo_fiscal_clp)}
                            </InfoRow>
                          )}
                          {proyecto.superficie_terreno_m2 && (
                            <InfoRow label="Sup. terreno">
                              {proyecto.superficie_terreno_m2.toLocaleString("es-CL")} m²
                            </InfoRow>
                          )}
                          {proyecto.superficie_construida_m2 && (
                            <InfoRow label="Sup. construida">
                              {proyecto.superficie_construida_m2.toLocaleString("es-CL")} m²
                            </InfoRow>
                          )}
                          <div className="my-1 border-t border-dashed border-border/60" />
                        </>
                      )}

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

                      <div className={MOSTRAR_ACCIONES_EXTERNAS ? "pt-2" : "hidden"}>
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
                      {MOSTRAR_ACCIONES_EXTERNAS && proyecto.cliente?.telefono && (
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

                  {/* Mapa del predio */}
                  {proyecto.direccion && (
                    <Card className="rounded-[3px] border-line-strong shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-technical text-sm">Ubicación del predio</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <PredioMap
                          direccion={proyecto.direccion}
                          municipio={proyecto.municipio}
                          lat={proyecto.lat}
                          lng={proyecto.lng}
                        />
                      </CardContent>
                    </Card>
                  )}

                </div>
              </section>

              {/* ── Zona 3 — notas internas, al cierre de la lámina ───────── */}
              <section className="mt-6">
                <SeccionLamina>Notas internas</SeccionLamina>
                <Card className="rounded-[3px] border-line-strong shadow-none">
                  <CardContent className="space-y-3 pt-5">
                    <Textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Notas internas del proyecto..."
                      rows={3}
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
              </section>
            </TabsContent>

            {/* ── Documentos ── */}
            {/* El expediente distingue lo que un archivador de arquitectura
                distingue: LÁMINAS (planos, numerados L-01…) y ANTECEDENTES
                (certificados, memorias, el resto del papeleo). */}
            <TabsContent value="documentos" className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="font-technical text-sm font-semibold text-foreground">
                  Documentos del expediente{" "}
                  <span className="num text-xs text-muted-foreground">({documentos.length})</span>
                </p>
                <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="size-4" />
                  Subir
                </Button>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
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
              </div>

              {(() => {
                const laminas = documentos.filter((d) => esPlano(d.tipo))
                const antecedentes = documentos.filter((d) => !esPlano(d.tipo))
                const esImagen = (url: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url)
                return (
                  <>
                    {laminas.length > 0 && (
                      <section>
                        <SeccionLamina>Láminas ({laminas.length})</SeccionLamina>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {laminas.map((d, i) => (
                            <div key={d.id} className="rotulo group overflow-hidden bg-card">
                              {/* Vista de la lámina: imagen real si la hay; si es
                                  PDF, papel milimetrado como sustituto honesto. */}
                              <div className="bg-blueprint-grid relative flex h-36 items-center justify-center border-b border-line-fine">
                                {esImagen(d.url) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={d.url}
                                    alt={d.nombre}
                                    className="h-full w-full object-contain p-2"
                                  />
                                ) : (
                                  <FileText className="size-8 text-[var(--blueprint)]/50" strokeWidth={1.25} />
                                )}
                                <span className="num absolute left-2 top-2 rounded-[3px] border border-line-med bg-card/90 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                                  L-{String(i + 1).padStart(2, "0")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                  <p className="font-technical truncate text-[13px] font-medium text-foreground">
                                    {d.nombre}
                                  </p>
                                  <p className="num truncate text-[10.5px] text-muted-foreground">
                                    {d.tipo} · {formatDate(d.created_at)}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-[11px] text-muted-foreground"
                                  onClick={() => setActiveTab("dd")}
                                  title="Ver la lámina anotada en el Due Diligence"
                                >
                                  Ver anotada
                                </Button>
                                <Button
                                  nativeButton={false}
                                  render={<a href={d.url} target="_blank" rel="noopener noreferrer" download />}
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Descargar"
                                  className="text-muted-foreground"
                                >
                                  <Download className="size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section>
                      <SeccionLamina>Antecedentes ({antecedentes.length})</SeccionLamina>
                      <div className="rotulo divide-y divide-line-fine bg-card">
                        {antecedentes.map((d) => (
                          <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                            {docIcon(d.tipo)}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-foreground">
                                {d.nombre}
                              </p>
                            </div>
                            <p className="num hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                              {d.tipo}
                            </p>
                            <p className="num shrink-0 text-[11px] text-muted-foreground">
                              {formatDate(d.created_at)}
                            </p>
                            <Button
                              nativeButton={false}
                              render={<a href={d.url} target="_blank" rel="noopener noreferrer" download />}
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Descargar"
                              className="text-muted-foreground"
                            >
                              <Download className="size-4" />
                            </Button>
                          </div>
                        ))}
                        {antecedentes.length === 0 && (
                          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                            Sin antecedentes adjuntos.
                          </p>
                        )}
                      </div>
                    </section>
                  </>
                )
              })()}
            </TabsContent>

            {/* ── Due Diligence ── */}
            <TabsContent value="dd">
              <DueDiligenceReport proyectoId={id} onApplied={refetchPmo} />
            </TabsContent>

            {/* ── PMO ── */}
            <TabsContent value="pmo">
              <PmoPanel
                proyecto={proyecto}
                etapas={etapas}
                observaciones={observaciones}
                comunicaciones={comunicaciones}
                ddResult={ddResult}
                onAddObservacion={addObservacion}
                onMarcarRespondida={marcarRespondida}
                onAddComunicacion={addComunicacion}
                onEmailSeguimiento={handleGenerarEmailSeguimiento}
              />
            </TabsContent>
          </Tabs>
        )}

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
