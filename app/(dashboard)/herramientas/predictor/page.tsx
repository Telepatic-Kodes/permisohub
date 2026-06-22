"use client"

import { useState } from "react"
import { AlertCircle, Calendar, Loader2, Target, TrendingDown, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ESTADISTICAS_MUNICIPIOS } from "@/lib/municipios-stats"
import { cn } from "@/lib/utils"

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

const RIESGO_CONFIG = {
  BAJO: { color: 'text-green-700', bg: 'bg-green-100 border-green-300', label: 'Riesgo bajo', icon: TrendingDown },
  MEDIO: { color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300', label: 'Riesgo medio', icon: AlertCircle },
  ALTO: { color: 'text-red-700', bg: 'bg-red-100 border-red-300', label: 'Riesgo alto', icon: TrendingUp },
}

const TIPOS_OBRA = [
  { value: 'permiso_edificacion', label: 'Permiso de edificación' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'regularizacion', label: 'Regularización' },
  { value: 'patente_comercial', label: 'Patente comercial' },
  { value: 'recepcion_final', label: 'Recepción final' },
]

export default function PredictorPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    municipio: '',
    zonaPRC: '',
    superficieTerreno: '',
    superficieConstruida: '',
    superficieHuella: '',
    pisos: '',
    alturaMaxima: '',
    distanciamientoFrontal: '',
    distanciamientoLateral: '',
    tipoObra: 'permiso_edificacion',
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
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card>
              <CardHeader>
                <CardTitle>Datos del proyecto</CardTitle>
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

                {/* Quick stats del municipio seleccionado */}
                {municipioStats && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                    <p className="font-medium text-primary mb-1">Inteligencia {form.municipio}</p>
                    <p className="text-muted-foreground">
                      {Math.round(municipioStats.tasaObservaciones * 100)}% de proyectos reciben observaciones ·
                      Tiempo promedio: {municipioStats.tiempoPromedioHabiles} días hábiles ·
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
                  const borderColors: Record<string, string> = {
                    ALTO: '#ef4444', MEDIO: '#f59e0b', BAJO: '#16a34a'
                  }
                  return (
                    <div
                      className="sm:col-span-2 relative overflow-hidden rounded-xl border bg-white p-5"
                      style={{
                        boxShadow: 'var(--shadow-card)',
                        borderLeftWidth: '4px',
                        borderLeftColor: borderColors[result.riesgoGlobal] ?? '#16a34a',
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Diagnóstico pre-ingreso</p>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex size-10 items-center justify-center rounded-lg',
                          result.riesgoGlobal === 'ALTO' ? 'bg-red-100' :
                          result.riesgoGlobal === 'MEDIO' ? 'bg-amber-100' : 'bg-green-100'
                        )}>
                          <Icon className={cn('size-5', cfg.color)} />
                        </div>
                        <div>
                          <p className={cn('text-2xl font-bold heading-section', cfg.color)}>{cfg.label}</p>
                          <p className="text-xs text-muted-foreground">{result.municipio} · {result.predicciones.length} factores analizados</p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Mes óptimo */}
                <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-primary/4 p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/50 mb-1">Mejor mes</p>
                  <div className="flex items-center gap-2.5 mt-1">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <Calendar className="size-5 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-primary heading-section">{result.mesOptimo}</p>
                  </div>
                  <p className="mt-2 text-[11px] text-primary/50 leading-snug">para ingresar expediente</p>
                </div>
              </div>

              {/* Resumen IA */}
              <div className="rounded-xl border border-border bg-white px-5 py-4" style={{ boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Análisis IA</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{result.resumen}</p>
              </div>

              {/* Predicciones */}
              <div className="rounded-xl border border-border bg-white overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Observaciones probables</p>
                    <p className="text-sm font-semibold text-primary mt-0.5">Ordenadas por probabilidad</p>
                  </div>
                  <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {result.predicciones.length} factores
                  </span>
                </div>

                <div className="divide-y divide-border">
                  {result.predicciones.map((p, i) => {
                    const pct = Math.round(p.probabilidad * 100)
                    const barColor = p.probabilidad >= 0.7
                      ? 'from-red-500 to-red-400'
                      : p.probabilidad >= 0.4
                      ? 'from-amber-500 to-amber-400'
                      : 'from-green-600 to-green-500'
                    const numColor = p.probabilidad >= 0.7
                      ? 'text-red-600'
                      : p.probabilidad >= 0.4
                      ? 'text-amber-600'
                      : 'text-green-700'

                    return (
                      <div key={i} className="px-5 py-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-start gap-2 flex-wrap min-w-0">
                            <span className="text-[11px] font-mono text-muted-foreground/40 mt-0.5 shrink-0">#{i + 1}</span>
                            <span className="text-sm font-semibold text-primary">{p.categoria}</span>
                            {p.frecuenciaLocal && (
                              <span className="rounded-md bg-[oklch(0.78_0.16_78)]/15 border border-[oklch(0.78_0.16_78)]/25 px-2 py-0.5 text-[10px] font-semibold text-[oklch(0.55_0.14_78)]">
                                ★ Frecuente en {result.municipio}
                              </span>
                            )}
                          </div>
                          <span className={cn('shrink-0 text-xl font-bold tabular-nums leading-none', numColor)}>
                            {pct}%
                          </span>
                        </div>

                        {/* Bar */}
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted mb-2.5">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', barColor)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{p.descripcion}</p>
                        <div className="flex items-start gap-2 rounded-lg bg-primary/4 border border-primary/8 px-3 py-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-primary/60 shrink-0 mt-px">Acción</span>
                          <p className="text-xs text-primary/80 leading-relaxed">{p.accion}</p>
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
