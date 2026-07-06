"use client"

import { useState } from "react"
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"
import { Num } from "@/components/arch/dato"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"

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

const RESULTADO_CONFIG: Record<CheckResult['checks'][number]['resultado'], { estado: Veredicto; label: string }> = {
  OK: { estado: 'cumple', label: 'OK' },
  EXCEDIDO: { estado: 'rechaza', label: 'Excedido' },
  ADVERTENCIA: { estado: 'observa', label: 'Advertencia' },
  VERIFICAR: { estado: 'neutro', label: 'Verificar' },
}

const RIESGO_CONFIG: Record<CheckResult['riesgoGeneral'], { estado: Veredicto; label: string }> = {
  BAJO: { estado: 'cumple', label: 'Riesgo bajo' },
  MEDIO: { estado: 'observa', label: 'Riesgo medio' },
  ALTO: { estado: 'rechaza', label: 'Riesgo alto' },
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
        title="Verificador Normativo"
        breadcrumbs={[
          { label: "Herramientas" },
          { label: "Verificador Normativo" },
        ]}
      />
      <div className="bg-blueprint-grid flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
      {/* Cabecera en-contenido */}
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-line-med pb-4">
        <div>
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            Herramientas · OGUC
          </p>
          <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
            Verificador normativo de cumplimiento
          </h2>
        </div>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <Card className="rounded-[4px] border-line-fine shadow-none">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Datos del proyecto</h3>
              <div className="h-px flex-1 bg-line-fine" />
              <span className="num text-[10px] text-muted-foreground/60">01</span>
            </div>
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
                {fotReal && <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">FOT calculado <Num className="ml-1 text-xs font-semibold text-foreground/80">{fotReal}</Num></p>}
              </div>
              <div className="space-y-2">
                <Label>Huella planta baja m² *</Label>
                <Input type="number" value={form.huellaEdificacion} onChange={e => setField('huellaEdificacion', e.target.value)} placeholder="160" required />
                {fosReal && <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">FOS calculado <Num className="ml-1 text-xs font-semibold text-foreground/80">{fosReal}</Num></p>}
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
              className="w-full rounded-[3px] bg-primary text-white hover:bg-primary/90"
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
        <div className="flex items-start gap-3 rounded-[4px] border border-line-fine p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0" style={{ color: "var(--state-error)" }} />
          <p className="text-sm text-foreground/80">{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* General risk */}
          <Card className="rounded-[4px] border-line-strong shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <EstadoNormativo
                  estado={RIESGO_CONFIG[result.riesgoGeneral].estado}
                  label={RIESGO_CONFIG[result.riesgoGeneral].label}
                  className="shrink-0"
                />
                <p className="text-sm text-foreground/80">{result.resumen}</p>
              </div>
            </CardContent>
          </Card>

          {/* Checks */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Verificaciones OGUC
              </h3>
              <div className="h-px flex-1 bg-line-fine" />
              <span className="num text-[10px] text-muted-foreground/60">
                {result.checks.length.toString().padStart(2, "0")}
              </span>
            </div>
            <div className="space-y-2">
              {result.checks.map((check, i) => {
                const cfg = RESULTADO_CONFIG[check.resultado]
                return (
                  <div key={i} className="flex flex-col gap-2 rounded-[4px] border border-line-fine bg-card p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{check.item}</p>
                      <EstadoNormativo estado={cfg.estado} label={cfg.label} className="shrink-0" />
                    </div>
                    <p className="text-sm text-foreground/70">{check.detalle}</p>
                    <p className="num text-[11px] text-muted-foreground">{check.articulo}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendations */}
          {result.recomendaciones.length > 0 && (
            <Card className="rounded-[4px] border-line-fine shadow-none">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Recomendaciones antes de ingresar
                  </h3>
                  <div className="h-px flex-1 bg-line-fine" />
                  <span className="num text-[10px] text-muted-foreground/60">
                    {result.recomendaciones.length.toString().padStart(2, "0")}
                  </span>
                </div>
                <ul className="divide-y divide-line-fine rounded-[4px] border border-line-fine bg-card">
                  {result.recomendaciones.map((rec, i) => (
                    <li key={i} className="flex gap-2.5 px-4 py-2.5 text-sm text-foreground/80">
                      <span className="num shrink-0 text-[10px] text-muted-foreground/60">
                        {(i + 1).toString().padStart(2, "0")}
                      </span>
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
