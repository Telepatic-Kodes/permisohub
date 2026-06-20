"use client"

import { useEffect, useState } from "react"
import { MessageCircle, CheckCircle2, AlertCircle, Send, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { TipoNotificacionWA } from "@/lib/whatsapp"

const TIPOS_MENSAJE: Array<{ value: TipoNotificacionWA; label: string }> = [
  { value: 'proyecto_ingresado', label: 'Proyecto ingresado a la DOM' },
  { value: 'en_revision', label: 'En revisión por la DOM' },
  { value: 'con_observaciones', label: 'Observaciones recibidas' },
  { value: 'aprobado', label: '✅ Permiso aprobado' },
  { value: 'recepcion_aprobada', label: '🏠 Recepción final aprobada' },
  { value: 'actualizacion_general', label: 'Actualización general' },
]

export default function WhatsAppConfigPage() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testTipo, setTestTipo] = useState<TipoNotificacionWA>('aprobado')
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Check config on mount
  useEffect(() => {
    fetch('/api/notifications/whatsapp')
      .then(r => r.json() as Promise<{ configured: boolean }>)
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false))
  }, [])

  async function sendTest() {
    if (!testPhone || !testTipo) return
    setSending(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: testPhone,
          tipo: testTipo,
          proyectoNombre: 'Proyecto de prueba',
          municipio: 'Las Condes',
          arquitecta: 'Estefanía Parada',
        }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      setTestResult({
        ok: data.ok,
        message: data.ok ? 'Mensaje enviado exitosamente!' : (data.error ?? 'Error desconocido'),
      })
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[#25D366] text-white">
          <MessageCircle className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">WhatsApp para clientes</h1>
          <p className="text-sm text-muted-foreground">Notificaciones automáticas vía Twilio WhatsApp Business</p>
        </div>
      </div>

      {/* Status */}
      <Card className={configured ? 'border-green-200' : 'border-amber-200'}>
        <CardContent className="flex items-center gap-3 pt-4">
          {configured === null ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          ) : configured ? (
            <>
              <CheckCircle2 className="size-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-700">WhatsApp configurado</p>
                <p className="text-sm text-muted-foreground">Las notificaciones automáticas están activas</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="size-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium text-amber-700">WhatsApp no configurado</p>
                <p className="text-sm text-muted-foreground">Agrega las variables de entorno de Twilio para activar</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Setup instructions */}
      {!configured && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#1A3328]">Cómo configurar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="font-semibold">1. Crear cuenta Twilio</p>
              <a
                href="https://www.twilio.com/try-twilio"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#1A3328] underline"
              >
                twilio.com/try-twilio <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">2. Activar el Sandbox de WhatsApp (para pruebas gratuitas)</p>
              <p className="text-muted-foreground">Console → Messaging → Try it out → Send a WhatsApp message</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">3. Agregar variables de entorno en Vercel y .env.local</p>
              <div className="rounded-lg bg-gray-900 p-3 font-mono text-xs text-gray-100 space-y-1">
                <p>TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</p>
                <p>TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</p>
                <p>TWILIO_WHATSAPP_NUMBER=+14155238886 <span className="text-gray-400"># Sandbox number</span></p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">4. Para producción</p>
              <p className="text-muted-foreground">Solicitar aprobación de número WhatsApp Business en Twilio Console. Proceso toma 1-2 semanas.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test send */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#1A3328]">Enviar mensaje de prueba</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Teléfono del destinatario</Label>
            <Input
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="9XXXXXXXX o +569XXXXXXXX"
            />
            <p className="text-xs text-muted-foreground">Formato chileno — el sistema normaliza automáticamente</p>
          </div>
          <div className="space-y-2">
            <Label>Tipo de mensaje</Label>
            <Select value={testTipo} onValueChange={v => setTestTipo(v as TipoNotificacionWA)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_MENSAJE.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {testResult && (
            <div className={`flex gap-2 rounded-lg p-3 text-sm ${testResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
              {testResult.message}
            </div>
          )}

          <Button
            onClick={() => void sendTest()}
            disabled={!testPhone || sending}
            className="w-full bg-[#25D366] text-white hover:bg-[#1ea855]"
          >
            {sending ? <><Loader2 className="size-4 animate-spin mr-2" /> Enviando...</> : <><Send className="size-4 mr-2" /> Enviar WhatsApp de prueba</>}
          </Button>

          {!configured && (
            <p className="text-xs text-center text-amber-600">
              Sin credenciales Twilio el envío fallará. Configura las variables de entorno primero.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Automatic triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[#1A3328]">Cuándo se envían notificaciones automáticas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              ['📋', 'Cuando un proyecto cambia de estado en la DOM'],
              ['⚠️', 'Cuando la DOM emite observaciones'],
              ['✅', 'Cuando el permiso es aprobado'],
              ['🏠', 'Cuando la recepción final es aprobada'],
              ['⏰', 'Cuando el cron diario detecta cambios de estado'],
            ].map(([icon, text]) => (
              <li key={text as string} className="flex gap-2">
                <span>{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
