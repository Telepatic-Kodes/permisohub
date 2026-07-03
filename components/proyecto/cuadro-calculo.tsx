"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Calculator,
  Info,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  calcularCuadro,
  cuadroVacio,
  type CuadroInput,
  type NivelSuperficie,
  type Veredicto,
} from "@/lib/cuadros-calculo"

const VEREDICTO_STYLE: Record<Veredicto, string> = {
  cumple: "border-emerald-200 bg-emerald-50 text-emerald-700",
  excede: "border-red-200 bg-red-50 text-red-700",
  sin_limite: "border-border bg-muted text-muted-foreground",
}

const VEREDICTO_LABEL: Record<Veredicto, string> = {
  cumple: "Cumple",
  excede: "Excede",
  sin_limite: "Sin límite",
}

// Parseo tolerante: string vacío → 0 (para campos obligatorios) o undefined (opcionales).
function toNum(value: string): number {
  const n = Number(value.replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function toOptNum(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const n = Number(value.replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
function show(n: number | undefined): string {
  return n === undefined || n === 0 ? "" : String(n)
}

export function CuadroCalculo({ proyectoId }: { proyectoId: string }) {
  const [input, setInput] = useState<CuadroInput>(cuadroVacio())
  const [saving, setSaving] = useState(false)
  const [sugiriendo, setSugiriendo] = useState(false)

  // Carga inicial de lo guardado.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/cuadro-calculo`)
        if (!res.ok) return
        const data = (await res.json()) as { data: CuadroInput | null }
        if (!cancelled && data.data) setInput(data.data)
      } catch {
        // Silencioso: se queda con el input vacío.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyectoId])

  const resultado = calcularCuadro(input)

  // ── Mutadores de estado ────────────────────────────────────────────────
  const setNivel = (idx: number, patch: Partial<NivelSuperficie>) =>
    setInput((prev) => ({
      ...prev,
      niveles: prev.niveles.map((n, i) => (i === idx ? { ...n, ...patch } : n)),
    }))

  const addNivel = () =>
    setInput((prev) => ({
      ...prev,
      niveles: [
        ...prev.niveles,
        { nombre: `Nivel ${prev.niveles.length + 1}`, edificada: 0, ocupadaSuelo: 0 },
      ],
    }))

  const removeNivel = (idx: number) =>
    setInput((prev) => ({
      ...prev,
      niveles: prev.niveles.filter((_, i) => i !== idx),
    }))

  // ── Guardar ────────────────────────────────────────────────────────────
  async function handleGuardar() {
    setSaving(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/cuadro-calculo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: input }),
      })
      if (!res.ok) throw new Error()
      toast.success("Cuadro de cálculo guardado")
    } catch {
      toast.error("No se pudo guardar el cuadro de cálculo")
    } finally {
      setSaving(false)
    }
  }

  // ── Sugerir desde el expediente (LLM solo extrae; referencial) ──────────
  async function handleSugerir() {
    setSugiriendo(true)
    try {
      const res = await fetch("/api/ai/cuadro-sugerido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proyectoId }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        sugerido?: CuadroInput
        sinDatos?: boolean
        error?: string
      }
      if (!res.ok || !data.ok || !data.sugerido) {
        toast.error(data.error ?? "No se pudo obtener la sugerencia.")
        return
      }
      if (data.sinDatos) {
        toast.info("Aún no hay Due Diligence para sugerir superficies.")
        return
      }
      // Fusiona: reemplaza superficies sugeridas, CONSERVA los límites PRC del arquitecto.
      setInput((prev) => ({
        ...prev,
        superficiePredio: data.sugerido!.superficiePredio,
        niveles: data.sugerido!.niveles,
      }))
      toast.success("Superficies sugeridas desde el expediente. Revísalas y confirma.")
    } catch {
      toast.error("Error de red al pedir la sugerencia.")
    } finally {
      setSugiriendo(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          <CardTitle>Cuadro de cálculo normativo</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSugerir()}
            disabled={sugiriendo}
            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {sugiriendo ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {sugiriendo ? "Leyendo expediente…" : "Sugerir desde el expediente"}
          </button>
          <button
            type="button"
            onClick={() => void handleGuardar()}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Los límites (constructibilidad, ocupación, altura) provienen del PRC de tu comuna —
            ingrésalos y verifícalos; la app no los inventa. Los valores sugeridos desde el
            expediente son referenciales: contrástalos con tus planos. El cálculo es automático y
            determinista.
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Formulario ── */}
          <div className="space-y-5">
            {/* Predio */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Superficie del predio (m²)
              </label>
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                value={show(input.superficiePredio)}
                onChange={(e) =>
                  setInput((prev) => ({ ...prev, superficiePredio: toNum(e.target.value) }))
                }
                placeholder="0"
              />
            </div>

            {/* Niveles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Niveles / superficies
                </label>
                <button
                  type="button"
                  onClick={addNivel}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="size-3.5" />
                  Agregar nivel
                </button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_5rem_5rem_1.75rem] items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground">
                  <span>Nombre</span>
                  <span className="text-right">Edif. m²</span>
                  <span className="text-right">Suelo m²</span>
                  <span />
                </div>
                {input.niveles.map((nivel, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_5rem_5rem_1.75rem] items-center gap-2"
                  >
                    <Input
                      value={nivel.nombre}
                      onChange={(e) => setNivel(idx, { nombre: e.target.value })}
                      placeholder={`Nivel ${idx + 1}`}
                      className="h-9"
                    />
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={show(nivel.edificada)}
                      onChange={(e) => setNivel(idx, { edificada: toNum(e.target.value) })}
                      placeholder="0"
                      className="h-9 text-right"
                    />
                    <Input
                      type="number"
                      min={0}
                      inputMode="decimal"
                      value={show(nivel.ocupadaSuelo)}
                      onChange={(e) => setNivel(idx, { ocupadaSuelo: toOptNum(e.target.value) })}
                      placeholder="0"
                      className="h-9 text-right"
                    />
                    <button
                      type="button"
                      onClick={() => removeNivel(idx)}
                      disabled={input.niveles.length <= 1}
                      title="Quitar nivel"
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Límites del instrumento (PRC) */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground">
                Límites del instrumento (PRC)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">
                    Constructibilidad máx.
                  </label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={show(input.coefConstructibilidadMax)}
                    onChange={(e) =>
                      setInput((prev) => ({
                        ...prev,
                        coefConstructibilidadMax: toOptNum(e.target.value),
                      }))
                    }
                    placeholder="ej. 1.2"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">
                    Ocupación de suelo máx. (%)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={show(input.ocupacionSueloMaxPct)}
                    onChange={(e) =>
                      setInput((prev) => ({
                        ...prev,
                        ocupacionSueloMaxPct: toOptNum(e.target.value),
                      }))
                    }
                    placeholder="ej. 40"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Altura máx. (m)</label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={show(input.alturaMaxM)}
                    onChange={(e) =>
                      setInput((prev) => ({ ...prev, alturaMaxM: toOptNum(e.target.value) }))
                    }
                    placeholder="ej. 10.5"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">
                    Altura del proyecto (m)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={show(input.alturaProyectoM)}
                    onChange={(e) =>
                      setInput((prev) => ({ ...prev, alturaProyectoM: toOptNum(e.target.value) }))
                    }
                    placeholder="ej. 9.0"
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Resultado en vivo ── */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-primary">Resultado (cálculo determinista)</h4>

            {resultado.incompleto && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>Completa superficie del predio y edificada para calcular.</span>
              </div>
            )}

            {resultado.incumplimientos.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="size-4" />
                  Incumplimientos
                </p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {resultado.incumplimientos.map((inc, idx) => (
                    <li key={idx}>{inc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Destacados: constructibilidad y ocupación */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                  Constructibilidad
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                  {resultado.constructibilidad}
                </p>
              </div>
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                  Ocupación de suelo
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                  {resultado.ocupacionSueloPct}%
                </p>
              </div>
            </div>

            {/* Tabla de filas */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2">Concepto</th>
                    <th className="py-2 px-2 text-right">Valor</th>
                    <th className="py-2 px-2 text-right">Límite</th>
                    <th className="py-2 pl-2 text-right">Veredicto</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila, idx) => (
                    <tr key={idx} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-2">
                        <span className="font-medium text-foreground">{fila.concepto}</span>
                        {fila.detalle && (
                          <span className="block text-[11px] text-muted-foreground">
                            {fila.detalle}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-foreground">
                        {fila.valor}
                        {fila.unidad ? ` ${fila.unidad}` : ""}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fila.limite === null
                          ? "—"
                          : `${fila.limite}${fila.unidad ? ` ${fila.unidad}` : ""}`}
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            VEREDICTO_STYLE[fila.veredicto],
                          )}
                        >
                          {VEREDICTO_LABEL[fila.veredicto]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
