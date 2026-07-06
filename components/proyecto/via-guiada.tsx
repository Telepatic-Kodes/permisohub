"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ArrowLeft, Check, ExternalLink, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import {
  citaDeNodo,
  pasoSiguiente,
  type NodoVia,
  type RespuestasVia,
} from "@/lib/via-tramitacion"
import { calcularCuadro, type CuadroInput } from "@/lib/cuadros-calculo"
import { cn } from "@/lib/utils"

// Flujo guiado de vía (PlanX-lite): una pregunta por pantalla sobre el árbol
// determinista, con el artículo que fundamenta cada nodo y el resultado citado.
// Auto-responde solo lo que el cuadro/SII permiten, marcándolo; el resto lo
// contesta el usuario. Persiste respuestas + resultado al terminar.
export function ViaGuiada({
  proyectoId,
  destinoSii,
  onSaved,
}: {
  proyectoId: string
  destinoSii?: string | null
  onSaved?: (respuestas: Partial<RespuestasVia>) => void
}) {
  const [respuestas, setRespuestas] = useState<Partial<RespuestasVia>>({})
  const [orden, setOrden] = useState<(keyof RespuestasVia)[]>([])
  const [sugerencias, setSugerencias] = useState<Partial<RespuestasVia>>({})
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  // Prellena "excede PRC" desde el cuadro de cálculo guardado (determinista).
  // No se auto-responde: se sugiere y se marca; el usuario confirma en su nodo.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/cuadro-calculo`)
        if (!res.ok) return
        const json = (await res.json()) as { data: CuadroInput | null }
        if (cancelled || !json.data) return
        const c = calcularCuadro(json.data)
        if (!c.incompleto && c.incumplimientos.length > 0) {
          setSugerencias((prev) => ({ ...prev, excedePRC: true }))
        }
      } catch {
        // silencioso: el prellenado es opcional
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyectoId])

  const paso = useMemo(() => pasoSiguiente(respuestas), [respuestas])

  const responder = (clave: keyof RespuestasVia, valor: boolean) => {
    setRespuestas((prev) => ({ ...prev, [clave]: valor }))
    setOrden((prev) => [...prev, clave])
    setGuardado(false)
  }

  const atras = () => {
    const ult = orden[orden.length - 1]
    if (!ult) return
    setRespuestas((r) => ({ ...r, [ult]: undefined }))
    setOrden((prev) => prev.slice(0, -1))
    setGuardado(false)
  }

  const reiniciar = () => {
    setRespuestas({})
    setOrden([])
    setGuardado(false)
  }

  const guardar = async () => {
    if (paso.tipo !== "resultado") return
    setGuardando(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/via-tramitacion`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuestas: paso.respuestas, resultado: paso.via }),
      })
      if (!res.ok) throw new Error("No se pudo guardar")
      setGuardado(true)
      toast.success("Vía de tramitación guardada")
      onSaved?.(paso.respuestas)
    } catch {
      toast.error("No se pudo guardar la vía")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Progreso */}
      <div className="flex items-center justify-between border-b border-line-fine px-1 pb-2">
        <p className="font-technical text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {paso.tipo === "pregunta"
            ? `Paso ${paso.indice + 1} de ${paso.total}`
            : "Resultado"}
        </p>
        {orden.length > 0 && (
          <button
            type="button"
            onClick={atras}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3" /> Atrás
          </button>
        )}
      </div>

      {paso.tipo === "pregunta" ? (
        <PantallaPregunta
          nodo={paso.nodo}
          sugerencia={sugerencias[paso.nodo.clave]}
          destinoSii={paso.nodo.clave === "cambiaDestino" ? destinoSii : undefined}
          onResponder={responder}
        />
      ) : (
        <div className="px-1 pt-4">
          <p className="font-technical text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Vía recomendada
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="font-technical text-xl font-semibold text-primary">{paso.via.via}</p>
            <span
              className="inline-flex items-center rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium"
              style={
                paso.via.liviana
                  ? { color: "var(--blueprint)", borderColor: "var(--blueprint)", background: "var(--blueprint-soft)" }
                  : { color: "var(--state-warn)", borderColor: "var(--state-warn)", background: "color-mix(in oklch, var(--state-warn) 12%, transparent)" }
              }
            >
              {paso.via.liviana ? "Vía liviana" : "Vía pesada"}
            </span>
          </div>
          <p className="num mt-1 text-[11px] text-muted-foreground">{paso.via.costoTiempo}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/80">{paso.via.razon}</p>

          {paso.via.cita && (
            <a
              href={paso.via.cita.url}
              target="_blank"
              rel="noopener noreferrer"
              className="num mt-3 inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
            >
              {paso.via.cita.etiqueta}
              <ExternalLink className="size-2.5" />
            </a>
          )}

          {paso.via.alertas.length > 0 && (
            <ul className="mt-3 space-y-1">
              {paso.via.alertas.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: "var(--state-warn)" }}>
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line-fine pt-3">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || guardado}
              className="inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: "var(--blueprint)" }}
            >
              {guardando ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : guardado ? (
                <Check className="size-3.5" />
              ) : null}
              {guardado ? "Guardado" : "Guardar vía"}
            </button>
            <button
              type="button"
              onClick={reiniciar}
              className="inline-flex items-center gap-1.5 rounded-[3px] border border-line-med px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:text-primary"
            >
              <RotateCcw className="size-3.5" /> Reiniciar
            </button>
          </div>

          <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
            Orientativo. La DOM de la comuna puede exigir matices; para los ajustes específicos del
            proyecto, usa el asesor de vía (IA).
          </p>
        </div>
      )}
    </div>
  )
}

function PantallaPregunta({
  nodo,
  sugerencia,
  destinoSii,
  onResponder,
}: {
  nodo: NodoVia
  sugerencia?: boolean
  destinoSii?: string | null
  onResponder: (clave: keyof RespuestasVia, valor: boolean) => void
}) {
  const cita = citaDeNodo(nodo)

  return (
    <div className="px-1 pt-4">
      <p className="font-technical text-lg font-semibold leading-snug text-foreground">{nodo.label}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{nodo.ayuda}</p>

      {destinoSii && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-[3px] border border-line-med bg-muted/40 px-2 py-1 text-[11px] text-foreground/80">
          Destino actual según SII: <span className="num font-medium">{destinoSii}</span>
        </p>
      )}

      {sugerencia !== undefined && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--blueprint)]">
          <Check className="mt-0.5 size-3 shrink-0" />
          Sugerido “{sugerencia ? "Sí" : "No"}” desde tu cuadro de cálculo — confírmalo o corrígelo.
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {([["Sí", true], ["No", false]] as const).map(([label, val]) => {
          const sugerido = sugerencia === val
          return (
            <button
              key={label}
              type="button"
              onClick={() => onResponder(nodo.clave, val)}
              className={cn(
                "num flex-1 rounded-[3px] border px-4 py-2.5 text-[13px] font-medium transition-colors",
                sugerido
                  ? "border-[var(--blueprint)] text-[var(--blueprint)]"
                  : "border-line-med text-foreground hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]",
              )}
              style={sugerido ? { background: "var(--blueprint-soft)" } : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>

      {cita && (
        <div className="mt-4 border-t border-line-fine pt-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fundamento</p>
          <a
            href={cita.url}
            target="_blank"
            rel="noopener noreferrer"
            className="num mt-1 inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
          >
            {cita.etiqueta}
            <ExternalLink className="size-2.5" />
          </a>
        </div>
      )}
    </div>
  )
}
