"use client"

import { useState } from "react"
import { Lightbulb } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ESTADISTICAS_MUNICIPIOS, type EstadisticaMunicipio } from "@/lib/municipios-stats"
import { Num } from "@/components/arch/dato"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineResult {
  fechaP50: Date
  fechaP80: Date
  fechaP95: Date
  diasP50: number
  diasP80: number
  diasP95: number
  plazoLegal: Date
  probabilidadConObs: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPOS_OBRA = [
  { value: "permiso_edificacion", label: "Permiso de edificación" },
  { value: "ampliacion", label: "Ampliación" },
  { value: "regularizacion", label: "Regularización" },
  { value: "recepcion_final", label: "Recepción final" },
]

function addDias(fecha: Date, dias: number): Date {
  const result = new Date(fecha)
  result.setDate(result.getDate() + Math.round(dias))
  return result
}

function calcularTimeline(
  municipio: EstadisticaMunicipio,
  fechaIngreso: Date,
): TimelineResult {
  const diasBase = municipio.tiempoPromedioHabiles * 1.4
  const diasConObs = (municipio.tiempoPromedioHabiles + 20) * 1.4

  const diasP50 = municipio.cumplimientoPlazoLey > 0.7 ? Math.min(diasBase, 42) : diasBase
  const diasP80 = diasBase * (1 + municipio.tasaObservaciones * 0.8)
  const diasP95 = diasConObs * 1.3

  return {
    fechaP50: addDias(fechaIngreso, diasP50),
    fechaP80: addDias(fechaIngreso, diasP80),
    fechaP95: addDias(fechaIngreso, diasP95),
    diasP50: Math.round(diasP50),
    diasP80: Math.round(diasP80),
    diasP95: Math.round(diasP95),
    plazoLegal: addDias(fechaIngreso, 42),
    probabilidadConObs: Math.round(municipio.tasaObservaciones * 100),
  }
}

function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0]
}

// ─── Sorted municipios (calificacion desc) ───────────────────────────────────

const MUNICIPIOS_SORTED = [...ESTADISTICAS_MUNICIPIOS].sort(
  (a, b) => b.calificacion - a.calificacion
)

// ─── Timeline bar ─────────────────────────────────────────────────────────────

interface TimelineBarProps {
  result: TimelineResult
  fechaIngreso: Date
}

function TimelineBar({ result, fechaIngreso }: TimelineBarProps) {
  const totalDias = result.diasP95
  if (totalDias <= 0) return null

  function pct(dias: number): number {
    return Math.min(100, Math.round((dias / totalDias) * 100))
  }

  const legalDias = 42
  const legalPct = pct(legalDias)
  const p50Pct = pct(result.diasP50)
  const p80Pct = pct(result.diasP80)

  const markers: { pct: number; label: string; fecha: Date }[] = [
    { pct: 0,        label: "Hoy",                         fecha: fechaIngreso },
    { pct: legalPct, label: "Plazo legal · 30 días háb.", fecha: result.plazoLegal },
    { pct: p50Pct,   label: "P50",                        fecha: result.fechaP50 },
    { pct: p80Pct,   label: "P80",                        fecha: result.fechaP80 },
    { pct: 100,      label: "P95",                        fecha: result.fechaP95 },
  ]

  return (
    <div className="bg-blueprint-grid space-y-6 rounded-[4px] border border-line-fine p-5">
      {/* Gradient bar */}
      <div className="relative h-6 w-full overflow-hidden rounded-[3px]"
        style={{ background: "linear-gradient(to right, var(--state-ok), var(--state-warn), var(--state-error))" }}
      >
        {/* Tick lines for each marker (except Hoy at 0) */}
        {markers.slice(1).map((m) => (
          <div
            key={m.label}
            className="absolute top-0 h-full w-px bg-white/70"
            style={{ left: `${m.pct}%` }}
          />
        ))}
      </div>

      {/* Marker labels */}
      <div className="relative h-16 w-full">
        {markers.map((m) => (
          <div
            key={m.label}
            className="absolute flex flex-col items-center gap-0.5"
            style={{
              left: `${m.pct}%`,
              transform: m.pct === 0 ? "translateX(0)" : m.pct === 100 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <div className="font-technical text-center text-[9px] font-medium uppercase leading-tight tracking-[0.14em] text-muted-foreground">
              {m.label}
            </div>
            <Num className="whitespace-nowrap text-[10px] text-muted-foreground/70">
              {formatFecha(m.fecha)}
            </Num>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [municipioNombre, setMunicipioNombre] = useState<string>("")
  const [tipoObra, setTipoObra] = useState<string>("")
  const [fechaIngreso, setFechaIngreso] = useState<string>(todayIso())
  const [result, setResult] = useState<TimelineResult | null>(null)
  const [municipioActivo, setMunicipioActivo] = useState<EstadisticaMunicipio | null>(null)

  function handleCalcular() {
    const muni = ESTADISTICAS_MUNICIPIOS.find((m) => m.nombre === municipioNombre)
    if (!muni || !fechaIngreso) return

    const fecha = new Date(fechaIngreso + "T12:00:00")
    const calc = calcularTimeline(muni, fecha)
    setResult(calc)
    setMunicipioActivo(muni)
  }

  const fechaIngresoDate = fechaIngreso ? new Date(fechaIngreso + "T12:00:00") : new Date()
  const mesIngreso = fechaIngresoDate.toLocaleDateString("es-CL", { month: "long" })
  const mesIngresoCapitalizado = mesIngreso.charAt(0).toUpperCase() + mesIngreso.slice(1)

  const recomendaciones: string[] = []

  if (result && municipioActivo) {
    const esMesLento = municipioActivo.mesesMasLentos.some(
      (m) => m.toLowerCase() === mesIngreso.toLowerCase()
    )
    if (esMesLento) {
      const siguienteAgil = municipioActivo.mesesMasAgiles[0] ?? "un mes más ágil"
      recomendaciones.push(
        `Ingresarás en un mes históricamente lento (${mesIngresoCapitalizado}). Considera adelantar o esperar a ${siguienteAgil}.`
      )
    }
    if (municipioActivo.tasaObservaciones > 0.6) {
      recomendaciones.push(
        "Alta probabilidad de observaciones. Prepara el expediente con el Auditor antes de ingresar."
      )
    }
    if (municipioActivo.cumplimientoPlazoLey < 0.5) {
      recomendaciones.push(
        "Esta DOM incumple el plazo legal en más del 50% de los casos. Documenta la fecha de ingreso para exigir pronunciamiento."
      )
    }
    recomendaciones.push("Comparte estas fechas con tu cliente para alinear expectativas.")
  }

  const canCalculate = municipioNombre !== "" && tipoObra !== "" && fechaIngreso !== ""

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        emoji="📅"
        title="Timeline de Aprobación"
        subtitle="Estima el plazo realista de tu permiso basado en datos históricos por municipio"
        breadcrumbs={[{ label: "IA Normativa" }, { label: "Timeline" }]}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Formulario */}
        <Card>
          <CardHeader>
            <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Parámetros de cálculo
            </p>
            <CardTitle className="font-technical mt-1 text-base">Configura tu consulta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Municipio */}
              <div className="space-y-1.5">
                <Label htmlFor="municipio">Municipio</Label>
                <Select value={municipioNombre} onValueChange={(v) => setMunicipioNombre(v ?? "")}>
                  <SelectTrigger id="municipio">
                    <SelectValue placeholder="Selecciona municipio..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MUNICIPIOS_SORTED.map((m) => (
                      <SelectItem key={m.nombre} value={m.nombre}>
                        {m.nombre}
                        {m.calificacion >= 4 ? " ★" : m.calificacion <= 2 ? " ▼" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de obra */}
              <div className="space-y-1.5">
                <Label htmlFor="tipo-obra">Tipo de obra</Label>
                <Select value={tipoObra} onValueChange={(v) => setTipoObra(v ?? "")}>
                  <SelectTrigger id="tipo-obra">
                    <SelectValue placeholder="Selecciona tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_OBRA.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha de ingreso */}
              <div className="space-y-1.5">
                <Label htmlFor="fecha-ingreso">Fecha de ingreso</Label>
                <input
                  id="fecha-ingreso"
                  type="date"
                  value={fechaIngreso}
                  onChange={(e) => setFechaIngreso(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>

            <Button onClick={handleCalcular} disabled={!canCalculate}>
              Calcular timeline
            </Button>
          </CardContent>
        </Card>

        {/* Resultados */}
        {result && municipioActivo && (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* P50 */}
              {(() => {
                const p50Estado: Veredicto = result.diasP50 <= 42 ? "cumple" : "observa"
                return (
                  <div className="rounded-[4px] border border-line-fine bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-technical text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        P50 · 50% probabilidad
                      </p>
                      <EstadoNormativo
                        estado={p50Estado}
                        label={p50Estado === "cumple" ? "En plazo legal" : "Excede plazo"}
                      />
                    </div>
                    <p className="num mt-2 flex items-baseline gap-1.5 text-2xl font-semibold leading-none">
                      <Num>{result.diasP50}</Num>
                      <span className="text-xs font-medium text-muted-foreground">días</span>
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Aprobaría antes del <Num>{formatFecha(result.fechaP50)}</Num>
                    </p>
                  </div>
                )
              })()}

              {/* P80 */}
              <div className="rounded-[4px] border border-line-fine bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-technical text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    P80 · 80% probabilidad
                  </p>
                  <EstadoNormativo estado="observa" label="Escenario probable" />
                </div>
                <p className="num mt-2 flex items-baseline gap-1.5 text-2xl font-semibold leading-none">
                  <Num>{result.diasP80}</Num>
                  <span className="text-xs font-medium text-muted-foreground">días</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Aprobaría antes del <Num>{formatFecha(result.fechaP80)}</Num>
                </p>
              </div>

              {/* P95 */}
              <div className="rounded-[4px] border border-line-fine bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-technical text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    P95 · Peor caso
                  </p>
                  <EstadoNormativo estado="rechaza" label="Vencido" />
                </div>
                <p className="num mt-2 flex items-baseline gap-1.5 text-2xl font-semibold leading-none">
                  <Num>{result.diasP95}</Num>
                  <span className="text-xs font-medium text-muted-foreground">días</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Aprobaría antes del <Num>{formatFecha(result.fechaP95)}</Num>
                </p>
              </div>
            </div>

            {/* Barra de timeline visual */}
            <Card>
              <CardHeader>
                <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Proyección de plazos
                </p>
                <CardTitle className="font-technical mt-1 text-base">Línea de tiempo visual</CardTitle>
              </CardHeader>
              <CardContent className="pb-6">
                <TimelineBar result={result} fechaIngreso={fechaIngresoDate} />
              </CardContent>
            </Card>

            {/* Inteligencia del municipio */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                      Serie histórica · Ley 21.718
                    </p>
                    <CardTitle className="font-technical mt-1 text-base">
                      Estimación DOM {municipioActivo.nombre}
                    </CardTitle>
                  </div>
                  {municipioActivo.calificacion <= 2 ? (
                    <EstadoNormativo
                      estado="rechaza"
                      label={`DOM lenta — considera ingresar en ${municipioActivo.mesesMasAgiles[0]}`}
                    />
                  ) : municipioActivo.calificacion >= 4 ? (
                    <EstadoNormativo estado="cumple" label="DOM eficiente" />
                  ) : null}
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                  <div>
                    <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tiempo promedio</dt>
                    <dd className="text-sm">
                      <Num className="font-semibold">{municipioActivo.tiempoPromedioHabiles}</Num>
                      <span className="ml-1 text-xs text-muted-foreground">días hábiles</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cumplimiento plazo Ley 21.718</dt>
                    <dd className="text-sm">
                      <Num className="font-semibold">{Math.round(municipioActivo.cumplimientoPlazoLey * 100)}</Num>
                      <span className="text-xs text-muted-foreground">%</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Probabilidad de observaciones</dt>
                    <dd className="text-sm">
                      <Num className="font-semibold">{result.probabilidadConObs}</Num>
                      <span className="text-xs text-muted-foreground">%</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Calificación DOM</dt>
                    <dd className="num text-sm font-semibold">{"★".repeat(municipioActivo.calificacion)}{"☆".repeat(5 - municipioActivo.calificacion)}</dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meses más ágiles</dt>
                    <dd className="text-sm font-medium">{municipioActivo.mesesMasAgiles.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Meses más lentos</dt>
                    <dd className="text-sm font-medium">{municipioActivo.mesesMasLentos.join(", ")}</dd>
                  </div>
                  {municipioActivo.notas && (
                    <div className="sm:col-span-2">
                      <dt className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notas</dt>
                      <dd className="text-sm text-muted-foreground">{municipioActivo.notas}</dd>
                    </div>
                  )}
                </dl>
                <p className="mt-4 text-[10px] text-muted-foreground/50">
                  Estimación sintética — aún no proviene de expedientes reales tramitados en PermisoHub.
                </p>
              </CardContent>
            </Card>

            {/* Recomendación táctica */}
            {recomendaciones.length > 0 && (
              <Card>
                <CardHeader>
                  <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Lectura del analista
                  </p>
                  <CardTitle className="font-technical mt-1 flex items-center gap-2 text-base">
                    <Lightbulb className="size-4 text-muted-foreground" />
                    Recomendación táctica
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y divide-line-fine">
                    {recomendaciones.map((rec, i) => (
                      <li key={i} className="flex items-start gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                        <span className="num mt-0.5 shrink-0 text-[10px] font-semibold text-muted-foreground/50">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground/80">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
