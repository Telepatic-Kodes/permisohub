"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  FileText,
  Loader2,
  CalendarClock,
  Hash,
  Coins,
} from "lucide-react"
import type { EstadoDesarchivo, SolicitudDesarchivo } from "@/types"
import { contarDiasHabiles } from "@/lib/dias-habiles"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// ──────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────
interface MunicipioInfo {
  plazo_tipico_dias: number
  url_prc: string | null
  alertas: Array<{ nivel: 'info' | 'warning' | 'danger'; texto: string }>
}

interface DesarchivoData {
  esta_archivado: boolean
  fecha_archivado: string | null
  solicitud_desarchivo: SolicitudDesarchivo | null
  municipio_info?: MunicipioInfo
}

interface DesarchivoPanelProps {
  proyectoId: string
  estadoProyecto: string
  proyectoNombre?: string
  municipio?: string
  numeroExpediente?: string
}

// ──────────────────────────────────────────────────
// Helpers de estado / pasos
// ──────────────────────────────────────────────────
const PASOS: { estado: EstadoDesarchivo; label: string }[] = [
  { estado: "solicitado", label: "Solicitado" },
  { estado: "pagado", label: "Pagado" },
  { estado: "en_proceso", label: "En proceso" },
  { estado: "completado", label: "Completado" },
]

const ESTADO_BADGE: Record<EstadoDesarchivo, { label: string; className: string }> = {
  solicitado: { label: "Solicitado", className: "bg-amber-100 text-amber-700 border-amber-200" },
  pagado: { label: "Pagado", className: "bg-blue-100 text-blue-700 border-blue-200" },
  en_proceso: { label: "En proceso", className: "bg-violet-100 text-violet-700 border-violet-200" },
  completado: { label: "Completado", className: "bg-green-100 text-green-700 border-green-200" },
  rechazado: { label: "Rechazado", className: "bg-red-100 text-red-700 border-red-200" },
}

// Día hábil transcurrido desde la fecha de solicitud hasta hoy
function diasHabilesTranscurridos(fechaInicio: string): number {
  try {
    return contarDiasHabiles(new Date(fechaInicio), new Date())
  } catch {
    const d1 = new Date(fechaInicio)
    const d2 = new Date()
    return Math.floor((d2.getTime() - d1.getTime()) / 86400000)
  }
}

function ordenEstado(estado: EstadoDesarchivo): number {
  const idx = PASOS.findIndex((p) => p.estado === estado)
  return idx === -1 ? -1 : idx
}

function fechaLegible(fecha: string): string {
  const d = new Date(fecha)
  if (Number.isNaN(d.getTime())) return fecha
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })
}

// ──────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────
export function DesarchivoPanel({ proyectoId, estadoProyecto, proyectoNombre, municipio, numeroExpediente }: DesarchivoPanelProps) {
  const [data, setData] = useState<DesarchivoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Form de solicitud
  const [numeroSolicitud, setNumeroSolicitud] = useState("")
  const [costoUf, setCostoUf] = useState("")
  const [observaciones, setObservaciones] = useState("")

  // Carta IA
  const [cartaOpen, setCartaOpen] = useState(false)
  const [cartaTexto, setCartaTexto] = useState("")
  const [cartaBusy, setCartaBusy] = useState(false)
  const [cartaCopiada, setCartaCopiada] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/desarchivo`)
      const json = (await res.json()) as DesarchivoData & { ok?: boolean }
      setData({
        esta_archivado: json.esta_archivado ?? false,
        fecha_archivado: json.fecha_archivado ?? null,
        solicitud_desarchivo: json.solicitud_desarchivo ?? null,
        municipio_info: json.municipio_info,
      })
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ── Acciones ──────────────────────────────────────
  async function marcarArchivado() {
    setBusy(true)
    try {
      await fetch(`/api/proyectos/${proyectoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          esta_archivado: true,
          fecha_archivado: new Date().toISOString().slice(0, 10),
        }),
      })
      await fetchData()
    } finally {
      setBusy(false)
    }
  }

  async function generarCarta() {
    setCartaBusy(true)
    setCartaOpen(true)
    setCartaTexto("")
    try {
      const res = await fetch("/api/ai/generate-communication", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "carta_formal",
          proyectoNombre: proyectoNombre ?? "Expediente archivado",
          municipio: municipio ?? "la DOM",
          numeroExpediente,
          observaciones: "Solicitud de desarchivo del expediente para retomar tramitación.",
        }),
      })
      const json = (await res.json()) as { ok: boolean; texto?: string; error?: string }
      setCartaTexto(json.texto ?? json.error ?? "No se pudo generar la carta.")
    } catch {
      setCartaTexto("Error al conectar con el servicio de IA.")
    } finally {
      setCartaBusy(false)
    }
  }

  async function enviarSolicitud() {
    setBusy(true)
    try {
      await fetch(`/api/proyectos/${proyectoId}/desarchivo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_solicitud: numeroSolicitud.trim() || undefined,
          costo_uf: costoUf.trim() ? Number(costoUf) : undefined,
          observaciones: observaciones.trim() || undefined,
        }),
      })
      setDialogOpen(false)
      setNumeroSolicitud("")
      setCostoUf("")
      setObservaciones("")
      await fetchData()
    } finally {
      setBusy(false)
    }
  }

  async function avanzarEstado(estado: EstadoDesarchivo) {
    setBusy(true)
    try {
      await fetch(`/api/proyectos/${proyectoId}/desarchivo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      })
      await fetchData()
    } finally {
      setBusy(false)
    }
  }

  // ── Visibilidad ───────────────────────────────────
  const visible =
    estadoProyecto === "aprobado" ||
    estadoProyecto === "rechazado" ||
    data?.esta_archivado === true

  if (!visible) return null

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando estado del expediente…
        </CardContent>
      </Card>
    )
  }

  const solicitud = data?.solicitud_desarchivo ?? null

  // ── C) Solicitud activa ───────────────────────────
  if (solicitud) {
    const ordenActual = ordenEstado(solicitud.estado)
    const badge = ESTADO_BADGE[solicitud.estado]
    const finalizado = solicitud.estado === "completado" || solicitud.estado === "rechazado"
    const dias = diasHabilesTranscurridos(solicitud.fecha_solicitud)

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Archive className="size-4 text-primary/70" />
              Desarchivo del Expediente
            </CardTitle>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                badge.className,
              )}
            >
              {badge.label}
            </span>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Timeline */}
          <ol className="space-y-0">
            {PASOS.map((paso, i) => {
              const completado = solicitud.estado !== "rechazado" && ordenActual >= i
              const actual = solicitud.estado === paso.estado
              const isLast = i === PASOS.length - 1
              return (
                <li key={paso.estado} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {completado ? (
                      <CheckCircle2
                        className={cn(
                          "size-5 shrink-0",
                          actual ? "text-primary" : "text-green-500",
                        )}
                      />
                    ) : (
                      <Circle className="size-5 shrink-0 text-muted-foreground/30" />
                    )}
                    {!isLast && (
                      <span
                        className={cn(
                          "my-0.5 w-px flex-1 min-h-6",
                          ordenActual > i && solicitud.estado !== "rechazado"
                            ? "bg-green-400"
                            : "bg-border",
                        )}
                      />
                    )}
                  </div>
                  <div className={cn("pb-4", isLast && "pb-0")}>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        completado ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {paso.label}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>

          {/* Detalles */}
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
            {solicitud.numero_solicitud && (
              <div className="flex items-center gap-2">
                <Hash className="size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-[11px] text-muted-foreground">N° solicitud</dt>
                  <dd className="font-medium">{solicitud.numero_solicitud}</dd>
                </div>
              </div>
            )}
            {solicitud.costo_uf !== undefined && (
              <div className="flex items-center gap-2">
                <Coins className="size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-[11px] text-muted-foreground">Costo</dt>
                  <dd className="font-medium">{solicitud.costo_uf} UF</dd>
                </div>
              </div>
            )}
            {solicitud.fecha_pago && (
              <div className="flex items-center gap-2">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-[11px] text-muted-foreground">Fecha pago</dt>
                  <dd className="font-medium">{fechaLegible(solicitud.fecha_pago)}</dd>
                </div>
              </div>
            )}
            {solicitud.fecha_estimada_entrega && (
              <div className="flex items-center gap-2">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                <div>
                  <dt className="text-[11px] text-muted-foreground">Entrega estimada</dt>
                  <dd className="font-medium">{fechaLegible(solicitud.fecha_estimada_entrega)}</dd>
                </div>
              </div>
            )}
          </dl>

          {solicitud.observaciones && (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Observaciones
              </p>
              <p className="text-sm text-foreground">{solicitud.observaciones}</p>
            </div>
          )}

          {data?.municipio_info && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Info DOM del municipio
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Plazo típico: <strong className="text-foreground">{data.municipio_info.plazo_tipico_dias} días hábiles</strong></span>
                {data.municipio_info.url_prc && (
                  <a
                    href={data.municipio_info.url_prc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:no-underline"
                  >
                    Ver Plan Regulador →
                  </a>
                )}
              </div>
              {data.municipio_info.alertas.map((a, i) => (
                <p key={i} className={cn(
                  "text-xs",
                  a.nivel === 'danger' ? "text-red-600" : a.nivel === 'warning' ? "text-amber-600" : "text-blue-600"
                )}>
                  {a.nivel === 'danger' ? '⚠ ' : a.nivel === 'warning' ? '⚡ ' : 'ℹ '}{a.texto}
                </p>
              ))}
            </div>
          )}

          {!finalizado && (
            <p className="text-xs text-muted-foreground">
              {dias} día{dias !== 1 ? "s" : ""} hábil{dias !== 1 ? "es" : ""} transcurrido
              {dias !== 1 ? "s" : ""} desde la solicitud ({fechaLegible(solicitud.fecha_solicitud)}).
            </p>
          )}

          {/* Botones de avance */}
          {!finalizado && (
            <div className="flex flex-wrap gap-2">
              {solicitud.estado === "solicitado" && (
                <Button size="sm" disabled={busy} onClick={() => void avanzarEstado("pagado")}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Marcar como Pagado
                </Button>
              )}
              {solicitud.estado === "pagado" && (
                <Button size="sm" disabled={busy} onClick={() => void avanzarEstado("en_proceso")}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Marcar En proceso
                </Button>
              )}
              {solicitud.estado === "en_proceso" && (
                <Button size="sm" disabled={busy} onClick={() => void avanzarEstado("completado")}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Marcar Completado
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── B) Archivado, sin solicitud activa ────────────
  if (data?.esta_archivado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="size-4 text-primary/70" />
            Archivo del Expediente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              Expediente archivado en DOM el{" "}
              <span className="font-semibold">
                {data.fecha_archivado ? fechaLegible(data.fecha_archivado) : "—"}
              </span>
              . Para volver a tramitarlo necesitas solicitar su desarchivo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void generarCarta()}>
              <FileText className="size-3.5" />
              Generar carta de solicitud
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button />}>Solicitar Desarchivo</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Desarchivo</DialogTitle>
                <DialogDescription>
                  Registra la solicitud de desarchivo presentada ante la DOM.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="numero-solicitud">N° de solicitud DOM (opcional)</Label>
                  <Input
                    id="numero-solicitud"
                    placeholder="Ej: DESC-2026-0041"
                    value={numeroSolicitud}
                    onChange={(e) => setNumeroSolicitud(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="costo-uf">Costo en UF</Label>
                  <Input
                    id="costo-uf"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Ej: 3.5"
                    value={costoUf}
                    onChange={(e) => setCostoUf(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    rows={3}
                    placeholder="Detalles de la solicitud…"
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button disabled={busy} onClick={() => void enviarSolicitud()}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}
                  Enviar solicitud
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>

          {/* Modal carta IA */}
          <Dialog open={cartaOpen} onOpenChange={setCartaOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="size-4" />
                  Carta de solicitud de desarchivo
                </DialogTitle>
                <DialogDescription>
                  Generada por IA. Revisa y personaliza antes de enviar.
                </DialogDescription>
              </DialogHeader>
              <div className="relative max-h-[60vh] overflow-y-auto rounded-lg border bg-muted/30 p-4">
                {cartaBusy ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Generando carta…
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{cartaTexto}</pre>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={cartaBusy || !cartaTexto}
                  onClick={() => {
                    void navigator.clipboard.writeText(cartaTexto)
                    setCartaCopiada(true)
                    setTimeout(() => setCartaCopiada(false), 2000)
                  }}
                >
                  <Copy className="size-3.5" />
                  {cartaCopiada ? "¡Copiado!" : "Copiar texto"}
                </Button>
                <Button variant="outline" onClick={() => setCartaOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    )
  }

  // ── A) Aprobado/rechazado, no archivado ───────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="size-4 text-primary/70" />
          Archivo del Expediente
        </CardTitle>
        <CardDescription>
          El expediente ha sido resuelto. Si no lo usarás próximamente, puedes marcarlo como
          archivado para indicar que la DOM lo ha ingresado a archivo físico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" disabled={busy} onClick={() => void marcarArchivado()}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          <Archive className="size-3.5" />
          Marcar como archivado
        </Button>
      </CardContent>
    </Card>
  )
}
