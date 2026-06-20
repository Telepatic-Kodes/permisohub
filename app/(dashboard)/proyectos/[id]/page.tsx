"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Upload,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  MOCK_COMUNICACIONES,
  MOCK_DOCUMENTOS,
  MOCK_ETAPAS,
  MOCK_PROYECTOS,
} from "@/lib/mock-data"
import { ESTADO_CONFIG, TIPO_PERMISO_LABELS } from "@/types"
import { getEstadoPlazoLey21718, formatFecha } from "@/lib/dias-habiles"
import { cn } from "@/lib/utils"

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
    return <FileSpreadsheet className="size-5 text-[#1A3328]" />
  return <FileText className="size-5 text-[#1A3328]" />
}

export default function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const proyecto = MOCK_PROYECTOS.find((p) => p.id === id) ?? MOCK_PROYECTOS[0]
  const estadoCfg = ESTADO_CONFIG[proyecto.estado]

  // Calculate days since inicio
  const diasDesdeInicio = Math.floor(
    (new Date().getTime() - new Date(proyecto.fecha_inicio).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  const plazoLegalExcedido =
    diasDesdeInicio > 30 &&
    !["aprobado", "rechazado", "borrador"].includes(proyecto.estado)

  const [verificando, setVerificando] = useState(false)
  const [ultimaVerificacion, setUltimaVerificacion] = useState<{
    changed: boolean
    estadoNuevo?: string
    simulated?: boolean
    fetchedAt: string
  } | null>(null)

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
    <div className="space-y-6">
      <Link
        href="/proyectos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[#1A3328]"
      >
        <ArrowLeft className="size-4" />
        Proyectos
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
                {proyecto.nombre}
              </h1>
              {!["aprobado", "rechazado"].includes(proyecto.estado) && (
                <Button
                  nativeButton={false}
                  render={<Link href={`/proyectos/${proyecto.id}/ingreso`} />}
                  variant="outline"
                  className="border-[#1A3328] text-[#1A3328] hover:bg-[#F0EBE1]"
                >
                  <Upload className="size-4" />
                  Preparar ingreso DOM
                </Button>
              )}
            </div>
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
                {MOCK_ETAPAS.map((etapa, idx) => {
                  const isLast = idx === MOCK_ETAPAS.length - 1
                  const completed = etapa.estado === "completada"
                  const current = etapa.estado === "en_curso"
                  return (
                    <li key={etapa.id} className="flex gap-4 pb-6 last:pb-0">
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                            completed &&
                              "border-[#1A3328] bg-[#1A3328] text-white",
                            current &&
                              "border-[#1A3328] bg-white text-[#1A3328]",
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
                              completed ? "bg-[#1A3328]" : "bg-border"
                            )}
                          />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            current
                              ? "text-[#1A3328]"
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
                      </div>
                    </li>
                  )
                })}
              </ol>
            </CardContent>
          </Card>

          {/* Comunicaciones */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Comunicaciones</CardTitle>
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                Agregar comunicación
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {MOCK_COMUNICACIONES.map((c) => (
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
                  <p className="mt-1 text-sm font-medium text-[#1A3328]">
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
                    className="flex items-center gap-2 text-sm text-[#1A3328] hover:underline"
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
              <Button variant="ghost" size="icon-sm" aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow icon={<Users className="size-4" />} label="Cliente">
                {proyecto.cliente?.nombre ?? "—"}
              </InfoRow>
              <InfoRow icon={<MapPin className="size-4" />} label="Municipio">
                {proyecto.municipio}
              </InfoRow>
              <InfoRow label="N° Expediente">
                {proyecto.numero_expediente ?? "—"}
              </InfoRow>
              <InfoRow label="Fecha inicio">
                {formatDate(proyecto.fecha_inicio)}
              </InfoRow>
              <InfoRow label="Fecha estimada">
                {formatDate(proyecto.fecha_estimada)}
              </InfoRow>

              <div className="pt-2">
                <button
                  onClick={handleVerificarEstado}
                  disabled={verificando}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#1A3328] px-3 py-2 text-sm font-medium text-[#1A3328] hover:bg-[#F0EBE1] disabled:opacity-50 transition-colors"
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
                  <p className="text-xs text-muted-foreground mt-1">
                    {ultimaVerificacion.simulated ? "(simulado) " : ""}
                    {ultimaVerificacion.changed
                      ? `Estado actualizado → ${ultimaVerificacion.estadoNuevo}`
                      : "Sin cambios en el portal"}
                    {" · "}
                    {new Date(ultimaVerificacion.fetchedAt).toLocaleTimeString(
                      "es-CL"
                    )}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Plazo Ley 21.718 */}
          {proyecto.fecha_inicio && (
            <PlazoLey21718Card
              fechaIngreso={proyecto.fecha_inicio}
              tieneRevisorIndependiente={false}
            />
          )}

          {/* Documentos */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Documentos</CardTitle>
              <Button variant="outline" size="sm">
                <Upload className="size-4" />
                Subir
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_DOCUMENTOS.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  {docIcon(d.tipo)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#1A3328]">
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
                defaultValue="Cliente solicita priorizar la aprobación antes de la temporada alta. Coordinar con la DOM una reunión de revisión conjunta para acelerar las observaciones."
                rows={5}
              />
              <Button className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90">
                Guardar notas
              </Button>
            </CardContent>
          </Card>
        </div>
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
      <span className="text-right font-medium text-[#1A3328]">{children}</span>
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
}: {
  fechaIngreso: string
  tieneRevisorIndependiente: boolean
}) {
  const estado = getEstadoPlazoLey21718(
    new Date(`${fechaIngreso}T00:00:00`),
    tieneRevisorIndependiente
  )
  const cfg = PLAZO_ESTADO_CONFIG[estado.estado]

  return (
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
          <p className="font-medium text-[#1A3328]">
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
      </CardContent>
    </Card>
  )
}
