"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Briefcase,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  StickyNote,
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
import { MOCK_PROSPECTOS } from "@/lib/mock-data"
import {
  ETAPA_CRM_CONFIG,
  FUENTE_LABELS,
  TIPO_ACTIVIDAD_LABELS,
  type EtapaCRM,
  type TipoActividad,
} from "@/types"
import { cn } from "@/lib/utils"

const PIPELINE_ETAPAS: EtapaCRM[] = [
  "nuevo_contacto",
  "contactado",
  "reunion_agendada",
  "propuesta_enviada",
  "negociando",
]

const TIPO_ICONS: Record<TipoActividad, typeof Mail> = {
  email: Mail,
  llamada: Phone,
  reunion: Users,
  whatsapp: MessageCircle,
  linkedin: Briefcase,
  nota: StickyNote,
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

const TODAY = new Date("2026-06-19T00:00:00")

function daysUntil(value?: string) {
  if (!value) return null
  const target = new Date(`${value}T00:00:00`)
  return Math.round((target.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))
}

function proximoColor(value?: string) {
  const d = daysUntil(value)
  if (d === null) return "text-muted-foreground"
  if (d <= 0) return "text-red-600"
  if (d <= 7) return "text-amber-600"
  return "text-[#1A3328]"
}

export default function ProspectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const prospecto = MOCK_PROSPECTOS.find((p) => p.id === id)

  const [etapa, setEtapa] = useState<EtapaCRM>(
    prospecto?.etapa ?? "nuevo_contacto"
  )
  const [notas, setNotas] = useState(prospecto?.notas ?? "")
  const [showActForm, setShowActForm] = useState(false)
  const [actTipo, setActTipo] = useState<TipoActividad>("email")
  const [actDesc, setActDesc] = useState("")
  const [actFecha, setActFecha] = useState("")
  const [actResultado, setActResultado] = useState("")

  if (!prospecto) {
    return (
      <div className="space-y-6">
        <Link
          href="/prospectos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[#1A3328]"
        >
          <ArrowLeft className="size-4" />
          Prospectos
        </Link>
        <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-muted-foreground shadow-sm">
          No se encontró el prospecto solicitado.
        </div>
      </div>
    )
  }

  const cfg = ETAPA_CRM_CONFIG[etapa]
  const actividades = [...(prospecto.actividades ?? [])].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )

  function guardarActividad() {
    console.log("Nueva actividad", {
      prospecto_id: prospecto?.id,
      tipo: actTipo,
      descripcion: actDesc,
      fecha: actFecha,
      resultado: actResultado,
    })
    setShowActForm(false)
    setActDesc("")
    setActFecha("")
    setActResultado("")
    setActTipo("email")
  }

  function marcarGanado() {
    if (window.confirm("¿Marcar este prospecto como Ganado?")) {
      setEtapa("ganado")
    }
  }

  function descartar() {
    if (window.confirm("¿Descartar este prospecto?")) {
      setEtapa("descartado")
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/prospectos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[#1A3328]"
      >
        <ArrowLeft className="size-4" />
        Prospectos
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,360px)]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
                {prospecto.empresa}
              </h1>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                  cfg.bg,
                  cfg.color
                )}
              >
                {cfg.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-[#1A3328]">
                {prospecto.contacto_nombre}
              </span>
              {prospecto.cargo ? <span>{prospecto.cargo}</span> : null}
              {prospecto.email ? (
                <a
                  href={`mailto:${prospecto.email}`}
                  className="inline-flex items-center gap-1.5 hover:text-[#1A3328]"
                >
                  <Mail className="size-3.5" />
                  {prospecto.email}
                </a>
              ) : null}
              {prospecto.telefono ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {prospecto.telefono}
                </span>
              ) : null}
              {prospecto.linkedin_url ? (
                <a
                  href={prospecto.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[#1A3328]"
                >
                  <Briefcase className="size-3.5" />
                  LinkedIn
                </a>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex rounded-full bg-[#F0EBE1] px-2 py-0.5 font-medium text-[#1A3328]">
                {FUENTE_LABELS[prospecto.fuente]}
              </span>
              <span>Creado el {formatDate(prospecto.created_at)}</span>
            </div>
          </div>

          {/* Etapa selector */}
          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-sm text-[#1A3328]">
                Etapa del pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {PIPELINE_ETAPAS.map((e) => {
                  const ecfg = ETAPA_CRM_CONFIG[e]
                  const active = etapa === e
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEtapa(e)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-[#1A3328] text-white"
                          : "bg-[#F9F7F3] text-[#1A3328]/70 hover:bg-[#F0EBE1]"
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          active ? "bg-white" : ecfg.dot
                        )}
                      />
                      {ecfg.label}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actividades */}
          <Card className="border-gray-100">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm text-[#1A3328]">
                Actividades
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#1A3328]"
                onClick={() => setShowActForm((v) => !v)}
              >
                <Plus className="size-4" />
                Agregar actividad
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showActForm ? (
                <div className="space-y-3 rounded-lg border border-gray-100 bg-[#F9F7F3] p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#1A3328]">
                        Tipo
                      </label>
                      <Select
                        value={actTipo}
                        onValueChange={(v) => setActTipo(v as TipoActividad)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(TIPO_ACTIVIDAD_LABELS) as TipoActividad[]
                          ).map((t) => (
                            <SelectItem key={t} value={t}>
                              {TIPO_ACTIVIDAD_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-[#1A3328]">
                        Fecha
                      </label>
                      <Input
                        type="date"
                        value={actFecha}
                        onChange={(e) => setActFecha(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#1A3328]">
                      Descripción
                    </label>
                    <Input
                      value={actDesc}
                      onChange={(e) => setActDesc(e.target.value)}
                      placeholder="¿Qué ocurrió?"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#1A3328]">
                      Resultado
                    </label>
                    <Input
                      value={actResultado}
                      onChange={(e) => setActResultado(e.target.value)}
                      placeholder="Resultado o próximos pasos"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowActForm(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
                      onClick={guardarActividad}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : null}

              {actividades.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay actividades registradas.
                </p>
              ) : (
                <ul className="space-y-4">
                  {actividades.map((a) => {
                    const Icon = TIPO_ICONS[a.tipo]
                    return (
                      <li key={a.id} className="flex gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#F0EBE1] text-[#1A3328]">
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium text-[#1A3328]">
                              {TIPO_ACTIVIDAD_LABELS[a.tipo]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(a.fecha)}
                            </span>
                          </div>
                          <p className="text-sm text-[#1A3328]">
                            {a.descripcion}
                          </p>
                          {a.resultado ? (
                            <p className="text-xs text-muted-foreground">
                              Resultado: {a.resultado}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Info card */}
          <Card className="border-gray-100">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm text-[#1A3328]">
                Información
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-[#1A3328]">
                <Pencil className="size-3.5" />
                Editar
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Valor estimado</p>
                <p className="font-medium text-[#1A3328]">
                  {prospecto.valor_estimado
                    ? formatCurrency(prospecto.valor_estimado)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Municipios de interés
                </p>
                {prospecto.municipios_interes?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {prospecto.municipios_interes.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1 rounded-full bg-[#F0EBE1] px-2 py-0.5 text-xs font-medium text-[#1A3328]"
                      >
                        <MapPin className="size-3" />
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="font-medium text-[#1A3328]">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fuente</p>
                <p className="font-medium text-[#1A3328]">
                  {FUENTE_LABELS[prospecto.fuente]}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Próximo contacto</p>
                <p
                  className={cn(
                    "font-medium",
                    proximoColor(prospecto.proximo_contacto)
                  )}
                >
                  {formatDate(prospecto.proximo_contacto)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-sm text-[#1A3328]">Notas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Notas internas sobre el prospecto..."
                className="min-h-28"
              />
              <Button
                size="sm"
                className="w-full bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
                onClick={() => console.log("Guardar notas", notas)}
              >
                Guardar notas
              </Button>
            </CardContent>
          </Card>

          {/* Acciones rápidas */}
          <Card className="border-gray-100">
            <CardHeader>
              <CardTitle className="text-sm text-[#1A3328]">
                Acciones rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                size="sm"
                className="w-full bg-green-600 text-white hover:bg-green-700"
                onClick={marcarGanado}
                disabled={etapa === "ganado"}
              >
                Marcar como Ganado
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={descartar}
                disabled={etapa === "descartado"}
              >
                Descartar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
