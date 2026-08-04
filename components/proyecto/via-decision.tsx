"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ExternalLink, Footprints, GitFork } from "lucide-react"

import { PREGUNTAS_VIA, recomendarVia, type RespuestasVia } from "@/lib/via-tramitacion"
import { calcularCuadro, type CuadroInput } from "@/lib/cuadros-calculo"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ViaGuiada } from "@/components/proyecto/via-guiada"
import { FamiliaFormulario } from "@/components/proyecto/familia-formulario"
import type { Proyecto } from "@/types"
import type { CompatEstado } from "@/lib/zonificacion-compat"

const DEFAULT: RespuestasVia = {
  yaConstruido: false,
  cambiaDestino: false,
  alteraEstructura: false,
  aumentaSuperficie: false,
  excedePRC: false,
}

// Decisor determinista de vía: unas pocas preguntas → la vía DOM y su artículo.
// Es la sugerencia instantánea y citada del PMO; el asesor de vía (IA) profundiza.
export function ViaDecision({ proyecto }: { proyecto: Proyecto }) {
  const [r, setR] = useState<RespuestasVia>(DEFAULT)
  const [guiadaOpen, setGuiadaOpen] = useState(false)
  const [compat, setCompat] = useState<{ estado: CompatEstado; justificacion: string } | null>(null)

  // Prellena "excede PRC" desde el cuadro de cálculo guardado (determinista).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyecto.id}/cuadro-calculo`)
        if (!res.ok) return
        const json = (await res.json()) as { data: CuadroInput | null }
        if (cancelled || !json.data) return
        const c = calcularCuadro(json.data)
        if (!c.incompleto && c.incumplimientos.length > 0) {
          setR((prev) => ({ ...prev, excedePRC: true }))
        }
      } catch {
        // silencioso: el prellenado es opcional
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyecto.id])

  // Prellena los toggles desde el flujo guiado persistido, si existe.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyecto.id}/via-tramitacion`)
        if (!res.ok) return
        const json = (await res.json()) as { data: { respuestas: Partial<RespuestasVia> } | null }
        if (cancelled || !json.data?.respuestas) return
        setR((prev) => ({ ...prev, ...json.data!.respuestas }))
      } catch {
        // silencioso: el prellenado es opcional
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyecto.id])

  // INTEG-01: alerta citada de incompatibilidad de uso, automática y
  // silenciosa — reutiliza el endpoint de COMPAT-01 (Phase 11), nunca toca
  // recomendarVia()/pasoSiguiente() ni su árbol determinista.
  useEffect(() => {
    const zonaUtilizable = proyecto.zona_status === "encontrado" && proyecto.zona_usos_disponibles === true
    if (!zonaUtilizable || !proyecto.destino_sii?.trim()) {
      setCompat(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyecto.id}/compatibilidad`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usoPretendido: proyecto.destino_sii }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { estado: CompatEstado; justificacion: string }
        if (!cancelled) setCompat({ estado: data.estado, justificacion: data.justificacion })
      } catch {
        // silencioso: señal opcional, igual que los otros dos useEffect de este componente
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyecto.id, proyecto.destino_sii, proyecto.zona_status, proyecto.zona_usos_disponibles])

  const rec = useMemo(() => recomendarVia(r), [r])
  const toggle = (clave: keyof RespuestasVia, valor: boolean) =>
    setR((prev) => ({ ...prev, [clave]: valor }))

  return (
    <div className="space-y-4">
    <div className="rotulo overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line-fine px-4 py-3">
        <GitFork className="size-4 text-[var(--blueprint)]" />
        <div>
          <p className="font-technical text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Decisión de vía · determinista
          </p>
          <p className="font-technical text-sm font-semibold text-primary">Qué vía de tramitación aplica</p>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_320px]">
        {/* Preguntas */}
        <div className="divide-y divide-line-fine border-b border-line-fine md:border-b-0 md:border-r">
          {PREGUNTAS_VIA.map((q) => (
            <div key={q.clave} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-foreground">{q.label}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{q.ayuda}</p>
              </div>
              <div className="flex shrink-0 overflow-hidden rounded-[3px] border border-line-med">
                {([["Sí", true], ["No", false]] as const).map(([label, val]) => {
                  const active = r[q.clave] === val
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggle(q.clave, val)}
                      className={cn(
                        "num px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active
                          ? "bg-[var(--blueprint)] text-white"
                          : "bg-card text-muted-foreground hover:text-primary",
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Resultado */}
        <div className="bg-muted/30 px-4 py-3">
          <p className="font-technical text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Vía recomendada
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-technical text-base font-semibold text-primary">{rec.via}</p>
            <span
              className="inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium"
              style={
                rec.liviana
                  ? { color: "var(--blueprint)", borderColor: "var(--blueprint)", background: "var(--blueprint-soft)" }
                  : { color: "var(--state-warn)", borderColor: "var(--state-warn)", background: "color-mix(in oklch, var(--state-warn) 12%, transparent)" }
              }
            >
              {rec.liviana ? "Vía liviana" : "Vía pesada"}
            </span>
          </div>
          <p className="num mt-1 text-[11px] text-muted-foreground">{rec.costoTiempo}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-foreground/80">{rec.razon}</p>

          {rec.cita && (
            <a
              href={rec.cita.url}
              target="_blank"
              rel="noopener noreferrer"
              className="num mt-2 inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
            >
              {rec.cita.etiqueta}
              <ExternalLink className="size-2.5" />
            </a>
          )}

          {rec.alertas.length > 0 && (
            <ul className="mt-2 space-y-1">
              {rec.alertas.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10.5px] leading-snug" style={{ color: "var(--state-warn)" }}>
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          {compat?.estado === "no_permitido" && (
            <div className="mt-2 space-y-1.5 border-t border-dashed border-line-fine pt-2">
              <div className="flex items-start gap-1.5 text-[10.5px] leading-snug" style={{ color: "var(--state-warn)" }}>
                <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                <span>
                  El destino declarado ({proyecto.destino_sii}) no calza con los usos permitidos de la zona
                  {proyecto.zona_codigo ? ` ${proyecto.zona_codigo}` : ""}. {compat.justificacion}
                </span>
              </div>
              <div className="text-[10px]">
                {proyecto.zona_fuente_url ? (
                  <a
                    href={proyecto.zona_fuente_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="num inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver decreto de zona <ExternalLink className="size-2.5" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    Fuente: capa oficial {proyecto.zona_origen === "manual" && proyecto.zona_comuna_manual
                      ? proyecto.zona_comuna_manual
                      : proyecto.municipio} — sin link directo disponible para esta zona.
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 border-t border-line-fine pt-2.5">
            <button
              type="button"
              onClick={() => setGuiadaOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-line-med px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
            >
              <Footprints className="size-3.5" />
              Guiarme paso a paso
            </button>
            <Dialog open={guiadaOpen} onOpenChange={setGuiadaOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-technical">Vía de tramitación · guiada</DialogTitle>
                </DialogHeader>
                <ViaGuiada
                  proyectoId={proyecto.id}
                  destinoSii={proyecto.destino_sii}
                  onSaved={(resp) => {
                    setR((prev) => ({ ...prev, ...resp }))
                    setGuiadaOpen(false)
                  }}
                />
              </DialogContent>
            </Dialog>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Orientativo. Para los ajustes específicos del proyecto, usa el asesor de vía (IA) más abajo.
            </p>
          </div>
        </div>
      </div>
    </div>

    <FamiliaFormulario respuestas={r} superficieAmpliacionM2={proyecto.superficie_construida_m2} />
    </div>
  )
}
