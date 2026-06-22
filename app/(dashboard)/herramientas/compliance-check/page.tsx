"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, AlertTriangle, HelpCircle, Loader2, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"

interface CheckResult {
  riesgoGeneral: 'BAJO' | 'MEDIO' | 'ALTO'
  resumen: string
  checks: Array<{
    item: string
    resultado: 'OK' | 'EXCEDIDO' | 'ADVERTENCIA' | 'VERIFICAR'
    detalle: string
    articulo: string
    riesgo: 'BAJO' | 'MEDIO' | 'ALTO'
  }>
  recomendaciones: string[]
}

const RESULTADO_CONFIG = {
  OK: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: '✅ OK' },
  EXCEDIDO: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: '❌ Excedido' },
  ADVERTENCIA: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', label: '⚠️ Advertencia' },
  VERIFICAR: { icon: HelpCircle, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: '🔍 Verificar' },
}

const RIESGO_CONFIG = {
  BAJO: { color: 'text-green-700', bg: 'bg-green-100', label: 'Riesgo bajo' },
  MEDIO: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Riesgo medio' },
  ALTO: { color: 'text-red-700', bg: 'bg-red-100', label: 'Riesgo alto' },
}

export default function ComplianceCheckPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    municipio: '',
    zonaPRC: '',
    superficieTerreno: '',
    superficieConstruida: '',
    huellaEdificacion: '',
    numeroPisos: '',
    alturaEdificacion: '',
    distanciamientoNorte: '',
    distanciamientoSur: '',
    tipoObra: 'permiso_edificacion',
  })

  function setField(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/compliance-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipio: form.municipio,
          zonaPRC: form.zonaPRC || undefined,
          superficieTerreno: Number(form.superficieTerreno),
          superficieConstruida: Number(form.superficieConstruida),
          huellaEdificacion: Number(form.huellaEdificacion),
          numeroPisos: Number(form.numeroPisos),
          alturaEdificacion: Number(form.alturaEdificacion),
          distanciamientoNorte: form.distanciamientoNorte ? Number(form.distanciamientoNorte) : undefined,
          distanciamientoSur: form.distanciamientoSur ? Number(form.distanciamientoSur) : undefined,
          tipoObra: form.tipoObra,
        }),
      })
      const data = await res.json() as CheckResult & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error del servidor')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const fotReal = form.superficieTerreno && form.superficieConstruida
    ? (Number(form.superficieConstruida) / Number(form.superficieTerreno)).toFixed(2)
    : null
  const fosReal = form.superficieTerreno && form.huellaEdificacion
    ? (Number(form.huellaEdificacion) / Number(form.superficieTerreno)).toFixed(2)
    : null

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🔍"
        title="Verificador OGUC"
        breadcrumbs={[
          { label: "IA Normativa" },
          { label: "Verificador OGUC" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
      <form onSubmit={(e) => void handleSubmit(e)}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-primary">Datos del proyecto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Municipality + Zone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Municipio *</Label>
                <Select value={form.municipio} onValueChange={(v) => setField('municipio', v as string)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {COMUNAS_CHILE
                      .slice()
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
                      .map(c => (
                        <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Zona PRC (si la conoces)</Label>
                <Input
                  value={form.zonaPRC}
                  onChange={e => setField('zonaPRC', e.target.value)}
                  placeholder="ej: R2, ZM-3, C-1"
                />
              </div>
            </div>

            {/* Superficies */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Superficie terreno m² *</Label>
                <Input type="number" value={form.superficieTerreno} onChange={e => setField('superficieTerreno', e.target.value)} placeholder="400" required />
              </div>
              <div className="space-y-2">
                <Label>Superficie construida total m² *</Label>
                <Input type="number" value={form.superficieConstruida} onChange={e => setField('superficieConstruida', e.target.value)} placeholder="320" required />
                {fotReal && <p className="text-xs text-muted-foreground">FOT: <strong>{fotReal}</strong></p>}
              </div>
              <div className="space-y-2">
                <Label>Huella planta baja m² *</Label>
                <Input type="number" value={form.huellaEdificacion} onChange={e => setField('huellaEdificacion', e.target.value)} placeholder="160" required />
                {fosReal && <p className="text-xs text-muted-foreground">FOS: <strong>{fosReal}</strong></p>}
              </div>
            </div>

            {/* Pisos y altura */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>N° de pisos *</Label>
                <Input type="number" value={form.numeroPisos} onChange={e => setField('numeroPisos', e.target.value)} placeholder="2" required />
              </div>
              <div className="space-y-2">
                <Label>Altura total m *</Label>
                <Input type="number" step="0.1" value={form.alturaEdificacion} onChange={e => setField('alturaEdificacion', e.target.value)} placeholder="8.5" required />
              </div>
            </div>

            {/* Distanciamientos */}
            <div>
              <Label className="mb-2 block">Distanciamientos a deslindes (opcional)</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Deslinde Norte (m)</Label>
                  <Input type="number" step="0.1" value={form.distanciamientoNorte} onChange={e => setField('distanciamientoNorte', e.target.value)} placeholder="3.0" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Deslinde Sur (m)</Label>
                  <Input type="number" step="0.1" value={form.distanciamientoSur} onChange={e => setField('distanciamientoSur', e.target.value)} placeholder="3.0" />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !form.municipio || !form.superficieTerreno}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              {loading ? (
                <><Loader2 className="size-4 animate-spin" /> Analizando cumplimiento OGUC...</>
              ) : (
                <><ShieldCheck className="size-4" /> Verificar cumplimiento</>
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
          {/* General risk */}
          <Card className={`border-2 ${result.riesgoGeneral === 'BAJO' ? 'border-green-300' : result.riesgoGeneral === 'MEDIO' ? 'border-amber-300' : 'border-red-300'}`}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${RIESGO_CONFIG[result.riesgoGeneral].bg} ${RIESGO_CONFIG[result.riesgoGeneral].color}`}>
                  {RIESGO_CONFIG[result.riesgoGeneral].label}
                </span>
                <p className="text-sm text-gray-700">{result.resumen}</p>
              </div>
            </CardContent>
          </Card>

          {/* Checks */}
          <div className="space-y-2">
            {result.checks.map((check, i) => {
              const cfg = RESULTADO_CONFIG[check.resultado]
              const Icon = cfg.icon
              return (
                <div key={i} className={`flex gap-3 rounded-lg border p-3 ${cfg.bg}`}>
                  <Icon className={`size-5 shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">{check.item}</p>
                      <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{check.detalle}</p>
                    <p className="text-xs text-muted-foreground mt-1">{check.articulo}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Recommendations */}
          {result.recomendaciones.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-primary">Recomendaciones antes de ingresar</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {result.recomendaciones.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
