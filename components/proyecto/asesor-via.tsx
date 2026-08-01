"use client"

import { useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  PencilRuler,
  Route,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TextoConCitas } from "@/components/arch/cita"
import { cn } from "@/lib/utils"

type Viabilidad = "sí" | "con condiciones" | "no"
type CostoRelativo = "bajo" | "medio" | "alto"

interface ViaTramitacion {
  nombre: string
  viable: Viabilidad
  tiempoEstimado: string
  costoRelativo: CostoRelativo
  requisitos: string[]
  pros: string[]
  contras: string[]
  fundamento: string
}

interface PasoEstrategia {
  orden: number
  accion: string
  porque: string
}

interface AjusteProyecto {
  elemento: string
  accion: string
  porque: string
}

interface AsesorResult {
  viaRecomendada: string
  vias: ViaTramitacion[]
  estrategia: string
  pasos: PasoEstrategia[]
  ajustesProyecto: AjusteProyecto[]
  riesgos: string[]
  ddu: { codigo: string; porque: string }[]
  advertencia: string
}

const VIABILIDAD_STYLE: Record<Viabilidad, string> = {
  "sí": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "con condiciones": "border-amber-200 bg-amber-50 text-amber-700",
  "no": "border-red-200 bg-red-50 text-red-700",
}

const COSTO_STYLE: Record<CostoRelativo, string> = {
  bajo: "border-emerald-200 bg-emerald-50 text-emerald-700",
  medio: "border-amber-200 bg-amber-50 text-amber-700",
  alto: "border-red-200 bg-red-50 text-red-700",
}

export function AsesorVia({ proyectoId }: { proyectoId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AsesorResult | null>(null)

  async function handleAsesorar() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/asesor-tramitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId }),
      })
      const data = (await res.json()) as Partial<AsesorResult> & { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo generar la asesoría.")
        return
      }
      setResult({
        viaRecomendada: data.viaRecomendada ?? "",
        vias: data.vias ?? [],
        estrategia: data.estrategia ?? "",
        pasos: data.pasos ?? [],
        ajustesProyecto: data.ajustesProyecto ?? [],
        riesgos: data.riesgos ?? [],
        ddu: data.ddu ?? [],
        advertencia: data.advertencia ?? "",
      })
    } catch {
      setError("Error de red al consultar el asesor.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Route className="size-4 text-[var(--blueprint)]" />
          <CardTitle>Cómo continuar · vía de tramitación</CardTitle>
        </div>
        <button
          type="button"
          onClick={() => void handleAsesorar()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {loading
            ? "Analizando expediente…"
            : result
              ? "Volver a analizar"
              : "Sugerir cómo continuar (vía más liviana)"}
        </button>
      </CardHeader>

      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          A partir del due diligence verificado y las observaciones marcadas sobre los planos, te dice
          el movimiento específico: qué vía conviene (512 / obra menor / cambio de destino) y qué
          revertir o redibujar para caer bajo la vía más liviana, con su fundamento normativo.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Vía recomendada */}
            {result.viaRecomendada && (
              <div className="rounded-[3px] border-l-2 border-l-[var(--blueprint)] border-y border-r border-line-med bg-primary/5 p-4">
                <p className="font-technical text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">
                  Vía recomendada
                </p>
                <p className="font-technical mt-1 text-xl font-semibold text-primary">
                  {result.viaRecomendada}
                </p>
                {result.estrategia && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    <TextoConCitas>{result.estrategia}</TextoConCitas>
                  </p>
                )}
              </div>
            )}

            {/* Ajustes de proyecto — DESTACADO */}
            {result.ajustesProyecto.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <PencilRuler className="size-4 text-amber-600" />
                  <h4 className="text-sm font-semibold text-amber-800">
                    Qué revertir o redibujar para calificar a la vía liviana
                  </h4>
                </div>
                <ul className="space-y-3">
                  {result.ajustesProyecto.map((a, idx) => (
                    <li
                      key={`${a.elemento}-${idx}`}
                      className="rounded-lg border border-amber-200 bg-card p-3"
                    >
                      <p className="text-sm font-semibold text-amber-900">{a.elemento}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground/80">
                        <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        <span>
                          <TextoConCitas>{a.accion}</TextoConCitas>
                        </span>
                      </p>
                      {a.porque && (
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">
                          <TextoConCitas>{a.porque}</TextoConCitas>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Comparación de vías */}
            {result.vias.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-primary">Vías evaluadas</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {result.vias.map((via, idx) => (
                    <div
                      key={`${via.nombre}-${idx}`}
                      className="rounded-xl border border-border bg-muted/20 p-3"
                    >
                      <p className="text-sm font-semibold text-foreground">{via.nombre}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            VIABILIDAD_STYLE[via.viable] ??
                              "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          Viable: {via.viable}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            COSTO_STYLE[via.costoRelativo] ??
                              "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          Costo {via.costoRelativo}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {via.tiempoEstimado}
                        </span>
                      </div>
                      {via.fundamento && (
                        <p className="mt-2 text-xs leading-snug text-muted-foreground">
                          <TextoConCitas>{via.fundamento}</TextoConCitas>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pasos */}
            {result.pasos.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-primary">Pasos</h4>
                <ol className="space-y-3">
                  {result.pasos.map((paso, idx) => (
                    <li key={`${paso.orden}-${idx}`} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold tabular-nums text-primary">
                        {paso.orden || idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          <TextoConCitas>{paso.accion}</TextoConCitas>
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          <TextoConCitas>{paso.porque}</TextoConCitas>
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Argumentos DDU */}
            {result.ddu.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-primary">Argumentos normativos (DDU)</h4>
                <ul className="space-y-2">
                  {result.ddu.map((d, idx) => (
                    <li
                      key={`${d.codigo}-${idx}`}
                      className="rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-foreground">
                        <TextoConCitas>{d.codigo}</TextoConCitas>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <TextoConCitas>{d.porque}</TextoConCitas>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Riesgos */}
            {result.riesgos.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <ShieldAlert className="size-4" />
                  Riesgos y supuestos a verificar
                </h4>
                <ul className="space-y-1.5">
                  {result.riesgos.map((r, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-foreground/80"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        <TextoConCitas>{r}</TextoConCitas>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advertencia */}
            {result.advertencia && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  <TextoConCitas>{result.advertencia}</TextoConCitas>
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
