"use client"

import { useCallback, useRef, useState } from "react"
import {
  AlertCircle,
  Download,
  FileJson,
  ImagePlus,
  Loader2,
  PencilRuler,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Num } from "@/components/arch/dato"
import { cn } from "@/lib/utils"
import {
  CONVENCION_LINEA,
  SEVERIDAD_COLOR,
  colorDeMarca,
  type Anotacion,
  type LaminaAnotada,
  type Severidad,
} from "@/lib/anotacion-convenciones"

interface Lamina {
  id: string
  nombre: string
  dataUrl: string
}

interface ApiResult {
  ok: boolean
  laminas: LaminaAnotada[]
  error?: string
}

const SEVERIDAD_LABEL: Record<Severidad, string> = {
  "crítica": "Crítica",
  "media": "Media",
  "menor": "Menor",
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
    reader.readAsDataURL(file)
  })
}

// Rasteriza cada página de un PDF a imagen PNG (client-side, sin subir el PDF).
// Así una lámina en PDF entra al mismo pipeline de visión que una imagen.
async function pdfToImages(file: File): Promise<{ nombre: string; dataUrl: string }[]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const out: { nombre: string; dataUrl: string }[] = []
  const base = file.name.replace(/\.pdf$/i, "")
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")
    if (!ctx) continue
    await page.render({ canvasContext: ctx, viewport }).promise
    out.push({
      nombre: doc.numPages > 1 ? `${base} · lámina ${i}` : `${base}`,
      dataUrl: canvas.toDataURL("image/png"),
    })
  }
  return out
}

export default function AnotacionPlanoPage() {
  const [laminas, setLaminas] = useState<Lamina[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const [observaciones, setObservaciones] = useState("")
  const [contexto, setContexto] = useState("")
  const [anotacionesPorLamina, setAnotacionesPorLamina] = useState<Record<string, Anotacion[]>>({})
  const [selectedAnotacion, setSelectedAnotacion] = useState<string | null>(null)
  const [hoverAnotacion, setHoverAnotacion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ anotacionId: string; dx: number; dy: number } | null>(null)

  const activeLamina = laminas.find((l) => l.id === activeId) ?? null
  const activeAnotaciones = activeId ? (anotacionesPorLamina[activeId] ?? []) : []

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setError(null)
      const list = Array.from(files)
      const imgs = list.filter((f) => f.type.startsWith("image/"))
      const pdfs = list.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name))
      if (imgs.length === 0 && pdfs.length === 0) {
        setError("Sube láminas en imagen (PNG/JPG) o PDF.")
        return
      }
      setLoading(true)
      try {
        const desdeImgs = await Promise.all(
          imgs.map(async (f) => ({ nombre: f.name, dataUrl: await readFileAsDataUrl(f) })),
        )
        const desdePdfs = (await Promise.all(pdfs.map((f) => pdfToImages(f)))).flat()
        const nuevas: Lamina[] = [...desdeImgs, ...desdePdfs].map((n, i) => ({
          id: `lam-${Date.now()}-${i}`,
          nombre: n.nombre,
          dataUrl: n.dataUrl,
        }))
        setLaminas((prev) => {
          const merged = [...prev, ...nuevas].slice(0, 6)
          if (!activeId && merged.length > 0) setActiveId(merged[0].id)
          return merged
        })
      } catch {
        setError("No se pudieron procesar los archivos (¿PDF dañado o protegido?)")
      } finally {
        setLoading(false)
      }
    },
    [activeId],
  )

  function removeLamina(id: string) {
    setLaminas((prev) => prev.filter((l) => l.id !== id))
    setAnotacionesPorLamina((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (activeId === id) {
      setActiveId((prev) => {
        const rest = laminas.filter((l) => l.id !== prev)
        return rest[0]?.id ?? ""
      })
    }
  }

  async function handleAnalizar() {
    if (laminas.length === 0) {
      setError("Sube al menos una lámina para analizar")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/anotacion-plano", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          laminas: laminas.map((l) => ({ id: l.id, nombre: l.nombre, dataUrl: l.dataUrl })),
          observaciones: observaciones.trim() || undefined,
          contexto: contexto.trim() || undefined,
        }),
      })
      const data = (await res.json()) as ApiResult
      if (!res.ok || data.error) throw new Error(data.error ?? "Error del servidor")
      const map: Record<string, Anotacion[]> = {}
      for (const lam of data.laminas) map[lam.id] = lam.anotaciones
      setAnotacionesPorLamina(map)
      const first = data.laminas.find((l) => l.anotaciones.length > 0)
      if (first) setActiveId(first.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  // ---- Arrastre manual de marcas (corrección de ubicación) ----
  function onMarkPointerDown(e: React.PointerEvent, a: Anotacion) {
    e.stopPropagation()
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelectedAnotacion(a.id)
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    dragRef.current = { anotacionId: a.id, dx: px - a.bbox.x, dy: py - a.bbox.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onMarkPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    const rect = overlayRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height
    setAnotacionesPorLamina((prev) => {
      const list = prev[activeId] ?? []
      return {
        ...prev,
        [activeId]: list.map((it) =>
          it.id === drag.anotacionId
            ? {
                ...it,
                bbox: {
                  ...it.bbox,
                  x: Math.min(1 - it.bbox.w, Math.max(0, px - drag.dx)),
                  y: Math.min(1 - it.bbox.h, Math.max(0, py - drag.dy)),
                },
              }
            : it,
        ),
      }
    })
  }

  function onMarkPointerUp() {
    dragRef.current = null
  }

  // ---- Export PNG con las marcas quemadas sobre la lámina ----
  async function exportPNG() {
    if (!activeLamina) return
    const img = new Image()
    img.src = activeLamina.dataUrl
    await new Promise((r) => {
      img.onload = r
    })
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const W = canvas.width
    const H = canvas.height
    ctx.lineWidth = Math.max(2, W * 0.003)
    ctx.font = `${Math.max(14, W * 0.014)}px sans-serif`
    activeAnotaciones.forEach((a, i) => {
      const color = colorDeMarca(a.convencionLinea, a.severidad)
      const x = a.bbox.x * W
      const y = a.bbox.y * H
      const w = a.bbox.w * W
      const h = a.bbox.h * H
      ctx.strokeStyle = color
      ctx.setLineDash(a.convencionLinea ? [W * 0.012, W * 0.008] : [])
      if (a.tipoMarca === "circulo") {
        ctx.beginPath()
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.strokeRect(x, y, w, h)
      }
      // Badge numerado
      ctx.setLineDash([])
      const r = Math.max(10, W * 0.012)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(i + 1), x, y)
    })
    const url = canvas.toDataURL("image/png")
    const link = document.createElement("a")
    link.href = url
    link.download = `${activeLamina.nombre.replace(/\.[^.]+$/, "")}-anotada.png`
    link.click()
  }

  function exportJSON() {
    const payload = laminas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      anotaciones: anotacionesPorLamina[l.id] ?? [],
    }))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "anotaciones-planos.json"
    link.click()
  }

  const hayResultados = Object.values(anotacionesPorLamina).some((a) => a.length > 0)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="✏️"
        title="Anotación sobre planos"
        subtitle="Rayamos el plano por ti: cada observación marcada donde va, como el revisor DOM"
        breadcrumbs={[{ label: "Herramientas" }, { label: "Anotación sobre planos" }]}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Carga + contexto */}
          <Card className="rounded-[4px] border-line-fine">
            <CardHeader>
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Anotación sobre planos
              </p>
              <CardTitle className="font-technical">Sube las láminas y las observaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                La arquitectura es dibujo. Sube tus láminas (plantas, elevaciones — hasta 6) y, si las
                tienes, pega las observaciones del revisor. Te devolvemos el plano con cada observación
                marcada sobre él. Puedes arrastrar cualquier marca para ajustar su ubicación.
              </p>

              <div>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed border-line-med bg-muted/20 px-4 py-8 text-center transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]">
                  <ImagePlus className="size-6 text-muted-foreground/60" />
                  <span className="text-sm font-medium text-primary">Subir láminas (PDF · PNG · JPG)</span>
                  <span className="text-xs text-muted-foreground/70">
                    Los PDF se convierten a lámina automáticamente (una por página). Hasta 6 láminas.
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleFiles(e.target.files)}
                  />
                </label>
              </div>

              {laminas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {laminas.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveId(l.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-[4px] border transition-colors",
                        activeId === l.id ? "border-[var(--blueprint)]" : "border-line-fine hover:border-[var(--blueprint)]",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.dataUrl} alt={l.nombre} className="h-16 w-24 object-cover" />
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          removeLamina(l.id)
                        }}
                        className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </span>
                      {(anotacionesPorLamina[l.id]?.length ?? 0) > 0 && (
                        <span className="num absolute bottom-0.5 left-0.5 rounded-[3px] bg-primary px-1 text-[9px] font-bold text-white">
                          {anotacionesPorLamina[l.id].length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Observaciones del revisor (opcional)</Label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Pega aquí el acta de observaciones. Si la dejas vacía, detectamos los puntos probables."
                    className="min-h-24 w-full resize-y rounded-[4px] border border-line-fine bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blueprint)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contexto / objetivo (opcional)</Label>
                  <textarea
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    placeholder="Ej: Petshop en Kennedy. Objetivo: encaminar como 512, evitar permiso de alteración."
                    className="min-h-24 w-full resize-y rounded-[4px] border border-line-fine bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--blueprint)]"
                  />
                </div>
              </div>

              <Button
                onClick={() => void handleAnalizar()}
                disabled={loading || laminas.length === 0}
                className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Analizando láminas con IA…
                  </>
                ) : (
                  <>
                    <PencilRuler className="size-4" /> Marcar observaciones sobre el plano
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div
              className="flex gap-3 rounded-[4px] border p-4"
              style={{
                borderColor: "var(--state-error)",
                background: "color-mix(in oklch, var(--state-error) 8%, transparent)",
              }}
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0" style={{ color: "var(--state-error)" }} />
              <p className="text-sm" style={{ color: "var(--state-error)" }}>{error}</p>
            </div>
          )}

          {/* Visor + panel */}
          {activeLamina && (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              {/* Lámina con overlay */}
              <div className="space-y-3">
                <div
                  ref={overlayRef}
                  className="bg-blueprint-grid relative select-none overflow-hidden rounded-[4px] border border-line-med"
                  onPointerMove={onMarkPointerMove}
                  onPointerUp={onMarkPointerUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeLamina.dataUrl} alt={activeLamina.nombre} className="block w-full" draggable={false} />
                  {activeAnotaciones.map((a, i) => {
                    const color = colorDeMarca(a.convencionLinea, a.severidad)
                    const isActive = selectedAnotacion === a.id || hoverAnotacion === a.id
                    return (
                      <div
                        key={a.id}
                        onPointerDown={(e) => onMarkPointerDown(e, a)}
                        onMouseEnter={() => setHoverAnotacion(a.id)}
                        onMouseLeave={() => setHoverAnotacion(null)}
                        className="absolute cursor-move"
                        style={{
                          left: `${a.bbox.x * 100}%`,
                          top: `${a.bbox.y * 100}%`,
                          width: `${a.bbox.w * 100}%`,
                          height: `${a.bbox.h * 100}%`,
                          border: `2px ${a.convencionLinea ? "dashed" : "solid"} ${color}`,
                          borderRadius: a.tipoMarca === "circulo" ? "9999px" : "4px",
                          background: isActive ? `${color}1f` : "transparent",
                          boxShadow: isActive ? `0 0 0 2px ${color}55` : "none",
                          opacity: a.confianza < 0.5 ? 0.7 : 1,
                          zIndex: isActive ? 20 : 10,
                        }}
                      >
                        <span
                          className="absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: color }}
                        >
                          {i + 1}
                        </span>
                        {a.confianza < 0.5 && (
                          <span className="absolute -bottom-5 left-0 whitespace-nowrap rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700">
                            ubicación aprox. — ajústala
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Leyenda + export */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {Object.values(CONVENCION_LINEA).map((c) => (
                      <span key={c.label} className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block h-0 w-5 border-t-2 border-dashed"
                          style={{ borderColor: c.color }}
                        />
                        {c.label}
                      </span>
                    ))}
                  </div>
                  {hayResultados && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => void exportPNG()}>
                        <Download className="size-3.5" /> PNG anotado
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportJSON}>
                        <FileJson className="size-3.5" /> JSON
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel de observaciones */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 border-b border-line-med pb-2">
                  <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Observaciones en esta lámina
                  </h3>
                  <div className="h-px flex-1 bg-line-fine" />
                  <span className="num text-[10px] text-muted-foreground/70">
                    {activeAnotaciones.length}
                  </span>
                </div>
                {activeAnotaciones.length === 0 && (
                  <p className="rounded-[4px] border border-dashed border-line-fine bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                    Sin marcas en esta lámina. Analiza o cambia de lámina.
                  </p>
                )}
                {activeAnotaciones.map((a, i) => {
                  const color = colorDeMarca(a.convencionLinea, a.severidad)
                  const isActive = selectedAnotacion === a.id || hoverAnotacion === a.id
                  return (
                    <button
                      key={a.id}
                      onMouseEnter={() => setHoverAnotacion(a.id)}
                      onMouseLeave={() => setHoverAnotacion(null)}
                      onClick={() => setSelectedAnotacion(a.id)}
                      className={cn(
                        "w-full rounded-[4px] border bg-card p-3 text-left transition-colors",
                        isActive
                          ? "border-[var(--blueprint)] bg-[var(--blueprint)]/[0.05]"
                          : "border-line-fine hover:border-[var(--blueprint)]",
                      )}
                    >
                      <div className="mb-1 flex items-start gap-2">
                        <span
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ background: color }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-semibold text-primary">{a.textoCorto}</span>
                        <span
                          className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold"
                          style={{ background: `${SEVERIDAD_COLOR[a.severidad]}1a`, color: SEVERIDAD_COLOR[a.severidad] }}
                        >
                          {SEVERIDAD_LABEL[a.severidad]}
                        </span>
                      </div>
                      {a.articulo && (
                        <Num className="mb-1 inline-block rounded-[3px] border border-line-fine px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {a.articulo}
                        </Num>
                      )}
                      <p className="text-xs leading-relaxed text-foreground/75">{a.observacion}</p>
                      {a.sugerencia && (
                        <p className="mt-1.5 rounded-[3px] border border-line-fine bg-muted/40 px-2 py-1 text-[11px] leading-relaxed text-foreground/80">
                          <span className="font-semibold">Corregir: </span>
                          {a.sugerencia}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeLamina && hayResultados && (
            <p className="px-1 text-[11px] leading-relaxed text-muted-foreground/70">
              Marcas generadas por IA con fines preventivos. Verifica la ubicación y el fundamento antes
              de presentar; la revisión definitiva la realiza el profesional competente.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
