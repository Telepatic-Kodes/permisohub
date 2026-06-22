"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import { BookText, Download, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ESTADISTICAS_MUNICIPIOS } from "@/lib/municipios-stats"

interface MemoriaResult {
  ok: boolean
  memoria: string
  secciones: string[]
}

const SORTED_MUNICIPIOS = ESTADISTICAS_MUNICIPIOS.slice().sort((a, b) =>
  a.nombre.localeCompare(b.nombre, 'es')
)

// ---------------------------------------------------------------------------
// Markdown renderer — handles the AI-generated memoria format
// ---------------------------------------------------------------------------

function parseBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground/90">{part.slice(2, -2)}</strong>
      : part
  )
}

function MemoriaPreview({ text }: { text: string }) {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let listBuffer: ReactNode[] = []

  function flushList() {
    if (listBuffer.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="mb-3 space-y-0.5 list-none">
        {listBuffer}
      </ul>
    )
    listBuffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trimEnd()

    // Empty line
    if (line.trim() === '') {
      flushList()
      nodes.push(<div key={i} className="h-1.5" />)
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList()
      nodes.push(<hr key={i} className="my-4 border-border" />)
      continue
    }

    // Indented bullet (2+ spaces)
    const indentedMatch = line.match(/^(\s{2,})-\s(.*)/)
    if (indentedMatch) {
      listBuffer.push(
        <li key={i} className="ml-6 text-[11.5px] leading-relaxed text-muted-foreground before:mr-1.5 before:content-['–']">
          {parseBold(indentedMatch[2])}
        </li>
      )
      continue
    }

    // Top-level bullet
    const bulletMatch = line.match(/^-\s(.*)/)
    if (bulletMatch) {
      listBuffer.push(
        <li key={i} className="ml-2 text-[12px] leading-relaxed text-foreground/80 before:mr-2 before:text-primary/30 before:content-['·']">
          {parseBold(bulletMatch[1])}
        </li>
      )
      continue
    }

    // Flush any pending list before block-level elements
    flushList()

    // Section heading: "1. TEXTO EN MAYÚSCULAS" or "## Heading"
    const sectionMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (sectionMatch) {
      nodes.push(
        <h2 key={i} className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[0.1em] text-primary first:mt-0">
          <span className="mr-2 font-mono text-primary/30">{sectionMatch[1]}.</span>
          {sectionMatch[2]}
        </h2>
      )
      continue
    }

    // Main title (all-caps line, no leading number — allows colons like "PROYECTO: CASA TEST")
    if (/^[A-ZÁÉÍÓÚÑ0-9\s:]{6,}$/.test(line.trim()) && !line.trim().startsWith('-')) {
      nodes.push(
        <h1 key={i} className="mb-4 text-[13px] font-bold uppercase tracking-[0.12em] text-primary">
          {line.trim()}
        </h1>
      )
      continue
    }

    // Standalone bold line (the whole line is **text**)
    if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      nodes.push(
        <p key={i} className="mb-1 text-[12px] font-semibold text-foreground/90">
          {line.trim().slice(2, -2)}
        </p>
      )
      continue
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-[12px] leading-relaxed text-foreground/75">
        {parseBold(line)}
      </p>
    )
  }

  flushList()
  return <div className="space-y-0">{nodes}</div>
}

export default function MemoriaDescriptivaPage() {
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<MemoriaResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    proyectoNombre: '',
    direccion: '',
    municipio: '',
    propietario: '',
    tipoObra: 'permiso_edificacion',
    zonaPRC: '',
    superficieTerreno: '',
    superficieConstruida: '',
    superficieExistente: '',
    pisos: '',
    alturaMaxima: '',
    materialEstructura: 'hormigon_armado',
    materialCubierta: 'losa_hormigon',
    usoEdificacion: 'vivienda',
    descripcionProyecto: '',
    arquitecta: '',
  })

  function setField(k: string, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/ai/memoria-descriptiva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proyectoNombre: form.proyectoNombre,
          direccion: form.direccion,
          municipio: form.municipio,
          propietario: form.propietario,
          tipoObra: form.tipoObra,
          zonaPRC: form.zonaPRC,
          superficieTerreno: Number(form.superficieTerreno),
          superficieConstruida: Number(form.superficieConstruida),
          superficieExistente: form.superficieExistente ? Number(form.superficieExistente) : undefined,
          pisos: Number(form.pisos),
          alturaMaxima: Number(form.alturaMaxima),
          materialEstructura: form.materialEstructura,
          materialCubierta: form.materialCubierta,
          usoEdificacion: form.usoEdificacion,
          descripcionProyecto: form.descripcionProyecto,
          arquitecta: form.arquitecta || undefined,
        }),
      })
      const data = (await res.json()) as MemoriaResult & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error del servidor')
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    if (!result) return
    setDownloading(true)
    try {
      const res = await fetch('/api/export/memoria-descriptiva', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memoria: result.memoria,
          proyectoNombre: form.proyectoNombre,
          arquitecta: form.arquitecta || undefined,
        }),
      })
      if (!res.ok) throw new Error('Error al generar PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `memoria-${form.proyectoNombre.replace(/\s+/g, '_').toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📝"
        title="Memoria Descriptiva"
        breadcrumbs={[
          { label: 'IA Normativa' },
          { label: 'Memoria Descriptiva' },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* ── COLUMNA IZQUIERDA: Formulario ── */}
            <div>
              <form onSubmit={(e) => void handleSubmit(e)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-primary">Datos del proyecto</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      IA genera la memoria técnica completa en segundos
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">

                    {/* Nombre proyecto */}
                    <div className="space-y-2">
                      <Label>Nombre del proyecto *</Label>
                      <Input
                        value={form.proyectoNombre}
                        onChange={(e) => setField('proyectoNombre', e.target.value)}
                        placeholder="Casa Familia García"
                        required
                      />
                    </div>

                    {/* Dirección + municipio */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dirección *</Label>
                        <Input
                          value={form.direccion}
                          onChange={(e) => setField('direccion', e.target.value)}
                          placeholder="Av. Las Flores 123"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Municipio *</Label>
                        <Select
                          value={form.municipio}
                          onValueChange={(v) => setField('municipio', v ?? '')}
                        >
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            {SORTED_MUNICIPIOS.map((m) => (
                              <SelectItem key={m.nombre} value={m.nombre}>{m.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Propietario */}
                    <div className="space-y-2">
                      <Label>Propietario *</Label>
                      <Input
                        value={form.propietario}
                        onChange={(e) => setField('propietario', e.target.value)}
                        placeholder="Juan García Pérez"
                        required
                      />
                    </div>

                    {/* Tipo de obra + zona PRC */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de obra *</Label>
                        <Select
                          value={form.tipoObra}
                          onValueChange={(v) => setField('tipoObra', v ?? '')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permiso_edificacion">Permiso Edificación</SelectItem>
                            <SelectItem value="ampliacion">Ampliación</SelectItem>
                            <SelectItem value="regularizacion">Regularización</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Zona PRC *</Label>
                        <Input
                          value={form.zonaPRC}
                          onChange={(e) => setField('zonaPRC', e.target.value)}
                          placeholder="R2, ZM-3, C-1..."
                          required
                        />
                      </div>
                    </div>

                    {/* Superficies */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Sup. terreno m² *</Label>
                        <Input
                          type="number"
                          value={form.superficieTerreno}
                          onChange={(e) => setField('superficieTerreno', e.target.value)}
                          placeholder="400"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sup. a construir m² *</Label>
                        <Input
                          type="number"
                          value={form.superficieConstruida}
                          onChange={(e) => setField('superficieConstruida', e.target.value)}
                          placeholder="320"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Sup. existente m²</Label>
                        <Input
                          type="number"
                          value={form.superficieExistente}
                          onChange={(e) => setField('superficieExistente', e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Pisos + altura */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>N° pisos *</Label>
                        <Input
                          type="number"
                          value={form.pisos}
                          onChange={(e) => setField('pisos', e.target.value)}
                          placeholder="2"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Altura máxima m *</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={form.alturaMaxima}
                          onChange={(e) => setField('alturaMaxima', e.target.value)}
                          placeholder="8.5"
                          required
                        />
                      </div>
                    </div>

                    {/* Material estructura + cubierta + uso */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Estructura *</Label>
                        <Select
                          value={form.materialEstructura}
                          onValueChange={(v) => setField('materialEstructura', v ?? '')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hormigon_armado">Hormigón armado</SelectItem>
                            <SelectItem value="albañileria">Albañilería</SelectItem>
                            <SelectItem value="madera">Madera</SelectItem>
                            <SelectItem value="metalica">Metálica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cubierta *</Label>
                        <Select
                          value={form.materialCubierta}
                          onValueChange={(v) => setField('materialCubierta', v ?? '')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zinc">Zinc</SelectItem>
                            <SelectItem value="teja">Teja</SelectItem>
                            <SelectItem value="losa_hormigon">Losa hormigón</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Uso *</Label>
                        <Select
                          value={form.usoEdificacion}
                          onValueChange={(v) => setField('usoEdificacion', v ?? '')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vivienda">Vivienda</SelectItem>
                            <SelectItem value="comercio">Comercio</SelectItem>
                            <SelectItem value="oficina">Oficina</SelectItem>
                            <SelectItem value="bodega">Bodega</SelectItem>
                            <SelectItem value="mixto">Mixto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Arquitecta */}
                    <div className="space-y-2">
                      <Label>Arquitecta responsable</Label>
                      <Input
                        value={form.arquitecta}
                        onChange={(e) => setField('arquitecta', e.target.value)}
                        placeholder="Estefanía Parada (por defecto)"
                      />
                    </div>

                    {/* Descripción adicional */}
                    <div className="space-y-2">
                      <Label>Descripción adicional del proyecto</Label>
                      <Textarea
                        value={form.descripcionProyecto}
                        onChange={(e) => setField('descripcionProyecto', e.target.value)}
                        placeholder="Descripción breve del programa arquitectónico, orientación, contexto..."
                        rows={3}
                      />
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={
                        loading ||
                        !form.proyectoNombre ||
                        !form.municipio ||
                        !form.propietario ||
                        !form.superficieTerreno ||
                        !form.superficieConstruida
                      }
                      className="w-full bg-primary text-white hover:bg-primary/90"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generando memoria con IA...
                        </>
                      ) : (
                        <>
                          <BookText className="size-4" />
                          Generar con IA
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </form>
            </div>

            {/* ── COLUMNA DERECHA: Preview ── */}
            <div className="flex flex-col gap-4">
              {result ? (
                <>
                  {/* Secciones detectadas */}
                  {result.secciones.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.secciones.map((s, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Botón descargar */}
                  <Button
                    variant="outline"
                    onClick={() => void handleDownload()}
                    disabled={downloading}
                    className="self-start"
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generando PDF...
                      </>
                    ) : (
                      <>
                        <Download className="size-4" />
                        Descargar PDF
                      </>
                    )}
                  </Button>

                  {/* Texto de la memoria */}
                  <Card className="flex-1">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-primary">Vista previa</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[600px] overflow-y-auto rounded-md border border-border bg-muted/20 p-5">
                        <MemoriaPreview text={result.memoria} />
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-primary/20 bg-white/60 px-8 py-16 text-center" style={{ minHeight: 420 }}>
                  {/* Blueprint illustration */}
                  <div className="relative mb-6 flex size-20 items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl border-2 border-primary/12 bg-primary/4" />
                    <div className="absolute inset-3 rounded-xl border border-primary/10" />
                    <BookText className="relative size-8 text-primary/40" />
                  </div>

                  <p className="heading-section text-base text-primary/70 mb-1">
                    Memoria Descriptiva
                  </p>
                  <p className="text-xs text-muted-foreground mb-8 max-w-[220px] leading-relaxed">
                    Completa el formulario y genera el documento técnico oficial en segundos
                  </p>

                  {/* Steps */}
                  <div className="w-full max-w-[260px] space-y-3 text-left">
                    {[
                      { n: '01', label: 'Antecedentes del proyecto' },
                      { n: '02', label: 'Descripción de la obra' },
                      { n: '03', label: 'Cuadro de superficies' },
                      { n: '04', label: 'Estructura y materialidad' },
                      { n: '05', label: 'Cumplimiento normativo' },
                    ].map((step) => (
                      <div key={step.n} className="flex items-center gap-3">
                        <span className="shrink-0 font-mono text-[10px] font-bold text-primary/25">{step.n}</span>
                        <div className="h-px flex-1 border-t border-dashed border-primary/15" />
                        <span className="text-[11px] text-muted-foreground/60">{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
