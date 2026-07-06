"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Calendar, Loader2, Target, TrendingDown, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ESTADISTICAS_MUNICIPIOS } from "@/lib/municipios-stats"
import { SIIEnricher } from "@/components/proyecto/sii-enricher"
import type { SIIData } from "@/lib/sii-lookup"
import { Num } from "@/components/arch/dato"
import { EstadoNormativo, colorDeVeredicto, type Veredicto } from "@/components/arch/estado"

interface Prediccion {
  categoria: string
  probabilidad: number
  descripcion: string
  accion: string
  frecuenciaLocal: boolean
}

interface PredictResult {
  ok: boolean
  municipio: string
  riesgoGlobal: 'BAJO' | 'MEDIO' | 'ALTO'
  mesOptimo: string
  predicciones: Prediccion[]
  resumen: string
  error?: string
}

const RIESGO_CONFIG: Record<PredictResult['riesgoGlobal'], { label: string; icon: typeof TrendingDown; veredicto: Veredicto }> = {
  BAJO: { label: 'Riesgo bajo', icon: TrendingDown, veredicto: 'cumple' },
  MEDIO: { label: 'Riesgo medio', icon: AlertCircle, veredicto: 'observa' },
  ALTO: { label: 'Riesgo alto', icon: TrendingUp, veredicto: 'rechaza' },
}

/** Veredicto normativo por probabilidad de observación individual. */
function veredictoDeProbabilidad(p: number): Veredicto {
  if (p >= 0.7) return 'rechaza'
  if (p >= 0.4) return 'observa'
  return 'cumple'
}

const TIPOS_OBRA = [
  { value: 'permiso_edificacion', label: 'Permiso de edificación' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'regularizacion', label: 'Regularización' },
  { value: 'patente_comercial', label: 'Patente comercial' },
  { value: 'recepcion_final', label: 'Recepción final' },
]

function PredictorPageInner() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siiData, setSIIData] = useState<SIIData | null>(null)

  const [form, setForm] = useState({
    municipio: searchParams.get("municipio") ?? '',
    zonaPRC: '',
    superficieTerreno: '',
    superficieConstruida: '',
    superficieHuella: '',
    pisos: '',
    alturaMaxima: '',
    distanciamientoFrontal: '',
    distanciamientoLateral: '',
    tipoObra: searchParams.get("tipo") ?? 'permiso_edificacion',
  })

  function setField(k: keyof typeof form, v: string | null) {
    setForm(prev => ({ ...prev, [k]: v ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.municipio || !form.superficieTerreno || !form.superficieConstruida) {
      setError('Municipio, superficie del terreno y superficie construida son requeridos')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/predict-observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipio: form.municipio,
          zonaPRC: form.zonaPRC || 'No especificada',
          superficieTerreno: parseFloat(form.superficieTerreno),
          superficieConstruida: parseFloat(form.superficieConstruida),
          superficieHuella: parseFloat(form.superficieHuella || form.superficieTerreno),
          pisos: parseInt(form.pisos || '1'),
          alturaMaxima: parseFloat(form.alturaMaxima || '3'),
          distanciamientoFrontal: parseFloat(form.distanciamientoFrontal || '0'),
          distanciamientoLateral: parseFloat(form.distanciamientoLateral || '0'),
          tipoObra: form.tipoObra,
          // SII enrichment
          ...(siiData && {
            rolSII: siiData.rol,
            destinoActualSII: siiData.destino,
            avaluoFiscalCLP: siiData.avaluo_fiscal_clp || undefined,
            superficieTerrenoSII: siiData.superficie_terreno_m2 || undefined,
            superficieConstruidaSII: siiData.superficie_construida_m2 || undefined,
          }),
        }),
      })
      const data = await res.json() as PredictResult
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error del servidor')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const municipioStats = ESTADISTICAS_MUNICIPIOS.find(m => m.nombre === form.municipio)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🎯"
        title="Anticipa Observaciones"
        subtitle="Predice qué observará la DOM antes de ingresar el expediente"
        breadcrumbs={[{ label: 'Herramientas' }, { label: 'Anticipa Observaciones' }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex items-end justify-between gap-4 border-b border-line-med pb-4">
            <div>
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Predicción normativa · pre-ingreso
              </p>
              <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
                Anticipa observaciones DOM
              </h2>
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-[4px] border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Datos del proyecto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Municipio *</Label>
                    <Select value={form.municipio} onValueChange={v => setField('municipio', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona municipio" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADISTICAS_MUNICIPIOS.map(m => (
                          <SelectItem key={m.nombre} value={m.nombre}>
                            {m.nombre} {'⭐'.repeat(m.calificacion)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo de obra</Label>
                    <Select value={form.tipoObra} onValueChange={v => setField('tipoObra', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_OBRA.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Zona PRC</Label>
                    <Input placeholder="ej: R1, R2, Comercial" value={form.zonaPRC} onChange={e => setField('zonaPRC', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Superficie terreno (m²) *</Label>
                    <Input type="number" placeholder="ej: 500" value={form.superficieTerreno} onChange={e => setField('superficieTerreno', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Superficie construida (m²) *</Label>
                    <Input type="number" placeholder="ej: 300" value={form.superficieConstruida} onChange={e => setField('superficieConstruida', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Huella edificación (m²)</Label>
                    <Input type="number" placeholder="ej: 250" value={form.superficieHuella} onChange={e => setField('superficieHuella', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>N° de pisos</Label>
                    <Input type="number" placeholder="ej: 3" value={form.pisos} onChange={e => setField('pisos', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Altura máxima (m)</Label>
                    <Input type="number" placeholder="ej: 9" value={form.alturaMaxima} onChange={e => setField('alturaMaxima', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Distanciamiento frontal (m)</Label>
                    <Input type="number" placeholder="ej: 5" value={form.distanciamientoFrontal} onChange={e => setField('distanciamientoFrontal', e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Distanciamiento lateral (m)</Label>
                    <Input type="number" placeholder="ej: 3" value={form.distanciamientoLateral} onChange={e => setField('distanciamientoLateral', e.target.value)} />
                  </div>
                </div>

                {/* SII Enricher — auto-populates superficie fields and sends catastral context to AI */}
                <SIIEnricher
                  municipio={form.municipio}
                  onEnrich={(data) => {
                    setSIIData(data)
                    // Auto-fill surfaces if architect hasn't entered them yet
                    if (!form.superficieTerreno && data.superficie_terreno_m2 > 0) {
                      setField('superficieTerreno', String(data.superficie_terreno_m2))
                    }
                    if (!form.superficieConstruida && data.superficie_construida_m2 > 0) {
                      setField('superficieConstruida', String(data.superficie_construida_m2))
                    }
                  }}
                />

                {/* Quick stats del municipio seleccionado */}
                {municipioStats && (
                  <div className="rounded-[4px] border border-line-fine bg-card p-3 text-sm">
                    <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
                      Inteligencia {form.municipio}
                    </p>
                    <p className="text-muted-foreground">
                      <Num>{Math.round(municipioStats.tasaObservaciones * 100)}%</Num> de proyectos reciben observaciones ·
                      Tiempo promedio: <Num>{municipioStats.tiempoPromedioHabiles}</Num> días hábiles ·
                      Meses ágiles: {municipioStats.mesesMasAgiles.join(', ')}
                    </p>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-primary/90 w-full sm:w-auto">
                  {loading ? (
                    <><Loader2 className="size-4 animate-spin" /> Analizando con IA...</>
                  ) : (
                    <><Target className="size-4" /> Analizar riesgo pre-ingreso</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Hero: riesgo global + mes óptimo */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Riesgo — ocupa 2 cols */}
                {(() => {
                  const cfg = RIESGO_CONFIG[result.riesgoGlobal]
                  const Icon = cfg.icon
                  return (
                    <div className="sm:col-span-2 relative overflow-hidden rounded-[4px] border border-line-fine bg-card p-5">
                      <p className="font-technical mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Diagnóstico pre-ingreso</p>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-[4px] border border-line-fine">
                          <Icon className="size-5 text-muted-foreground" />
                        </div>
                        <div className="space-y-1.5">
                          <EstadoNormativo estado={cfg.veredicto} label={cfg.label} />
                          <p className="text-xs text-muted-foreground">
                            {result.municipio} · <Num>{result.predicciones.length}</Num> factores analizados
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Mes óptimo */}
                <div className="relative overflow-hidden rounded-[4px] border border-line-fine bg-card p-5">
                  <p className="font-technical mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Mejor mes</p>
                  <div className="flex items-center gap-2.5 mt-1">
                    <div className="flex size-10 items-center justify-center rounded-[4px] border border-line-fine">
                      <Calendar className="size-5 text-muted-foreground" />
                    </div>
                    <p className="num text-2xl font-semibold leading-none text-primary">{result.mesOptimo}</p>
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">para ingresar expediente</p>
                </div>
              </div>

              {/* Resumen IA */}
              <div className="rounded-[4px] border border-line-fine bg-card px-5 py-4">
                <p className="font-technical mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Análisis IA</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{result.resumen}</p>
              </div>

              {/* Predicciones */}
              <div className="overflow-hidden rounded-[4px] border border-line-fine bg-card">
                <div className="flex items-center justify-between border-b border-line-fine px-5 py-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Observaciones probables · por probabilidad</h3>
                  </div>
                  <span className="num text-[11px] text-muted-foreground/60">{String(result.predicciones.length).padStart(2, '0')}</span>
                </div>

                <div className="divide-y divide-line-fine">
                  {result.predicciones.map((p, i) => {
                    const pct = Math.round(p.probabilidad * 100)
                    const veredicto = veredictoDeProbabilidad(p.probabilidad)
                    const barColor = colorDeVeredicto(veredicto)

                    return (
                      <div key={i} className="px-5 py-4 transition-colors hover:bg-[var(--blueprint)]/[0.05]">
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-start gap-2 flex-wrap min-w-0">
                            <span className="num text-[11px] text-muted-foreground/40 mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                            <span className="text-sm font-semibold text-primary">{p.categoria}</span>
                            {p.frecuenciaLocal && (
                              <EstadoNormativo estado="observa" label={`Frecuente en ${result.municipio}`} dot={false} className="!text-[10px]" />
                            )}
                          </div>
                          <span className="num shrink-0 text-xl font-semibold leading-none" style={{ color: barColor }}>
                            <Num>{pct}%</Num>
                          </span>
                        </div>

                        {/* Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-muted mb-2.5">
                          <div
                            className="h-full rounded-[2px] transition-all duration-700"
                            style={{ width: `${pct}%`, background: barColor }}
                          />
                        </div>

                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{p.descripcion}</p>
                        <div className="flex items-start gap-2 rounded-[3px] border border-line-fine bg-card px-3 py-2">
                          <span className="font-technical text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground shrink-0 mt-px">Acción</span>
                          <p className="text-xs text-foreground/80 leading-relaxed">{p.accion}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PredictorPage() {
  return (
    <Suspense>
      <PredictorPageInner />
    </Suspense>
  )
}
