import { notFound } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calculator,
  ChevronRight,
  Clock,
  ExternalLink,
  FolderOpen,
  Globe,
  Info,
  Lightbulb,
  MapPin,
  TrendingUp,
} from "lucide-react"

import { COMUNAS_CHILE } from "@/lib/comunas-chile"
import { getInteligenciaMunicipio } from "@/lib/inteligencia-dom"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────
// Static generation
// ──────────────────────────────────────────────────
export function generateStaticParams() {
  return COMUNAS_CHILE.map((c) => ({ id: c.id }))
}

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const DOM_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  dom_en_linea: { label: "DOM en Línea", color: "bg-green-100 text-green-700" },
  probable:     { label: "Próximamente en línea", color: "bg-blue-100 text-blue-700" },
  presencial:   { label: "Presencial", color: "bg-gray-100 text-gray-600" },
}

const NIVEL_CONFIG = {
  danger:  { className: "bg-red-50 border-red-200 text-red-800",    iconClass: "text-red-500" },
  warning: { className: "bg-amber-50 border-amber-200 text-amber-800", iconClass: "text-amber-500" },
  info:    { className: "bg-blue-50 border-blue-200 text-blue-800",  iconClass: "text-blue-500" },
} as const

// ──────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────
export default function MunicipioDetallePage({
  params,
}: {
  params: { id: string }
}) {
  const comuna = COMUNAS_CHILE.find((c) => c.id === params.id)
  if (!comuna) notFound()

  const intel = getInteligenciaMunicipio(comuna.nombre)
  const badge = DOM_STATUS_BADGE[comuna.domStatus]

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="border-b border-border bg-white px-6 py-5">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/municipios" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="size-3.5" />
            Municipios
          </Link>
          <ChevronRight className="size-3 text-muted-foreground/30" />
          <span className="text-xs text-primary font-medium">{comuna.nombre}</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/8">
                <MapPin className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-primary">{comuna.nombre}</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">{comuna.region} · {comuna.provincia}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", badge.color)}>
              {badge.label}
            </span>
            {comuna.urlDom && (
              <a
                href={comuna.urlDom}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-primary hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <Globe className="size-3.5" />
                Abrir DOM en Línea
                <ExternalLink className="size-3" />
              </a>
            )}
            <Link
              href={`/herramientas/calculadora?municipio=${encodeURIComponent(comuna.nombre)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-primary hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <Calculator className="size-3.5" />
              Calcular derechos
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-5 max-w-4xl">

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Ver proyectos",    Icon: FolderOpen,  href: `/proyectos?municipio=${encodeURIComponent(comuna.nombre)}` },
            { label: "Calcular derechos", Icon: Calculator, href: `/herramientas/calculadora?municipio=${encodeURIComponent(comuna.nombre)}` },
            { label: "Formularios MINVU", Icon: BookOpen,   href: "/herramientas/formularios-minvu" },
            { label: "Anticipa obs.",     Icon: TrendingUp, href: `/herramientas/predictor?municipio=${encodeURIComponent(comuna.nombre)}` },
          ].map(({ label, Icon, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-3 text-[11.5px] font-medium text-primary hover:border-primary/20 hover:bg-[#F9F7F3] transition-all group"
            >
              <Icon className="size-3.5 text-primary/50 group-hover:text-primary transition-colors shrink-0" />
              {label}
            </Link>
          ))}
        </div>

        {/* Inteligencia DOM */}
        {intel ? (
          <>
            {/* KPIs */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="size-3.5 text-muted-foreground" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Inteligencia DOM · {intel.totalExpedientesBase.toLocaleString("es-CL")} expedientes analizados
                </p>
                <span className="ml-auto text-[10px] text-muted-foreground/40">Actualizado {intel.ultimaActualizacion}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Con observaciones",   value: `${intel.tasaObservaciones}%`, color: intel.tasaObservaciones > 55 ? "text-rose-600" : "text-amber-600" },
                  { label: "Obs. promedio",        value: intel.promedioObservaciones.toFixed(1), color: "text-primary" },
                  { label: "Primera respuesta",    value: `${intel.tiempoRespuestaPromedio}d`, color: "text-blue-600" },
                  { label: "Tiempo aprobación",    value: `${intel.tiempoAprobacionPromedio}d`, color: "text-primary" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-border bg-white p-4 text-center">
                    <p className={cn("text-2xl font-semibold tabular-nums", color)}>{value}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Observaciones frecuentes */}
            <div className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="size-3.5 text-primary/60" />
                <p className="text-xs font-semibold text-primary">Observaciones más frecuentes</p>
              </div>
              <div className="space-y-4">
                {intel.observacionesFrecuentes.map((obs) => (
                  <div key={obs.tipo} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-medium text-primary truncate">{obs.tipo}</p>
                        {obs.articuloOguc && (
                          <p className="text-[10px] text-muted-foreground/60">{obs.articuloOguc}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-primary/70 tabular-nums">{obs.porcentaje}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0EBE1]">
                      <div
                        className="h-full rounded-full bg-primary/50 transition-all"
                        style={{ width: `${obs.porcentaje}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] text-muted-foreground/70 leading-snug">{obs.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertas */}
            {intel.alertas.length > 0 && (
              <div className="space-y-2">
                {intel.alertas.map((alerta, i) => {
                  const cfg = NIVEL_CONFIG[alerta.nivel]
                  return (
                    <div key={i} className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3", cfg.className)}>
                      <AlertTriangle className={cn("size-4 shrink-0 mt-0.5", cfg.iconClass)} />
                      <p className="text-[12px] leading-relaxed">{alerta.texto}</p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Consejos */}
            {intel.consejos.length > 0 && (
              <div className="rounded-xl border border-border bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="size-3.5 text-amber-500" />
                  <p className="text-xs font-semibold text-primary">Consejos prácticos para {comuna.nombre}</p>
                </div>
                <ul className="space-y-2">
                  {intel.consejos.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <p className="text-[12px] text-muted-foreground leading-relaxed">{c}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* PRC */}
            {intel.planRegulador && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <BookOpen className="size-3.5 text-indigo-600" />
                    <p className="text-xs font-semibold text-indigo-900">Plan Regulador Comunal (PRC)</p>
                  </div>
                  <a
                    href={intel.planRegulador.urlPRC}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    <ExternalLink className="size-3" />
                    Ver PRC oficial
                    {intel.planRegulador.ultimaModificacion && ` (${intel.planRegulador.ultimaModificacion})`}
                  </a>
                </div>

                {intel.planRegulador.notaGeneral && (
                  <p className="text-[11.5px] text-indigo-800 leading-relaxed">{intel.planRegulador.notaGeneral}</p>
                )}

                {/* Zonas típicas */}
                {intel.planRegulador.zonasTipicas && intel.planRegulador.zonasTipicas.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
                      <p className="text-[11px] font-semibold text-amber-800">
                        Zonas Típicas declaradas — requieren visación CMN
                      </p>
                    </div>
                    <ul className="space-y-1">
                      {intel.planRegulador.zonasTipicas.map((z) => (
                        <li key={z} className="text-[11px] text-amber-700">· {z}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Seccionales */}
                {intel.planRegulador.seccionales && intel.planRegulador.seccionales.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600/70 mb-2">
                      Seccionales y zonas
                    </p>
                    <div className="space-y-2">
                      {intel.planRegulador.seccionales.map((sec) => (
                        <div key={sec.codigo} className="rounded-lg border border-indigo-100 bg-white p-3.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700 mr-1.5">
                                {sec.codigo}
                              </span>
                              <span className="text-[12px] font-semibold text-primary">{sec.nombre}</span>
                            </div>
                            {sec.urlPlano && (
                              <a
                                href={sec.urlPlano}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                              >
                                Ver plano
                                <ExternalLink className="size-2.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">{sec.descripcion}</p>
                          {sec.notaPatrimonio && (
                            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2">
                              <AlertTriangle className="size-3 text-amber-500 shrink-0 mt-0.5" />
                              <p className="text-[10.5px] text-amber-700 leading-snug">{sec.notaPatrimonio}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* No intel — placeholder */
          <div className="rounded-xl border border-border bg-white p-8 text-center">
            <BarChart3 className="mx-auto size-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-primary">Sin datos de inteligencia DOM aún</p>
            <p className="mt-1 text-xs text-muted-foreground/70 max-w-sm mx-auto leading-relaxed">
              {comuna.nombre} aún no tiene datos de observaciones sistematizados.
              A medida que se ingresen proyectos en este municipio, los datos se actualizarán automáticamente.
            </p>
            <div className="mt-4">
              <Link
                href={`/proyectos/nuevo?municipio=${encodeURIComponent(comuna.nombre)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Crear primer proyecto en {comuna.nombre}
              </Link>
            </div>
          </div>
        )}

        {/* Timing info */}
        <div className="rounded-xl border border-border bg-[#F9F7F3] px-5 py-4">
          <div className="flex items-start gap-2.5">
            <Clock className="size-4 text-muted-foreground/50 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11.5px] font-semibold text-primary">Plazos Ley 21.718</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Toda DOM tiene plazo máximo de <strong>30 días hábiles</strong> para responder desde el ingreso del expediente.
                Si no responde, aplica silencio administrativo positivo.
                Usa el{" "}
                <Link href="/herramientas/timeline" className="font-semibold text-primary hover:underline">
                  calculador de plazos →
                </Link>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
