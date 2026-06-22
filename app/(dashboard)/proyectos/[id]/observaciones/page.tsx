"use client"

import { useState, use } from "react"
import { Upload, FileText, AlertCircle, CheckCircle2, AlertTriangle, Loader2, Wand2, Copy, ChevronDown, ChevronUp, MessageCircle, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ESTADISTICAS_MUNICIPIOS } from "@/lib/municipios-stats"
import { MOCK_PROYECTOS } from "@/lib/mock-data"

interface Observacion {
  numero: number
  texto: string
  articuloCitado: string | null
  tipo: 'TECNICA' | 'FORMAL' | 'DOCUMENTOS'
  gravedad: 'ALTA' | 'MEDIA' | 'BAJA'
  respuestaGenerada?: string
  loadingRespuesta?: boolean
  expandida?: boolean
}

interface ExtractionResult {
  ok: boolean
  fileName: string
  observaciones: Observacion[]
  municipio: string | null
  expediente: string | null
  fechaOrdinario: string | null
  plazoRespuesta: number | null
  error?: string
}

const GRAVEDAD_CONFIG = {
  ALTA: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', label: 'Alta' },
  MEDIA: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', label: 'Media' },
  BAJA: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', label: 'Baja' },
}

const TIPO_LABELS: Record<string, string> = {
  TECNICA: 'Técnica',
  FORMAL: 'Formal',
  DOCUMENTOS: 'Documentos',
}

export default function ObservacionesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState<Observacion[]>([])
  const [copied, setCopied] = useState<number | null>(null)
  const [notificando, setNotificando] = useState(false)
  const [notificadoOk, setNotificadoOk] = useState(false)

  const proyecto = MOCK_PROYECTOS.find(p => p.id === id)
  const municipioStats = result?.municipio
    ? ESTADISTICAS_MUNICIPIOS.find(m => m.nombre === result.municipio)
    : null

  async function processFile(file: File) {
    if (!file.name.endsWith('.pdf')) {
      setError('Solo se aceptan archivos PDF')
      return
    }
    setUploading(true)
    setError(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/ai/extract-observations', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json() as ExtractionResult
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error del servidor')
      setResult(data)
      setObservaciones(data.observaciones.map(o => ({ ...o, expandida: true })))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
  }

  async function generateResponse(index: number) {
    const obs = observaciones[index]
    setObservaciones(prev => prev.map((o, i) => i === index ? { ...o, loadingRespuesta: true } : o))

    try {
      const res = await fetch('/api/ai/observation-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observacionTexto: obs.texto,
          proyectoNombre: `Proyecto ${id}`,
          municipio: result?.municipio ?? 'No especificado',
          tipoPermiso: 'Permiso de edificación',
          numeroExpediente: result?.expediente ?? undefined,
        }),
      })
      const data = await res.json() as { ok: boolean; respuesta?: string; error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'Error')

      setObservaciones(prev => prev.map((o, i) =>
        i === index ? { ...o, respuestaGenerada: data.respuesta, loadingRespuesta: false } : o
      ))
    } catch {
      setObservaciones(prev => prev.map((o, i) =>
        i === index ? { ...o, loadingRespuesta: false } : o
      ))
    }
  }

  async function generateAllResponses() {
    for (let i = 0; i < observaciones.length; i++) {
      if (!observaciones[i].respuestaGenerada) {
        await generateResponse(i)
      }
    }
  }

  async function notificarCliente() {
    const telefono = proyecto?.cliente?.telefono ?? proyecto?.cliente?.email
    if (!telefono || !result) return
    setNotificando(true)
    try {
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono,
          tipo: 'con_observaciones',
          proyectoNombre: proyecto?.nombre ?? 'Proyecto',
          municipio: result.municipio ?? 'la DOM',
          mensaje: `${observaciones.length} observaciones — plazo: ${result.plazoRespuesta ?? '?'} días hábiles`,
          arquitecta: 'Estefanía Parada',
        }),
      })
      const data = await res.json() as { ok: boolean; configured?: boolean }
      if (data.ok || data.configured === false) setNotificadoOk(true)
    } finally {
      setNotificando(false)
    }
  }

  async function descargarCarta() {
    if (!result) return
    const res = await fetch('/api/export/carta-respuesta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proyectoNombre: `Proyecto ${id}`,
        municipio: result.municipio ?? 'la DOM',
        expediente: result.expediente,
        fechaOrdinario: result.fechaOrdinario,
        plazoRespuesta: result.plazoRespuesta,
        observaciones,
      }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `carta-respuesta-${result.expediente ?? 'dom'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyToClipboard(text: string, index: number) {
    void navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  function toggleExpand(index: number) {
    setObservaciones(prev => prev.map((o, i) =>
      i === index ? { ...o, expandida: !o.expandida } : o
    ))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#1A3328] text-white">
            <FileText className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
              Observaciones DOM
            </h1>
            <p className="text-sm text-muted-foreground">
              Sube el ordinario de observaciones — IA extrae y genera respuestas
            </p>
          </div>
        </div>
        <Link href={`/proyectos/${id}`}>
          <Button variant="outline" size="sm">← Volver al proyecto</Button>
        </Link>
      </div>

      {/* Upload zone */}
      {!result && (
        <div
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
            dragging ? 'border-[#1A3328] bg-[#1A3328]/5' : 'border-border hover:border-[#1A3328]/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-10 animate-spin text-[#1A3328]" />
              <p className="font-medium text-[#1A3328]">Analizando PDF con IA...</p>
              <p className="text-sm text-muted-foreground">Extrayendo observaciones del ordinario DOM</p>
            </div>
          ) : (
            <>
              <Upload className="size-10 text-muted-foreground mb-3" />
              <p className="font-medium text-[#1A3328] mb-1">
                Arrastra el PDF del ordinario de observaciones
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                o haz clic para seleccionar el archivo
              </p>
              <label className="cursor-pointer">
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
                <span className="rounded-lg bg-[#1A3328] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A3328]/90">
                  Seleccionar PDF
                </span>
              </label>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="size-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary card */}
          <Card className="border-[#1A3328]/20 bg-[#F9F7F3]">
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileText className="size-4 text-[#1A3328]" />
                <span className="text-sm font-medium text-[#1A3328]">{result.fileName}</span>
                <Badge variant="outline">{observaciones.length} observaciones</Badge>
                {result.municipio && <Badge variant="outline">{result.municipio}</Badge>}
                {result.expediente && <Badge variant="outline">Exp. {result.expediente}</Badge>}
                {result.plazoRespuesta && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                    {result.plazoRespuesta} días hábiles para responder
                  </Badge>
                )}
                <div className="ml-auto flex gap-2 flex-wrap justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setResult(null); setObservaciones([]); setNotificadoOk(false) }}
                  >
                    Subir otro PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={notificando || notificadoOk}
                    onClick={() => void notificarCliente()}
                    className="border-green-300 text-green-700 hover:bg-green-50"
                  >
                    {notificadoOk ? (
                      <><CheckCircle2 className="size-3.5 mr-1.5 text-green-600" /> Cliente notificado</>
                    ) : notificando ? (
                      <><Loader2 className="size-3.5 animate-spin mr-1.5" /> Enviando...</>
                    ) : (
                      <><MessageCircle className="size-3.5 mr-1.5" /> Notificar cliente</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={observaciones.every(o => !o.respuestaGenerada)}
                    onClick={() => void descargarCarta()}
                    className="border-blue-300 text-blue-700 hover:bg-blue-50"
                  >
                    <FileDown className="size-3.5 mr-1.5" />
                    Descargar carta formal
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
                    onClick={() => void generateAllResponses()}
                  >
                    <Wand2 className="size-3.5 mr-1.5" />
                    Responder todas con IA
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Indicador inteligencia municipal */}
          {municipioStats && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-800 mb-1">
                Inteligencia DOM — {result?.municipio}
              </p>
              <p className="text-amber-700 text-xs leading-relaxed">
                {Math.round(municipioStats.tasaObservaciones * 100)}% de proyectos reciben observaciones en este municipio.
                {municipioStats.tiposObservacionFrequentes.length > 0 && (
                  <> Observaciones frecuentes: {municipioStats.tiposObservacionFrequentes.slice(0, 3).join(', ')}.</>
                )}
              </p>
            </div>
          )}

          {observaciones.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-10 text-green-600" />
              <p className="font-medium text-green-700">No se encontraron observaciones en este documento</p>
              <p className="text-sm text-muted-foreground">El documento podría ser una aprobación o un tipo de ordinario diferente</p>
            </div>
          )}

          {/* Observations */}
          <div className="space-y-3">
            {observaciones.map((obs, i) => {
              const cfg = GRAVEDAD_CONFIG[obs.gravedad]
              return (
                <Card key={i} className={`border ${cfg.bg}`}>
                  <CardHeader className="pb-2 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[#1A3328]">Obs. {obs.numero}</span>
                        <Badge className={cfg.badge}>{cfg.label}</Badge>
                        <Badge variant="outline" className="text-xs">{TIPO_LABELS[obs.tipo]}</Badge>
                        {obs.articuloCitado && (
                          <span className="text-xs text-muted-foreground">{obs.articuloCitado}</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleExpand(i)}
                        className="text-muted-foreground hover:text-[#1A3328]"
                      >
                        {obs.expandida ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>
                    </div>
                  </CardHeader>

                  {obs.expandida && (
                    <CardContent className="space-y-3 pt-0">
                      {/* Original observation text */}
                      <div className="rounded-lg bg-white/70 border border-current/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Texto de la observación</p>
                        <p className="text-sm text-gray-800" style={{ whiteSpace: 'pre-wrap' }}>{obs.texto}</p>
                      </div>

                      {/* Generate response button */}
                      {!obs.respuestaGenerada && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={obs.loadingRespuesta}
                          onClick={() => void generateResponse(i)}
                          className="border-[#1A3328]/30 text-[#1A3328] hover:bg-[#1A3328]/5"
                        >
                          {obs.loadingRespuesta ? (
                            <><Loader2 className="size-3.5 animate-spin mr-1.5" />Generando respuesta...</>
                          ) : (
                            <><Wand2 className="size-3.5 mr-1.5" />Generar respuesta con IA</>
                          )}
                        </Button>
                      )}

                      {/* Generated response */}
                      {obs.respuestaGenerada && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#1A3328]">Respuesta generada por IA</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(obs.respuestaGenerada!, i)}
                              className="h-7 text-xs"
                            >
                              {copied === i ? (
                                <><CheckCircle2 className="size-3.5 text-green-600" /> Copiado</>
                              ) : (
                                <><Copy className="size-3.5" /> Copiar</>
                              )}
                            </Button>
                          </div>
                          <div className="rounded-lg bg-white border border-[#1A3328]/10 p-3">
                            <p className="text-sm text-gray-800 leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
                              {obs.respuestaGenerada}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void generateResponse(i)}
                            className="text-xs text-muted-foreground"
                          >
                            <Wand2 className="size-3.5 mr-1" /> Regenerar
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
