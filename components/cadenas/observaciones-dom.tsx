"use client"

import { useEffect, useState } from "react"
import {
  Plus,
  Sparkles,
  Copy,
  CheckCheck,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type EstadoObservacion = "pendiente" | "en_respuesta" | "respondida" | "subsanada"

type Observacion = {
  id: string
  local_id: string
  texto: string
  asignado_a?: string
  deadline?: string
  estado: EstadoObservacion
  respuesta_ia?: string
  created_at: string
}

const ESTADO_CONFIG: Record<EstadoObservacion, { label: string; color: string }> = {
  pendiente:    { label: "Pendiente",    color: "bg-amber-100 text-amber-700 border-amber-200" },
  en_respuesta: { label: "En respuesta", color: "bg-blue-100 text-blue-700 border-blue-200" },
  respondida:   { label: "Respondida",   color: "bg-violet-100 text-violet-700 border-violet-200" },
  subsanada:    { label: "Subsanada",    color: "bg-green-100 text-green-700 border-green-200" },
}

export function ObservacionesDOM({ localId, municipio, localNumero }: { localId: string; municipio: string; localNumero?: string }) {
  const [observaciones, setObservaciones] = useState<Observacion[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [expanded, setExpanded] = useState<boolean>(true)
  const [addDialog, setAddDialog] = useState<boolean>(false)
  const [newTexto, setNewTexto] = useState<string>("")
  const [newAsignado, setNewAsignado] = useState<string>("")
  const [newDeadline, setNewDeadline] = useState<string>("")
  const [saving, setSaving] = useState<boolean>(false)
  const [generatingIA, setGeneratingIA] = useState<string | null>(null)
  const [respuestaDialog, setRespuestaDialog] = useState<{ obs: Observacion; respuesta: string } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function fetchObservaciones() {
    setLoading(true)
    try {
      const res = await fetch(`/api/locales/${localId}/observaciones`)
      const data = await res.json() as { observaciones: Observacion[] }
      setObservaciones(data.observaciones ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchObservaciones()
  }, [localId])

  async function handleAdd() {
    if (!newTexto.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/locales/${localId}/observaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: newTexto,
          ...(newAsignado ? { asignado_a: newAsignado } : {}),
          ...(newDeadline ? { deadline: newDeadline } : {}),
        }),
      })
      setNewTexto("")
      setNewAsignado("")
      setNewDeadline("")
      setAddDialog(false)
      await fetchObservaciones()
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateIA(obs: Observacion) {
    setGeneratingIA(obs.id)
    try {
      const res = await fetch("/api/ai/observation-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          observacionTexto: obs.texto,
          proyectoNombre: `Local ${localNumero ?? localId}`,
          municipio,
          tipoPermiso: "Permiso de edificación",
        }),
      })
      const data: { respuesta: string } = await res.json()
      setRespuestaDialog({ obs, respuesta: data.respuesta })
    } finally {
      setGeneratingIA(null)
    }
  }

  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold text-foreground">Observaciones DOM</span>
        <Badge
          variant="outline"
          className={
            observaciones.length > 0
              ? "bg-amber-100 text-amber-700 border-amber-200"
              : "bg-green-100 text-green-700 border-green-200"
          }
        >
          {observaciones.length}
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Colapsar" : "Expandir"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Dialog open={addDialog} onOpenChange={setAddDialog}>
            <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Agregar observación" />}>
              <Plus className="h-4 w-4" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nueva observación</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="obs-texto">Texto de la observación *</Label>
                  <Textarea
                    id="obs-texto"
                    value={newTexto}
                    onChange={(e) => setNewTexto(e.target.value)}
                    placeholder="Describe la observación..."
                    className="min-h-[100px]"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="obs-asignado">Asignado a</Label>
                  <Input
                    id="obs-asignado"
                    value={newAsignado}
                    onChange={(e) => setNewAsignado(e.target.value)}
                    placeholder="Nombre o email"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="obs-deadline">Fecha límite</Label>
                  <Input
                    id="obs-deadline"
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" disabled={saving} />}>
                  Cancelar
                </DialogClose>
                <Button onClick={handleAdd} disabled={saving || !newTexto.trim()}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-xl border bg-white p-4 shadow-sm animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : observaciones.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border bg-white p-4 shadow-sm text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              Sin observaciones registradas
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {observaciones.map((obs) => (
                <div key={obs.id} className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground flex-1">{obs.texto}</p>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${ESTADO_CONFIG[obs.estado].color}`}
                    >
                      {ESTADO_CONFIG[obs.estado].label}
                    </Badge>
                  </div>
                  {(obs.asignado_a || obs.deadline) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {obs.asignado_a && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {obs.asignado_a}
                        </span>
                      )}
                      {obs.deadline && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {obs.deadline}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateIA(obs)}
                      disabled={generatingIA === obs.id}
                      className="h-8 text-xs gap-1.5"
                    >
                      {generatingIA === obs.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Responder con IA
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {respuestaDialog && (
        <Dialog open={!!respuestaDialog} onOpenChange={(open) => { if (!open) setRespuestaDialog(null) }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold leading-snug">
                Respuesta IA — {respuestaDialog.obs.texto.substring(0, 50)}
                {respuestaDialog.obs.texto.length > 50 ? "…" : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Textarea
                readOnly
                value={respuestaDialog.respuesta}
                className="min-h-[200px] whitespace-pre-wrap text-sm resize-none"
              />
            </div>
            <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(respuestaDialog.respuesta, respuestaDialog.obs.id)}
                className="gap-1.5"
              >
                {copiedId === respuestaDialog.obs.id ? (
                  <>
                    <CheckCheck className="h-4 w-4 text-green-600" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </Button>
              <DialogClose render={<Button variant="ghost" size="sm" />}>
                Cerrar
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
