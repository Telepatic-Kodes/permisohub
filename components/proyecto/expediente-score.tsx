"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Rocket,
  Upload,
  XCircle,
} from "lucide-react"
import type { TipoPermiso, Documento } from "@/types"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────
// Required document definitions per permit type
// ──────────────────────────────────────────────────
interface DocRequerido {
  id: string
  nombre: string
  descripcion?: string
  vigencia?: string           // "180 días", "60 días"
  obligatorio: boolean
  tiposAplicables?: TipoPermiso[]
}

const DOCS_BASE: DocRequerido[] = [
  { id: "solicitud",         nombre: "Solicitud / formulario DOM",             descripcion: "Formulario oficial firmado por propietario y arquitecto.",          obligatorio: true },
  { id: "cip",               nombre: "Certificado de Informaciones Previas",    descripcion: "Vigencia máxima 180 días corridos al momento del ingreso.",         vigencia: "180 días", obligatorio: true },
  { id: "dominio",           nombre: "Certificado de dominio vigente",          descripcion: "No mayor a 60 días desde la emisión.",                              vigencia: "60 días",  obligatorio: true },
  { id: "planos_arq",        nombre: "Planos de arquitectura",                  descripcion: "Planta, corte y elevaciones escala 1:50 mínimo.",                    obligatorio: true },
  { id: "memoria_desc",      nombre: "Memoria descriptiva",                     descripcion: "Incluye cuadro de superficies, cuadro normativo y justificación.", obligatorio: true },
  { id: "planos_estr",       nombre: "Planos estructurales",                    descripcion: "Incluir fundaciones. Firmados por ingeniero estructural.",           obligatorio: true, tiposAplicables: ["permiso_edificacion", "ampliacion"] },
  { id: "memoria_calc",      nombre: "Memoria de cálculo estructural",          descripcion: "Firmada por ingeniero calculista con registro Minvu.",               obligatorio: true, tiposAplicables: ["permiso_edificacion", "ampliacion"] },
  { id: "instalaciones_el",  nombre: "Planos de instalaciones eléctricas",      descripcion: "Firmados por instalador autorizado SEC.",                            obligatorio: false },
  { id: "instalaciones_san", nombre: "Planos de instalaciones sanitarias",      descripcion: "Firmados por instalador autorizado SISS.",                           obligatorio: false },
  { id: "plano_empl",        nombre: "Plano de emplazamiento",                  descripcion: "Predio vecino, deslindes, rasantes y distanciamientos.",             obligatorio: true },
  { id: "dec_jurada",        nombre: "Declaración jurada del propietario",      descripcion: "Formato MINVU o equivalente municipal.",                             obligatorio: true,  tiposAplicables: ["obra_menor_sin_permiso", "obra_menor_con_permiso"] },
  { id: "presupuesto",       nombre: "Presupuesto estimado de la obra",         descripcion: "Con firma del arquitecto o constructor.",                            obligatorio: false },
  { id: "plano_ubicacion",   nombre: "Plano de ubicación",                      descripcion: "Imagen satelital o croquis de localización del predio.",             obligatorio: true },
]

const DOCS_POR_TIPO: Partial<Record<TipoPermiso, string[]>> = {
  permiso_edificacion: ["solicitud", "cip", "dominio", "planos_arq", "memoria_desc", "planos_estr", "memoria_calc", "instalaciones_el", "instalaciones_san", "plano_empl", "presupuesto", "plano_ubicacion"],
  anteproyecto:        ["solicitud", "cip", "dominio", "planos_arq", "memoria_desc", "plano_empl", "plano_ubicacion"],
  ampliacion:          ["solicitud", "cip", "dominio", "planos_arq", "memoria_desc", "planos_estr", "memoria_calc", "plano_empl", "plano_ubicacion"],
  cambio_destino:      ["solicitud", "cip", "dominio", "planos_arq", "memoria_desc", "plano_empl", "plano_ubicacion"],
  obra_menor_sin_permiso: ["dec_jurada", "planos_arq", "plano_empl", "plano_ubicacion"],
  obra_menor_con_permiso: ["solicitud", "dec_jurada", "planos_arq", "memoria_desc", "plano_empl", "plano_ubicacion"],
  subdivision:         ["solicitud", "cip", "dominio", "plano_empl", "plano_ubicacion"],
  loteo:               ["solicitud", "cip", "dominio", "planos_arq", "plano_empl", "presupuesto", "plano_ubicacion"],
  recepcion_final:     ["solicitud", "dominio", "planos_arq", "instalaciones_el", "instalaciones_san"],
  recepcion_parcial:   ["solicitud", "dominio", "planos_arq"],
  revision_normativa:  ["solicitud", "cip", "planos_arq", "memoria_desc", "plano_empl"],
  supervision_apertura:["solicitud", "planos_arq", "plano_empl"],
  patente_comercial:   ["solicitud", "cip", "dominio", "planos_arq", "memoria_desc", "plano_empl", "plano_ubicacion"],
  otro:                ["solicitud", "cip", "dominio", "planos_arq", "memoria_desc", "plano_empl"],
}

// ──────────────────────────────────────────────────
// Score logic
// ──────────────────────────────────────────────────
function calcularScore(
  tipo: TipoPermiso,
  documentos: Documento[],
  manualChecks: Record<string, boolean>
): {
  requeridos: DocRequerido[]
  completados: string[]
  faltantes: string[]
  score: number
} {
  const ids = DOCS_POR_TIPO[tipo] ?? DOCS_POR_TIPO["otro"]!
  const requeridos = DOCS_BASE.filter((d) => ids.includes(d.id))

  // Match docs by name similarity (mock matching)
  const uploadedNames = documentos.map((d) => d.nombre.toLowerCase())
  const completados: string[] = []
  const faltantes: string[] = []

  for (const doc of requeridos) {
    const uploaded = uploadedNames.some(
      (n) =>
        n.includes(doc.id.replace("_", " ")) ||
        n.includes(doc.nombre.toLowerCase().slice(0, 8))
    )
    const checked = manualChecks[doc.id] ?? false
    if (uploaded || checked) {
      completados.push(doc.id)
    } else {
      faltantes.push(doc.id)
    }
  }

  const score = requeridos.length === 0 ? 100 : Math.round((completados.length / requeridos.length) * 100)
  return { requeridos, completados, faltantes, score }
}

// ──────────────────────────────────────────────────
// Color helpers
// ──────────────────────────────────────────────────
function scoreColor(score: number): { ring: string; text: string; label: string } {
  if (score >= 90) return { ring: "stroke-green-500", text: "text-green-600", label: "Listo para ingresar" }
  if (score >= 60) return { ring: "stroke-amber-400", text: "text-amber-600", label: "En preparación" }
  return { ring: "stroke-rose-400", text: "text-rose-600", label: "Documentos pendientes" }
}

// ──────────────────────────────────────────────────
// Gauge SVG
// ──────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const { ring, text, label } = scoreColor(score)
  const r = 28
  const circ = 2 * Math.PI * r
  const pct  = (score / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg width="72" height="72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/20" />
          <circle
            cx="36" cy="36" r={r}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - pct}
            className={cn("transition-all duration-700", ring)}
          />
        </svg>
        <span className={cn("absolute text-[17px] font-bold tabular-nums", text)}>{score}%</span>
      </div>
      <p className={cn("text-[10px] font-semibold", text)}>{label}</p>
    </div>
  )
}

// ──────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────
interface ExpedienteScoreProps {
  tipo: TipoPermiso
  municipio: string
  documentos: Documento[]
  proyectoId: string
}

export function ExpedienteScore({ tipo, municipio, documentos, proyectoId }: ExpedienteScoreProps) {
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({})
  const [showAll, setShowAll] = useState(false)

  const { requeridos, completados, faltantes, score } = useMemo(
    () => calcularScore(tipo, documentos, manualChecks),
    [tipo, documentos, manualChecks]
  )

  const { label } = scoreColor(score)
  const obligatoriosFaltantes = faltantes.filter((id) => requeridos.find((r) => r.id === id)?.obligatorio)

  function toggle(id: string) {
    setManualChecks((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="size-3.5 text-primary/60" />
          <p className="text-xs font-semibold text-primary">Completitud del Expediente</p>
        </div>
        <Link
          href={`/herramientas/checklist?municipio=${encodeURIComponent(municipio)}`}
          className="text-[10px] text-primary/50 hover:text-primary transition-colors"
        >
          Checklist completo →
        </Link>
      </div>

      {/* Gauge + faltantes summary */}
      <div className="flex items-center gap-4">
        <ScoreGauge score={score} />
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
            <span className="text-muted-foreground">{completados.length} de {requeridos.length} documentos confirmados</span>
          </div>
          {faltantes.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <AlertTriangle className="size-3.5 text-rose-500 shrink-0" />
              <span className="text-rose-600 font-medium">{obligatoriosFaltantes.length} obligatorio{obligatoriosFaltantes.length !== 1 ? "s" : ""} pendiente{obligatoriosFaltantes.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          {score >= 90 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Rocket className="size-3.5 text-green-500 shrink-0" />
              <span className="text-green-700 font-medium">Expediente listo para ingresar</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            score >= 90 ? "bg-green-500" : score >= 60 ? "bg-amber-400" : "bg-rose-400"
          )}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Doc list — always show faltantes, toggle rest */}
      <div className="space-y-1">
        {requeridos.map((doc) => {
          const done     = completados.includes(doc.id)
          const checked  = manualChecks[doc.id] ?? false
          const visible  = !done || showAll

          if (!visible) return null
          return (
            <button
              key={doc.id}
              onClick={() => toggle(doc.id)}
              className={cn(
                "w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                done ? "opacity-60 hover:opacity-80" : "hover:bg-[#F9F7F3]"
              )}
            >
              {done ? (
                <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-green-500" />
              ) : doc.obligatorio ? (
                <XCircle className="size-3.5 shrink-0 mt-0.5 text-rose-400" />
              ) : (
                <Circle className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/40" />
              )}
              <div className="min-w-0">
                <p className={cn("text-[11.5px] font-medium truncate", done ? "line-through text-muted-foreground/60" : "text-primary")}>
                  {doc.nombre}
                  {!doc.obligatorio && <span className="ml-1 text-[9.5px] text-muted-foreground/50">(opcional)</span>}
                </p>
                {!done && doc.descripcion && (
                  <p className="text-[10px] text-muted-foreground/60 leading-snug mt-0.5">{doc.descripcion}</p>
                )}
                {!done && doc.vigencia && (
                  <p className="flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                    <Clock className="size-3 shrink-0" />
                    Vigencia máx. {doc.vigencia}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Toggle show completed */}
      {completados.length > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex w-full items-center justify-center gap-1.5 text-[10.5px] text-muted-foreground/60 hover:text-primary transition-colors"
        >
          <ChevronDown className={cn("size-3.5 transition-transform", showAll && "rotate-180")} />
          {showAll ? "Ocultar completados" : `Ver ${completados.length} completado${completados.length !== 1 ? "s" : ""}`}
        </button>
      )}

      {/* Upload CTA if missing */}
      {faltantes.length > 0 && (
        <div className="flex gap-2 pt-1">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 py-2 text-[10.5px] font-medium text-primary/70 hover:border-primary/50 hover:bg-primary/4 transition-all">
            <Upload className="size-3.5" />
            Subir documentos
          </button>
          <Link
            href={`/herramientas/checklist?municipio=${encodeURIComponent(municipio)}`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[10.5px] font-medium text-muted-foreground hover:border-primary/20 hover:text-primary transition-all"
          >
            <FileText className="size-3.5" />
            Checklist
          </Link>
        </div>
      )}
    </div>
  )
}
