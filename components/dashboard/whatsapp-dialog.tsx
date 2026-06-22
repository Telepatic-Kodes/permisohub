"use client"

import { useEffect, useState } from "react"
import { Check, ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  getPlantilla,
  getWhatsAppLink,
  type TipoNotificacionWA,
  type PlantillaParams,
} from "@/lib/whatsapp-templates"

const TIPOS: { value: TipoNotificacionWA; label: string }[] = [
  { value: 'proyecto_ingresado', label: 'Proyecto ingresado a DOM' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'con_observaciones', label: 'Con observaciones' },
  { value: 'aprobado', label: 'Permiso aprobado' },
  { value: 'rechazado', label: 'Permiso denegado' },
  { value: 'recepcion_solicitada', label: 'Recepción final solicitada' },
  { value: 'recepcion_aprobada', label: 'Recepción final aprobada' },
  { value: 'actualizacion_general', label: 'Actualización general' },
]

interface Props {
  open: boolean
  onClose: () => void
  telefono: string
  proyectoNombre: string
  municipio: string
  clienteNombre: string
}

interface EnvioState {
  status: 'idle' | 'sending' | 'ok' | 'error'
  sid?: string
  error?: string
}

export function WhatsAppDialog({ open, onClose, telefono, proyectoNombre, municipio, clienteNombre }: Props) {
  const [tipo, setTipo] = useState<TipoNotificacionWA>('actualizacion_general')
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [envio, setEnvio] = useState<EnvioState>({ status: 'idle' })
  const [copiado, setCopiado] = useState(false)

  const params: PlantillaParams = { proyectoNombre, municipio }
  const preview = getPlantilla(tipo, params)
  const waLink = getWhatsAppLink(telefono, tipo, params)

  useEffect(() => {
    if (!open) return
    setEnvio({ status: 'idle' })
    setTipo('actualizacion_general')
    fetch('/api/notifications/whatsapp')
      .then(r => r.json() as Promise<{ configured: boolean }>)
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false))
  }, [open])

  async function handleEnviar() {
    setEnvio({ status: 'sending' })
    try {
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, tipo, proyectoNombre, municipio }),
      })
      const data = await res.json() as { ok: boolean; sid?: string; error?: string }
      setEnvio(data.ok
        ? { status: 'ok', sid: data.sid }
        : { status: 'error', error: data.error }
      )
    } catch (err) {
      setEnvio({ status: 'error', error: err instanceof Error ? err.message : 'Error' })
    }
  }

  function handleCopiarPreview() {
    void navigator.clipboard.writeText(preview).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <MessageCircle className="size-5 text-green-600" />
            Notificar a {clienteNombre}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-primary">Tipo de mensaje</label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoNotificacionWA)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-primary">Preview del mensaje</label>
              <button
                onClick={handleCopiarPreview}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {copiado ? <Check className="size-3 text-green-600" /> : null}
                {copiado ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
            <Textarea
              readOnly
              value={preview}
              rows={8}
              className="resize-none bg-muted font-mono text-xs leading-relaxed text-gray-700"
            />
          </div>

          {/* Resultado del envío */}
          {envio.status === 'ok' && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              <Check className="size-4 shrink-0" />
              <span>Mensaje enviado correctamente{envio.sid ? ` (SID: ${envio.sid.slice(-8)})` : ''}</span>
            </div>
          )}
          {envio.status === 'error' && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <X className="size-4 shrink-0" />
              <span>{envio.error ?? 'Error al enviar'}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {configured && (
              <Button
                onClick={() => void handleEnviar()}
                disabled={envio.status === 'sending' || envio.status === 'ok'}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                {envio.status === 'sending' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {envio.status === 'sending' ? 'Enviando...' : 'Enviar por WhatsApp API'}
              </Button>
            )}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors ${configured ? '' : 'flex-1'}`}
            >
              <ExternalLink className="size-4" />
              {configured ? 'WhatsApp Web' : 'Abrir en WhatsApp Web'}
            </a>
          </div>

          {configured === false && (
            <p className="text-xs text-muted-foreground text-center">
              Twilio no configurado — puedes usar WhatsApp Web con el mensaje pre-cargado
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
