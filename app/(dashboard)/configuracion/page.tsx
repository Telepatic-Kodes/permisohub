"use client"

import { useEffect, useState, type ReactNode } from "react"
import { ArrowRight, CreditCard, MessageCircle, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const BRAND = "bg-primary text-white hover:bg-primary/90"

// ---------------------------------------------------------------------------
// Toggle (checkbox styled as a switch)
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-primary">
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <span className="relative inline-flex shrink-0 pt-1">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            "h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary"
          )}
        />
        <span
          aria-hidden
          className={cn(
            "absolute top-1.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-5"
          )}
        />
      </span>
    </label>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-[4px] border border-line-med bg-card">
      <div className="flex items-center gap-3 border-b border-line-fine px-5 py-3">
        <span
          className="inline-block size-2 border border-[var(--blueprint)]"
          style={{ borderRightWidth: 0, borderBottomWidth: 0 }}
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="font-technical text-[13px] font-semibold leading-tight text-primary">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Test notification payloads
// ---------------------------------------------------------------------------

type TestTipo = "observacion" | "estado_change" | "deadline" | "resumen"

function buildTestPayload(tipo: TestTipo, email: string) {
  const base = { to: email, clienteNombre: "Cliente de prueba" }
  switch (tipo) {
    case "observacion":
      return {
        type: "observacion",
        ...base,
        proyectoNombre: "Edificio Las Acacias",
        municipio: "Las Condes",
        expediente: "DOM-2026-00457",
        descripcionObservacion:
          "Falta certificado de informaciones previas actualizado y corrección del cuadro de superficies.",
        plazoRespuesta: "30 días hábiles",
      }
    case "estado_change":
      return {
        type: "estado_change",
        ...base,
        proyectoNombre: "Edificio Las Acacias",
        estadoAnterior: "Ingresado",
        estadoNuevo: "En revisión",
        descripcion: "El expediente fue derivado al revisor de la DOM.",
      }
    case "deadline":
      return {
        type: "deadline",
        ...base,
        proyectoNombre: "Edificio Las Acacias",
        municipio: "Las Condes",
        diasRestantes: 5,
        fechaEstimada: "24 de junio de 2026",
      }
    case "resumen":
      return {
        type: "resumen",
        ...base,
        proyectos: [
          {
            nombre: "Edificio Las Acacias",
            municipio: "Las Condes",
            estado: "En revisión",
            etapa: "Permiso de edificación",
            fechaEstimada: "24 de junio de 2026",
            tieneAlerta: true,
          },
          {
            nombre: "Casa Quillota",
            municipio: "Quillota",
            estado: "Aprobado",
            etapa: "Recepción final",
            fechaEstimada: "10 de julio de 2026",
          },
        ],
      }
  }
}

const TEST_TIPO_LABEL: Record<TestTipo, string> = {
  observacion: "Observación DOM",
  estado_change: "Cambio de estado",
  deadline: "Vencimiento próximo",
  resumen: "Resumen semanal",
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConfiguracionPage() {
  // 0. Perfil
  const [perfilNombre, setPerfilNombre] = useState("")
  const [perfilEspecialidad, setPerfilEspecialidad] = useState("")
  const [perfilMunicipio, setPerfilMunicipio] = useState("")
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  // 1. Notificaciones por email (preferencias internas)
  const [observacionesDom, setObservacionesDom] = useState(true)
  const [vencimientoPlazo, setVencimientoPlazo] = useState(true)
  const [cambioEstado, setCambioEstado] = useState(true)
  const [resumenSemanal, setResumenSemanal] = useState(false)
  const [emailNotificaciones, setEmailNotificaciones] = useState("")

  // 2. Notificaciones a clientes
  const [notificarClientes, setNotificarClientes] = useState(true)
  const [emailRemitente, setEmailRemitente] = useState(
    "notificaciones@permisohub.cl"
  )

  // 3. Notificación de prueba
  const [testTipo, setTestTipo] = useState<TestTipo>("observacion")
  const [testEmail, setTestEmail] = useState("")
  const [sending, setSending] = useState(false)

  useEffect(() => {
    fetch('/api/configuracion/perfil')
      .then((r) => r.json())
      .then((d: { perfil?: { nombre?: string; especialidad?: string; municipio_principal?: string; email_notificaciones?: string }; email?: string }) => {
        if (d.perfil) {
          setPerfilNombre(d.perfil.nombre ?? "")
          setPerfilEspecialidad(d.perfil.especialidad ?? "")
          setPerfilMunicipio(d.perfil.municipio_principal ?? "")
          if (d.perfil.email_notificaciones) setEmailNotificaciones(d.perfil.email_notificaciones)
        }
        if (!emailNotificaciones && d.email) setEmailNotificaciones(d.email)
      })
      .catch(() => undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGuardarPerfil() {
    setGuardandoPerfil(true)
    try {
      await fetch('/api/configuracion/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: perfilNombre.trim(),
          especialidad: perfilEspecialidad.trim(),
          municipio_principal: perfilMunicipio.trim(),
        }),
      })
      toast.success("Perfil actualizado")
    } catch {
      toast.error("No se pudo guardar el perfil")
    } finally {
      setGuardandoPerfil(false)
    }
  }

  function handleGuardarPreferencias() {
    fetch('/api/configuracion/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observaciones_dom: observacionesDom,
        vencimiento_plazo: vencimientoPlazo,
        cambio_estado: cambioEstado,
        resumen_semanal: resumenSemanal,
        email_notificaciones: emailNotificaciones,
      }),
    }).catch(() => undefined)
    toast.success("Preferencias guardadas", {
      description: "Los cambios se aplicarán a las próximas notificaciones.",
    })
  }

  function handleGuardarClientes() {
    fetch('/api/configuracion/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificar_clientes: notificarClientes,
        email_remitente: emailRemitente,
      }),
    }).catch(() => undefined)
    toast.success("Configuración de clientes guardada")
  }

  async function handleEnviarPrueba() {
    if (!testEmail) {
      toast.error("Ingresa un email de destino")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTestPayload(testTipo, testEmail)),
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
      }

      if (res.ok && data.success) {
        toast.success("Notificación de prueba enviada", {
          description: `Tipo: ${TEST_TIPO_LABEL[testTipo]} → ${testEmail}`,
        })
      } else {
        toast.error("No se pudo enviar la notificación", {
          description: data.error ?? "Error desconocido",
        })
      }
    } catch (err) {
      toast.error("Error de red al enviar la notificación", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader emoji="⚙️" title="Configuración" />
      <div className="flex-1 space-y-6 overflow-auto p-8">

      {/* 0. Perfil */}
      <SectionCard title="Información personal">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nombre completo</Label>
            <Input
              value={perfilNombre}
              onChange={(e) => setPerfilNombre(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Especialidad</Label>
            <Input
              value={perfilEspecialidad}
              onChange={(e) => setPerfilEspecialidad(e.target.value)}
              placeholder="Ej: Arquitectura residencial"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Municipio principal</Label>
            <Input
              value={perfilMunicipio}
              onChange={(e) => setPerfilMunicipio(e.target.value)}
              placeholder="Ej: Providencia"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button className={BRAND} onClick={handleGuardarPerfil} disabled={guardandoPerfil}>
            {guardandoPerfil ? "Guardando…" : "Guardar perfil"}
          </Button>
        </div>
      </SectionCard>

      {/* 1. Notificaciones por email */}
      <SectionCard title="Notificaciones automáticas">
        <div className="divide-y divide-border">
          <Toggle
            checked={observacionesDom}
            onCheckedChange={setObservacionesDom}
            label="Observaciones DOM"
            description="Alerta inmediata cuando la DOM emite una observación."
          />
          <Toggle
            checked={vencimientoPlazo}
            onCheckedChange={setVencimientoPlazo}
            label="Vencimiento de plazo"
            description="7 días antes de la fecha estimada."
          />
          <Toggle
            checked={cambioEstado}
            onCheckedChange={setCambioEstado}
            label="Cambio de estado"
            description="Cuando un proyecto avanza de etapa."
          />
          <Toggle
            checked={resumenSemanal}
            onCheckedChange={setResumenSemanal}
            label="Resumen semanal"
            description="Todos los lunes a las 9:00 AM."
          />
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="email-notificaciones">Email de notificaciones</Label>
          <Input
            id="email-notificaciones"
            type="email"
            value={emailNotificaciones}
            onChange={(e) => setEmailNotificaciones(e.target.value)}
            placeholder="correo@empresa.cl"
            className="max-w-sm"
          />
        </div>

        <div className="mt-6">
          <Button className={BRAND} onClick={handleGuardarPreferencias}>
            Guardar preferencias
          </Button>
        </div>
      </SectionCard>

      {/* Automatización */}
      <SectionCard
        title="Automatización"
        description="Tareas automáticas programadas vía Vercel Cron"
      >
        <div className="space-y-4">
          {/* Cron jobs status */}
          <div className="divide-y divide-line-fine rounded-[3px] border border-line-fine">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-primary">
                  Revisión diaria de vencimientos
                </p>
                <p className="text-xs text-muted-foreground">
                  Lunes a Viernes · <span className="num">8:00 AM</span> Santiago
                </p>
              </div>
              <span className="num inline-flex items-center gap-1.5 rounded-[3px] border border-line-med px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ background: "var(--state-ok)" }} />
                Activo
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-primary">Resumen semanal</p>
                <p className="text-xs text-muted-foreground">
                  Lunes · <span className="num">9:00 AM</span> Santiago
                </p>
              </div>
              <span className="num inline-flex items-center gap-1.5 rounded-[3px] border border-line-med px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ background: "var(--state-ok)" }} />
                Activo
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-primary">Scraper DOM en Línea</p>
                <p className="text-xs text-muted-foreground">
                  Con cada revisión diaria · <span className="num">110</span> municipios
                </p>
              </div>
              <span className="num inline-flex items-center gap-1.5 rounded-[3px] border border-line-med px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ background: "var(--blueprint)" }} />
                Beta
              </span>
            </div>
          </div>
          {/* Manual trigger */}
          <div>
            <p className="font-technical mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              Disparar manualmente
            </p>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const res = await fetch("/api/cron/daily-check")
                  const data = await res.json()
                  alert(
                    `Revisión completada: ${data.deadlineAlerts ?? 0} alertas enviadas`
                  )
                }}
                className="rounded-[4px] border border-line-med px-3 py-1.5 text-sm text-primary transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
              >
                Ejecutar revisión diaria ahora
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Los cron jobs requieren deploy en Vercel para funcionar
            automáticamente. Localmente, usa los botones manuales.
          </p>
        </div>
      </SectionCard>

      {/* 2. Notificaciones a clientes */}
      <SectionCard
        title="Notificaciones a clientes"
        description="Los clientes reciben alertas automáticas cuando su permiso tiene observaciones o cambios de estado."
      >
        <div className="divide-y divide-border">
          <Toggle
            checked={notificarClientes}
            onCheckedChange={setNotificarClientes}
            label="Activar notificaciones a clientes"
          />
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="email-remitente">Email remitente</Label>
          <Input
            id="email-remitente"
            type="email"
            value={emailRemitente}
            onChange={(e) => setEmailRemitente(e.target.value)}
            placeholder="notificaciones@permisohub.cl"
            className="max-w-sm"
          />
        </div>

        <div className="mt-6">
          <Button className={BRAND} onClick={handleGuardarClientes}>
            Guardar preferencias
          </Button>
        </div>
      </SectionCard>

      {/* 3. Enviar notificación de prueba */}
      <SectionCard
        title="Enviar notificación de prueba"
        description="Envía un correo de ejemplo para revisar cómo se ven las plantillas."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="test-tipo">Tipo de notificación</Label>
            <Select
              value={testTipo}
              onValueChange={(v) => setTestTipo(v as TestTipo)}
            >
              <SelectTrigger id="test-tipo">
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="observacion">Observación DOM</SelectItem>
                <SelectItem value="estado_change">Cambio de estado</SelectItem>
                <SelectItem value="deadline">Vencimiento próximo</SelectItem>
                <SelectItem value="resumen">Resumen semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-email">Email de destino</Label>
            <Input
              id="test-email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="destino@ejemplo.cl"
            />
          </div>
        </div>

        <div className="mt-6">
          <Button
            className={BRAND}
            onClick={handleEnviarPrueba}
            disabled={sending}
          >
            <Send className="size-4" />
            {sending ? "Enviando…" : "Enviar prueba"}
          </Button>
        </div>
      </SectionCard>

      {/* Facturación */}
      <SectionCard title="Facturación" description="Gestión de plan y métodos de pago.">
        <div className="flex items-center justify-between rounded-[3px] border border-line-fine p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-[3px] border border-line-med">
              <CreditCard className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-primary">Plan Starter</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="num">$29.990</span> CLP / mes · Próximo cobro <span className="num">21 jul</span>
              </p>
            </div>
          </div>
          <Link
            href="/configuracion/billing"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-med bg-card px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
          >
            Gestionar
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </SectionCard>

      {/* Integraciones */}
      <SectionCard title="Integraciones" description="Canales de comunicación con clientes.">
        <div className="flex items-center justify-between rounded-[3px] border border-line-fine p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-[3px] border border-line-med">
              <MessageCircle className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[13px] font-medium text-primary">WhatsApp Business</p>
              <p className="text-[11px] text-muted-foreground">Notificaciones automáticas vía Twilio</p>
            </div>
          </div>
          <Link
            href="/configuracion/whatsapp"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-line-med bg-card px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
          >
            Configurar
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </SectionCard>

      {/* 4. Cuenta y acceso */}
      <SectionCard title="Cuenta y acceso">
        <div className="grid gap-px overflow-hidden rounded-[3px] border border-line-fine bg-line-fine sm:grid-cols-3">
          <div className="flex flex-col gap-1 bg-card px-4 py-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Arquitecta responsable</span>
            <span className="font-medium text-primary">Estefanía Parada</span>
          </div>
          <div className="flex flex-col gap-1 bg-card px-4 py-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plan activo</span>
            <span className="font-medium text-primary">Starter · <span className="num">$29.990</span> CLP/mes</span>
          </div>
          <div className="flex flex-col gap-1 bg-card px-4 py-3">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace</span>
            <span className="font-medium text-primary">EP Gestión Arquitectónica</span>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Link href="/configuracion/equipo">
            <Button variant="outline" className="gap-1.5">
              Gestionar equipo
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/configuracion/billing">
            <Button variant="outline" className="gap-1.5">
              Facturación
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </SectionCard>
      </div>
    </div>
  )
}
