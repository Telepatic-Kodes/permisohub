"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Info,
  Lightbulb,
  Mail,
  MapPin,
  Phone,
  Search,
  TrendingUp,
} from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import {
  COMUNAS_CHILE,
  REGIONES_CHILE,
  getCoverageStats,
  type ComunaChile,
  type DomStatus,
} from "@/lib/comunas-chile"
import { getInteligenciaMunicipio, type InteligenciaMunicipio, type PlanReguladorInfo } from "@/lib/inteligencia-dom"
import { MUNICIPIOS_INFO as MOCK_MUNICIPIOS, type MunicipioInfo } from "@/lib/municipios-referencia"
import { cn } from "@/lib/utils"

const DOM_EN_LINEA_URL = "https://domenlinea.minvu.cl"

type StatusFilter = "todas" | "dom_en_linea" | "presencial"

function InteligenciaDOMSection({ data }: { data: InteligenciaMunicipio }) {
  const NIVEL_CONFIG = {
    danger: { color: "var(--state-error)", Icon: AlertTriangle },
    warning: { color: "var(--state-warn)", Icon: AlertTriangle },
    info: { color: "var(--blueprint)", Icon: Info },
  } as const

  return (
    <div className="mt-3 rounded-[4px] border border-line-med bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 border-b border-line-fine pb-2">
        <BarChart3 className="size-3.5 text-muted-foreground" />
        <p className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Inteligencia DOM</p>
        <span className="num ml-auto text-[10px] text-muted-foreground/60">Act. {data.ultimaActualizacion}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-line-fine rounded-[3px] border border-line-fine">
        <div className="px-2.5 py-2.5">
          <p className="num text-lg font-semibold leading-none text-primary">{data.tasaObservaciones}%</p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-1">proyectos con observaciones</p>
        </div>
        <div className="px-2.5 py-2.5">
          <p className="num text-lg font-semibold leading-none text-primary">{data.tiempoRespuestaPromedio}d</p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-1">días hábiles primera respuesta</p>
        </div>
        <div className="px-2.5 py-2.5">
          <p className="num text-lg font-semibold leading-none text-primary">{data.promedioObservaciones}</p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-1">obs promedio por expediente</p>
        </div>
      </div>

      {/* Top observations */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="size-3.5 text-muted-foreground" />
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Observaciones más frecuentes</p>
        </div>
        <div className="space-y-2">
          {data.observacionesFrecuentes.slice(0, 5).map((obs) => (
            <div key={obs.tipo} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-primary truncate">{obs.tipo}</p>
                <span className="num shrink-0 text-[10px] font-semibold text-muted-foreground">{obs.porcentaje}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-[var(--blueprint)]/40 transition-all"
                  style={{ width: `${obs.porcentaje}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-tight">{obs.descripcion}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas */}
      {data.alertas.length > 0 && (
        <div className="space-y-1.5">
          {data.alertas.map((alerta, i) => {
            const cfg = NIVEL_CONFIG[alerta.nivel]
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-[3px] border border-line-fine px-3 py-2"
                style={{ background: `color-mix(in oklch, ${cfg.color} 8%, transparent)` }}
              >
                <cfg.Icon className="size-3.5 shrink-0 mt-0.5" style={{ color: cfg.color }} />
                <p className="text-[11px] leading-snug text-foreground/80">{alerta.texto}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Consejos */}
      {data.consejos.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb className="size-3.5 text-muted-foreground" />
            <p className="font-technical text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">Consejos para este municipio</p>
          </div>
          <ul className="space-y-1">
            {data.consejos.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--blueprint)]/50" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Plan Regulador Comunal */}
      {data.planRegulador && <PlanReguladorSection prc={data.planRegulador} />}

      <p className="text-[9px] text-muted-foreground/50 text-right">
        Base: <span className="num">{data.totalExpedientesBase}</span> expedientes históricos · Datos sintéticos beta
      </p>
    </div>
  )
}

function PlanReguladorSection({ prc }: { prc: PlanReguladorInfo }) {
  const [expandido, setExpandido] = useState(false)
  return (
    <div className="rounded-[3px] border border-line-med bg-[var(--blueprint)]/[0.03] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="size-3.5 text-muted-foreground shrink-0" />
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Plan Regulador Comunal (PRC)
          </p>
        </div>
        <a
          href={prc.urlPRC}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-[var(--blueprint)] shrink-0"
        >
          Ver PRC <ExternalLink className="size-3" />
        </a>
      </div>

      {prc.notaGeneral && (
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">{prc.notaGeneral}</p>
      )}

      {/* Zonas típicas — estado: requieren CMN (warning) */}
      {prc.zonasTipicas && prc.zonasTipicas.length > 0 && (
        <div
          className="rounded-[3px] border border-line-fine p-2"
          style={{ background: "color-mix(in oklch, var(--state-warn) 8%, transparent)" }}
        >
          <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--state-warn)" }}>
            Zonas de Conservación Histórica (requieren CMN)
          </p>
          <ul className="space-y-0.5">
            {prc.zonasTipicas.map((z) => (
              <li key={z} className="flex items-start gap-1.5 text-[10px] text-foreground/75">
                <span className="mt-1.5 size-1 shrink-0 rounded-full" style={{ background: "var(--state-warn)" }} />
                {z}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Seccionales */}
      {prc.seccionales && prc.seccionales.length > 0 && (
        <div>
          <button
            onClick={() => setExpandido(!expandido)}
            className="text-[10px] font-semibold text-muted-foreground hover:text-[var(--blueprint)] flex items-center gap-1"
          >
            <ChevronDown className={cn("size-3 transition-transform", expandido && "rotate-180")} />
            {expandido ? "Ocultar" : "Ver"} seccionales por barrio (<span className="num">{prc.seccionales.length}</span>)
          </button>
          {expandido && (
            <div className="mt-2 space-y-2">
              {prc.seccionales.map((sec) => (
                <div key={sec.codigo} className="rounded-[3px] bg-card border border-line-fine p-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-technical text-[11px] font-semibold text-primary">
                      <span className="num">{sec.codigo}</span> — {sec.nombre}
                    </p>
                    {sec.urlPlano && (
                      <a
                        href={sec.urlPlano}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[9.5px] font-medium text-muted-foreground hover:text-[var(--blueprint)] flex items-center gap-0.5"
                      >
                        Plano <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[10.5px] text-muted-foreground leading-snug">{sec.descripcion}</p>
                  {sec.notaPatrimonio && (
                    <div className="flex items-start gap-1.5 mt-1">
                      <AlertTriangle className="size-3 shrink-0 mt-0.5" style={{ color: "var(--state-warn)" }} />
                      <p className="text-[10px] leading-snug" style={{ color: "var(--state-warn)" }}>{sec.notaPatrimonio}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const STATE_DOT: Record<"ok" | "warn" | "neutro", string> = {
  ok: "var(--state-ok)",
  warn: "var(--state-warn)",
  neutro: "var(--muted-foreground)",
}

const STATUS_BADGE: Record<DomStatus, { label: string; state: "ok" | "warn" | "neutro" }> = {
  dom_en_linea: { label: "DOM en Línea", state: "ok" },
  probable: { label: "Probable", state: "warn" },
  presencial: { label: "Presencial", state: "neutro" },
}

function findMockInfo(comuna: ComunaChile): MunicipioInfo | undefined {
  return MOCK_MUNICIPIOS.find(
    (m) => m.nombre.toLowerCase() === comuna.nombre.toLowerCase()
  )
}

export default function MunicipiosPage() {
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState("")
  const [status, setStatus] = useState<StatusFilter>("todas")
  const [expanded, setExpanded] = useState<string | null>(null)

  const stats = useMemo(() => getCoverageStats(), [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return COMUNAS_CHILE.filter((c) => {
      if (q && !c.nombre.toLowerCase().includes(q)) return false
      if (region && c.region !== region) return false
      if (status === "dom_en_linea" && c.domStatus !== "dom_en_linea") return false
      if (status === "presencial" && c.domStatus !== "presencial") return false
      return true
    })
  }, [search, region, status])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📍"
        title="Municipios"
        subtitle="Cobertura DOM en Línea por comuna · base de conocimiento normativo"
        toolbar={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar comuna..."
                className="pl-9"
              />
            </div>

            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-9 rounded-lg border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <option value="">Todas las regiones</option>
              {REGIONES_CHILE.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-lg border border-input bg-card p-0.5 shadow-sm">
              {(
                [
                  { key: "todas", label: "Todas" },
                  { key: "dom_en_linea", label: "DOM en Línea" },
                  { key: "presencial", label: "Presencial" },
                ] as { key: StatusFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setStatus(opt.key)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                    status === opt.key
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          {/* Cabecera de cobertura — cuadro técnico */}
          <div className="rounded-[4px] border border-line-med bg-card">
            <div className="flex items-center gap-3 border-b border-line-fine px-4 py-2.5">
              <h2 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Cobertura DOM en Línea
              </h2>
              <div className="h-px flex-1 bg-line-fine" />
              <span className="num text-[10px] tracking-wide text-muted-foreground/60">
                MINVU · Sep 2023
              </span>
            </div>
            <div className="grid grid-cols-1 divide-y divide-line-fine sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-4 py-3">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  En DOM en Línea
                </p>
                <p className="num flex items-baseline gap-1 text-xl font-semibold leading-none text-primary">
                  210 <span className="text-xs font-medium text-muted-foreground">comunas</span>
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Cobertura nacional
                </p>
                <p className="num flex items-baseline gap-1 text-xl font-semibold leading-none text-primary">
                  {stats.pctCoverage}<span className="text-xs font-medium text-muted-foreground">% del país</span>
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Chile total
                </p>
                <p className="num flex items-baseline gap-1 text-xl font-semibold leading-none text-muted-foreground">
                  345 <span className="text-xs font-medium text-muted-foreground">comunas</span>
                </p>
              </div>
            </div>
          </div>

          {/* Result count */}
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Mostrando <span className="num tracking-normal text-primary">{filtered.length}</span> de{" "}
            <span className="num tracking-normal text-primary">{COMUNAS_CHILE.length}</span> comunas
          </p>

          {/* List */}
          <div className="divide-y divide-line-fine overflow-hidden rounded-[4px] border border-line-med bg-card">
        {filtered.map((comuna) => {
          const isOpen = expanded === comuna.id
          const badge = STATUS_BADGE[comuna.domStatus]
          const info = findMockInfo(comuna)
          return (
            <div key={comuna.id}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : comuna.id)}
                className={cn(
                  "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--blueprint)]/[0.05]",
                  isOpen && "bg-[var(--blueprint)]/[0.05]"
                )}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-technical block truncate font-semibold text-primary">
                    {comuna.nombre}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {comuna.region}
                  </span>
                </div>

                <span className="num inline-flex shrink-0 items-center gap-1.5 rounded-[3px] border border-line-med px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: STATE_DOT[badge.state] }} />
                  {badge.label}
                </span>

                {comuna.urlDom && (
                  <a
                    href={comuna.urlDom}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-[var(--blueprint)]"
                    aria-label={`Abrir plataforma DOM de ${comuna.nombre}`}
                  >
                    <Globe className="size-4" />
                  </a>
                )}

                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-[var(--blueprint)]",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              {isOpen && (
                <div className="border-t border-line-fine bg-[var(--blueprint)]/[0.03] px-4 pt-3 pb-4">
                  {(() => {
                    const inteligencia = getInteligenciaMunicipio(comuna.nombre)
                    return inteligencia ? <InteligenciaDOMSection data={inteligencia} /> : null
                  })()}
                  {info ? (
                    <div className="space-y-3 mt-3">
                      <div className="grid gap-1.5 text-sm text-muted-foreground">
                        {info.dom_telefono && (
                          <span className="flex items-center gap-2">
                            <Phone className="size-4" />
                            {info.dom_telefono}
                          </span>
                        )}
                        {info.dom_email && (
                          <span className="flex items-center gap-2">
                            <Mail className="size-4" />
                            {info.dom_email}
                          </span>
                        )}
                        {info.dom_horario && (
                          <span className="flex items-center gap-2">
                            <MapPin className="size-4" />
                            {info.dom_horario}
                          </span>
                        )}
                        {info.plazo_tipico_dias && (
                          <span className="flex items-center gap-2">
                            <Clock className="size-4" />
                            Plazo típico: <span className="num text-foreground/80">{info.plazo_tipico_dias}</span> días
                          </span>
                        )}
                      </div>

                      {info.requisitos.length > 0 && (
                        <div>
                          <p className="font-technical mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                            Requisitos
                          </p>
                          <ul className="space-y-1.5">
                            {info.requisitos.map((r) => (
                              <li
                                key={r.nombre}
                                className="flex items-start gap-2 text-sm text-muted-foreground"
                              >
                                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--blueprint)]/50" />
                                <span>
                                  {r.nombre}
                                  {!r.obligatorio && (
                                    <span className="ml-1 text-xs italic">
                                      (si aplica)
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Info detallada próximamente. Consulta domenlinea.minvu.cl
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <Link
                      href={`/municipios/${comuna.id}`}
                      className="inline-flex items-center gap-1.5 rounded-[4px] bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
                    >
                      Ver ficha completa + PRC
                      <ChevronRight className="size-3" />
                    </Link>
                    {comuna.domStatus === "dom_en_linea" && (
                      <a
                        href={comuna.urlDom ?? DOM_EN_LINEA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-[var(--blueprint)] transition-colors"
                      >
                        Ir a domenlinea.minvu.cl
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No se encontraron comunas con los filtros seleccionados.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
