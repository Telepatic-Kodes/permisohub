"use client"

import { useRef, useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
  FileSearch,
  Upload,
  X,
  FileText,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ESTADISTICAS_MUNICIPIOS } from "@/lib/municipios-stats"
import { Num } from "@/components/arch/dato"
import { EstadoNormativo, colorDeVeredicto, type Veredicto } from "@/components/arch/estado"

interface DocumentoAuditado {
  nombre: string
  tipoInferido: string
  estado: "OK" | "FALTA" | "INCOMPLETO" | "VERIFICAR"
  observaciones: string[]
  recomendacion: string
}

interface AuditResult {
  ok: boolean
  municipio: string
  tipoObra: string
  documentos: DocumentoAuditado[]
  documentosFaltantes: string[]
  puntaje: number
  aptoParaIngreso: boolean
  resumen: string
}

const ESTADO_CONFIG: Record<DocumentoAuditado["estado"], { icon: typeof CheckCircle2; label: string; veredicto: Veredicto }> = {
  OK: { icon: CheckCircle2, label: "OK", veredicto: "cumple" },
  FALTA: { icon: AlertCircle, label: "Falta", veredicto: "rechaza" },
  INCOMPLETO: { icon: AlertTriangle, label: "Incompleto", veredicto: "observa" },
  VERIFICAR: { icon: HelpCircle, label: "Verificar", veredicto: "neutro" },
}

const TIPOS_OBRA = [
  { value: "permiso_edificacion", label: "Permiso de Edificación" },
  { value: "permiso_ampliacion", label: "Permiso de Ampliación" },
  { value: "permiso_alteracion", label: "Permiso de Alteración" },
  { value: "permiso_demolicion", label: "Permiso de Demolición" },
  { value: "regularizacion", label: "Regularización de Obra" },
  { value: "recepcion_obras", label: "Recepción de Obras" },
  { value: "cambio_destino", label: "Cambio de Destino" },
  { value: "subdivision", label: "Subdivisión de Predio" },
]

function getPuntajeColor(puntaje: number): string {
  if (puntaje >= 80) return "#16a34a"
  if (puntaje >= 60) return "#d97706"
  return "#dc2626"
}

function AuditorPageInner() {
  const searchParams = useSearchParams()
  const proyectoId = searchParams.get("proyectoId")
  const [files, setFiles] = useState<File[]>([])
  const [municipio, setMunicipio] = useState("")
  const [tipoObra, setTipoObra] = useState("permiso_edificacion")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!proyectoId) return
    fetch(`/api/proyectos/${proyectoId}`)
      .then((r) => r.json())
      .then((data: { proyecto?: { municipio?: string; tipo?: string } }) => {
        if (data.proyecto?.municipio) setMunicipio(data.proyecto.municipio)
        if (data.proyecto?.tipo) setTipoObra(data.proyecto.tipo)
      })
      .catch(() => undefined)
  }, [proyectoId])

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"))
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      const unique = pdfs.filter((f) => !existingNames.has(f.name))
      return [...prev, ...unique]
    })
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0 || !municipio) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("municipio", municipio)
      formData.append("tipoObra", tipoObra)
      for (const file of files) {
        formData.append("files", file)
      }

      const res = await fetch("/api/ai/audit-expediente", {
        method: "POST",
        body: formData,
      })
      const data = (await res.json()) as AuditResult & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? "Error del servidor")
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  const puntajeColor = result ? getPuntajeColor(result.puntaje) : "#6b7280"
  const puntajeDeg = result ? (result.puntaje / 100) * 360 : 0

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📁"
        title="Revisor de Expediente"
        breadcrumbs={[
          { label: "IA Normativa" },
          { label: "Auditor de Expediente" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-end justify-between gap-4 border-b border-line-med pb-4">
            <div>
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Auditoría de expediente · pre-ingreso
              </p>
              <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
                Revisor de expediente
              </h2>
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-[4px] border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Configuración del trámite
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Municipio + Tipo obra */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Municipio (DOM) *</Label>
                    <Select value={municipio} onValueChange={(v) => setMunicipio(v ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADISTICAS_MUNICIPIOS
                          .slice()
                          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                          .map((m) => (
                            <SelectItem key={m.nombre} value={m.nombre}>
                              {m.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de obra *</Label>
                    <Select value={tipoObra} onValueChange={(v) => setTipoObra(v ?? "permiso_edificacion")}>
                      <SelectTrigger>
                        <SelectValue />
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
                </div>

                {/* Drop zone */}
                <div className="space-y-2">
                  <Label>Documentos del expediente (PDF) *</Label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click() }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
                      isDragging
                        ? "border-[var(--blueprint)] bg-[var(--blueprint)]/[0.05]"
                        : "border-line-med hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
                    }`}
                  >
                    <Upload className="size-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      Arrastra los PDFs aquí o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sube todos los documentos del expediente — memoria, planos, CIP, etc.
                    </p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                  </div>
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      <Num>{files.length}</Num> archivo{files.length !== 1 ? "s" : ""} seleccionado{files.length !== 1 ? "s" : ""}
                    </p>
                    <div className="space-y-1.5">
                      {files.map((file, i) => (
                        <div
                          key={`${file.name}-${i}`}
                          className="flex items-center gap-2.5 rounded-[3px] border border-line-fine bg-card px-3 py-2"
                        >
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate text-sm text-foreground">{file.name}</span>
                          <span className="num text-xs text-muted-foreground shrink-0">
                            <Num>{(file.size / 1024).toFixed(0)}</Num> KB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading || !municipio || files.length === 0}
                  className="w-full bg-primary text-white hover:bg-primary/90"
                >
                  {loading ? (
                    <><Loader2 className="size-4 animate-spin" /> Auditando expediente...</>
                  ) : (
                    <><FileSearch className="size-4" /> Auditar expediente</>
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
              {/* Score + Badge */}
              <div className="rounded-[4px] border border-line-fine bg-card p-6">
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
                  {/* Circular score */}
                  <div className="relative flex shrink-0 items-center justify-center">
                    <div
                      className="size-28 rounded-full flex items-center justify-center"
                      style={{
                        background: `conic-gradient(${puntajeColor} ${puntajeDeg}deg, var(--muted) ${puntajeDeg}deg)`,
                      }}
                    >
                      <div className="size-20 rounded-full bg-card flex flex-col items-center justify-center">
                        <span className="num text-2xl font-semibold leading-none" style={{ color: puntajeColor }}>
                          {result.puntaje}
                        </span>
                        <span className="num text-xs text-muted-foreground/70">/ 100</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 text-center sm:text-left">
                    <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                      Veredicto de aptitud
                    </p>
                    <div>
                      <EstadoNormativo
                        estado={result.aptoParaIngreso ? "cumple" : "rechaza"}
                        label={result.aptoParaIngreso ? "Apto para ingreso" : "Faltan documentos"}
                      />
                    </div>
                    <p className="text-sm text-foreground/80">{result.resumen}</p>
                    <p className="text-xs text-muted-foreground">
                      DOM: <strong>{result.municipio}</strong> · Trámite:{" "}
                      <strong>
                        {TIPOS_OBRA.find((t) => t.value === result.tipoObra)?.label ?? result.tipoObra}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Documentos auditados */}
              {result.documentos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Documentos analizados</h3>
                    <div className="h-px flex-1 bg-line-fine" />
                    <span className="num text-[10px] text-muted-foreground/60">{String(result.documentos.length).padStart(2, "0")}</span>
                  </div>
                  {result.documentos.map((doc, i) => {
                    const cfg = ESTADO_CONFIG[doc.estado] ?? ESTADO_CONFIG.VERIFICAR
                    const Icon = cfg.icon
                    return (
                      <div key={i} className="flex gap-3 rounded-[4px] border border-line-fine bg-card p-3">
                        <Icon className="size-5 shrink-0 mt-0.5" style={{ color: colorDeVeredicto(cfg.veredicto) }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{doc.nombre}</p>
                              <p className="text-xs text-muted-foreground">{doc.tipoInferido}</p>
                            </div>
                            <EstadoNormativo estado={cfg.veredicto} label={cfg.label} dot={false} className="shrink-0" />
                          </div>
                          {doc.observaciones.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {doc.observaciones.map((obs, j) => (
                                <li key={j} className="text-xs text-muted-foreground">• {obs}</li>
                              ))}
                            </ul>
                          )}
                          {doc.recomendacion && (
                            <p className="mt-1 text-xs text-muted-foreground/80 italic">{doc.recomendacion}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Documentos faltantes */}
              {result.documentosFaltantes.length > 0 && (
                <div className="rounded-[4px] border border-line-fine bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <EstadoNormativo estado="rechaza" label="Documentos faltantes" dot={false} />
                    <span className="num text-xs text-muted-foreground">
                      <Num>{result.documentosFaltantes.length}</Num>
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {result.documentosFaltantes.map((doc, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                        <X className="size-3.5 shrink-0" style={{ color: "var(--state-error)" }} />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AuditorPage() {
  return (
    <Suspense>
      <AuditorPageInner />
    </Suspense>
  )
}
