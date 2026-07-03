"use client"

import { useCallback, useState } from "react"
import { AlertCircle, Download, Loader2, PencilRuler } from "lucide-react"
import type { jsPDF as JsPDF } from "jspdf"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  CONVENCION_LINEA,
  SEVERIDAD_COLOR,
  colorDeMarca,
  type Anotacion,
} from "@/lib/anotacion-convenciones"
import type { DueDiligenceResult } from "@/lib/due-diligence"

interface PlanoDoc {
  id: string
  nombre: string
  url: string
}

interface LaminaConImagen {
  id: string
  nombre: string
  dataUrl: string
  anotaciones: Anotacion[]
}

interface Props {
  proyectoId: string
  result: DueDiligenceResult
}

// Rasteriza cada página de un PDF (por URL) a imagen PNG en el cliente.
async function pdfUrlToImages(url: string, base: string): Promise<{ nombre: string; dataUrl: string }[]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
  const buf = await (await fetch(url)).arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const out: { nombre: string; dataUrl: string }[] = []
  const MAX_W = 1600 // gpt-4o reescala a ~1536px; JPEG para no exceder el límite de body
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const base1 = page.getViewport({ scale: 1 })
    const scale = Math.min(2, MAX_W / base1.width)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")
    if (!ctx) continue
    await page.render({ canvasContext: ctx, viewport }).promise
    out.push({
      nombre: doc.numPages > 1 ? `${base} · lámina ${i}` : base,
      dataUrl: canvas.toDataURL("image/jpeg", 0.85),
    })
  }
  return out
}

// Observaciones para marcar = estado DOM + hallazgos del due diligence.
function observacionesDesdeReporte(result: DueDiligenceResult): string {
  const lines: string[] = []
  if (result.estadoDOM?.detalle) lines.push(result.estadoDOM.detalle)
  for (const h of result.hallazgos) {
    lines.push(`${h.titulo}: ${h.descripcion}${h.refDOM ? ` (${h.refDOM})` : ""}`)
  }
  return lines.join("\n")
}

// Quema las marcas sobre la lámina a resolución natural y devuelve JPEG + dims.
async function burnLamina(l: LaminaConImagen): Promise<{ dataUrl: string; w: number; h: number }> {
  const img = new Image()
  img.src = l.dataUrl
  await new Promise((r) => {
    img.onload = r
  })
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) return { dataUrl: l.dataUrl, w: canvas.width, h: canvas.height }
  ctx.drawImage(img, 0, 0)
  const W = canvas.width
  const H = canvas.height
  ctx.lineWidth = Math.max(2, W * 0.003)
  ctx.font = `bold ${Math.max(14, W * 0.014)}px sans-serif`
  l.anotaciones.forEach((a, i) => {
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
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), w: W, h: H }
}

const COVER_W = 794
const COVER_H = 1123

function riesgoRGB(r: DueDiligenceResult["riesgoGlobal"]): [number, number, number] {
  if (r === "ALTO") return [239, 68, 68]
  if (r === "MEDIO") return [245, 158, 11]
  return [16, 163, 74]
}
function sevRGB(s: Anotacion["severidad"] | "critico" | "alto" | "medio"): [number, number, number] {
  if (s === "critico" || s === "crítica") return [239, 68, 68]
  if (s === "alto" || s === "media") return [245, 158, 11]
  return [59, 130, 246]
}

// Dibuja la portada del informe (resumen del due diligence) en la página actual.
function drawCoverPage(pdf: JsPDF, result: DueDiligenceResult): void {
  const M = 48
  const CW = COVER_W - M * 2
  let y = 62
  const ensure = (need: number) => {
    if (y + need > COVER_H - 44) {
      pdf.addPage([COVER_W, COVER_H], "portrait")
      y = 62
    }
  }

  // Encabezado
  pdf.setTextColor(26, 51, 40)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(20)
  pdf.text("Informe de Due Diligence", M, y)
  y += 22
  pdf.setFontSize(13)
  pdf.setTextColor(20, 20, 20)
  pdf.splitTextToSize(result.proyecto.nombre, CW).slice(0, 2).forEach((ln: string) => {
    pdf.text(ln, M, y)
    y += 16
  })
  const sub = [result.proyecto.direccion, result.proyecto.municipio, result.proyecto.rol]
    .filter(Boolean)
    .join("  ·  ")
  if (sub) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9)
    pdf.setTextColor(120, 120, 120)
    pdf.text(sub, M, y)
    y += 8
  }
  y += 18

  // Fila de métricas: riesgo · completitud · conteos
  const boxW = (CW - 24) / 3
  const boxH = 44
  const [rr, rg, rb] = riesgoRGB(result.riesgoGlobal)
  pdf.setFillColor(rr, rg, rb)
  pdf.roundedRect(M, y, boxW, boxH, 4, 4, "F")
  pdf.setTextColor(255, 255, 255)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(7)
  pdf.text("RIESGO GLOBAL", M + 12, y + 16)
  pdf.setFontSize(15)
  pdf.text(result.riesgoGlobal, M + 12, y + 34)

  const x2 = M + boxW + 12
  pdf.setDrawColor(224, 224, 224)
  pdf.setFillColor(248, 248, 248)
  pdf.roundedRect(x2, y, boxW, boxH, 4, 4, "FD")
  pdf.setTextColor(120, 120, 120)
  pdf.setFontSize(7)
  pdf.text("COMPLETITUD", x2 + 12, y + 16)
  pdf.setTextColor(26, 51, 40)
  pdf.setFontSize(15)
  pdf.text(`${result.completitud.presentes}/${result.completitud.esperados} docs`, x2 + 12, y + 34)

  const x3 = x2 + boxW + 12
  pdf.setFillColor(248, 248, 248)
  pdf.roundedRect(x3, y, boxW, boxH, 4, 4, "FD")
  pdf.setTextColor(120, 120, 120)
  pdf.setFontSize(7)
  pdf.text("HALLAZGOS", x3 + 12, y + 16)
  pdf.setTextColor(26, 51, 40)
  pdf.setFontSize(11)
  pdf.text(
    `${result.conteos.criticos} crít · ${result.conteos.altos} altos · ${result.conteos.medios} medios`,
    x3 + 12,
    y + 33,
  )
  y += boxH + 22

  // Estado DOM
  if (result.estadoDOM?.rechazado || result.estadoDOM?.detalle) {
    const detalle = result.estadoDOM.detalle ?? ""
    const meta = [
      result.estadoDOM.resolucion,
      result.estadoDOM.fecha,
      result.estadoDOM.expediente ? `Exp. ${result.estadoDOM.expediente}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ")
    pdf.setFontSize(9)
    const lines = pdf.splitTextToSize(detalle, CW - 24)
    const h = 34 + lines.length * 12
    ensure(h)
    pdf.setFillColor(254, 242, 242)
    pdf.setDrawColor(239, 68, 68)
    pdf.roundedRect(M, y, CW, h, 4, 4, "FD")
    pdf.setTextColor(185, 28, 28)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(result.estadoDOM.rechazado ? "Estado DOM: RECHAZADO" : "Estado DOM", M + 12, y + 18)
    if (meta) {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(7.5)
      pdf.text(meta, M + 12, y + 30)
    }
    pdf.setTextColor(60, 60, 60)
    pdf.setFontSize(9)
    pdf.text(lines, M + 12, y + 44)
    y += h + 18
  }

  // Resumen ejecutivo
  if (result.resumenEjecutivo) {
    pdf.setFontSize(9.5)
    const lines = pdf.splitTextToSize(result.resumenEjecutivo, CW)
    ensure(20 + lines.length * 12)
    pdf.setTextColor(26, 51, 40)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text("Resumen ejecutivo", M, y)
    y += 15
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(9.5)
    pdf.setTextColor(50, 50, 50)
    pdf.text(lines, M, y)
    y += lines.length * 12 + 16
  }

  // Hallazgos
  if (result.hallazgos.length > 0) {
    ensure(24)
    pdf.setTextColor(26, 51, 40)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text(`Hallazgos (${result.hallazgos.length})`, M, y)
    y += 16
    result.hallazgos.forEach((h) => {
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8.5)
      const desc = pdf.splitTextToSize(h.descripcion, CW - 20)
      const blockH = 18 + desc.length * 11
      ensure(blockH)
      const [sr, sg, sb] = sevRGB(h.severidad)
      pdf.setFillColor(sr, sg, sb)
      pdf.rect(M, y - 6, 4, blockH - 4, "F")
      pdf.setTextColor(sr, sg, sb)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8.5)
      pdf.text(`${h.codigo} · ${h.titulo}`, M + 12, y)
      if (h.refDOM) {
        pdf.setFont("helvetica", "normal")
        pdf.setTextColor(150, 150, 150)
        pdf.setFontSize(7)
        pdf.text(h.refDOM, M + 12, y + 9)
      }
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(70, 70, 70)
      pdf.setFontSize(8.5)
      pdf.text(desc, M + 12, y + (h.refDOM ? 19 : 11))
      y += blockH + (h.refDOM ? 10 : 4)
    })
    y += 10
  }

  // Próximos pasos
  if (result.proximosPasos.length > 0) {
    ensure(24)
    pdf.setTextColor(26, 51, 40)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text("Próximos pasos", M, y)
    y += 16
    result.proximosPasos.forEach((p, i) => {
      pdf.setFontSize(8.5)
      const det = pdf.splitTextToSize(p.detalle, CW - 24)
      const blockH = 14 + det.length * 11
      ensure(blockH)
      pdf.setTextColor(p.critico ? 185 : 26, p.critico ? 28 : 51, p.critico ? 28 : 40)
      pdf.setFont("helvetica", "bold")
      pdf.text(`${i + 1}. ${p.titulo}`, M, y)
      pdf.setFont("helvetica", "normal")
      pdf.setTextColor(70, 70, 70)
      pdf.text(det, M + 14, y + 11)
      y += blockH + 4
    })
  }

  // Pie
  pdf.setTextColor(150, 150, 150)
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(7.5)
  pdf.text(
    `Generado el ${result.generadoEl} · Revisión preliminar, no constituye pronunciamiento de la DOM.`,
    M,
    COVER_H - 30,
  )
}

export default function PlanosAnotados({ proyectoId, result }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [laminas, setLaminas] = useState<LaminaConImagen[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [exporting, setExporting] = useState(false)

  const generar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1) Traer los planos del proyecto (RLS del dueño).
      const supabase = createClient()
      const { data, error: dbError } = await supabase
        .from("documentos")
        .select("id, nombre, url")
        .eq("proyecto_id", proyectoId)
        .eq("tipo", "Plano")
      if (dbError) throw new Error(dbError.message)
      const planos = (data ?? []) as PlanoDoc[]
      if (planos.length === 0) {
        setError("No hay documentos de tipo Plano en este proyecto.")
        return
      }

      // 2) Rasterizar (hasta 6 láminas en total).
      const rasterizadas: { id: string; nombre: string; dataUrl: string }[] = []
      for (const p of planos) {
        const base = p.nombre.replace(/\.pdf$/i, "")
        const imgs = /\.pdf$/i.test(p.nombre)
          ? await pdfUrlToImages(p.url, base)
          : [{ nombre: base, dataUrl: p.url }]
        imgs.forEach((im, i) =>
          rasterizadas.push({ id: `${p.id}-${i}`, nombre: im.nombre, dataUrl: im.dataUrl }),
        )
      }
      const recorte = rasterizadas.slice(0, 6)
      const observaciones = observacionesDesdeReporte(result)
      const contexto = `${result.proyecto.nombre} — ${result.proyecto.municipio ?? ""}. Due diligence: ${result.resumenEjecutivo}`

      // 3) Marcar observaciones sobre cada lámina — UN request por lámina para
      //    no exceder el límite de 10MB del body con imágenes grandes.
      const merged: LaminaConImagen[] = []
      for (const r of recorte) {
        const res = await fetch("/api/ai/anotacion-plano", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ laminas: [r], observaciones, contexto }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          laminas?: { id: string; nombre: string; anotaciones: Anotacion[] }[]
          error?: string
        }
        if (!res.ok || json.error) throw new Error(json.error ?? "Error del servidor")
        merged.push({ ...r, anotaciones: json.laminas?.[0]?.anotaciones ?? [] })
      }
      setLaminas(merged)
      setActiveIdx(0)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [proyectoId, result])

  const exportarPDF = useCallback(async () => {
    if (laminas.length === 0) return
    setExporting(true)
    try {
      const mod = await import("jspdf")
      // Portada = resumen del due diligence (página A4 vertical).
      const pdf = new mod.jsPDF({ orientation: "portrait", unit: "px", format: [COVER_W, COVER_H] })
      drawCoverPage(pdf, result)
      // Una página por lámina anotada.
      for (const l of laminas) {
        const { dataUrl, w, h } = await burnLamina(l)
        const orientation = w >= h ? "landscape" : "portrait"
        pdf.addPage([w, h], orientation)
        pdf.addImage(dataUrl, "JPEG", 0, 0, w, h)
      }
      const safe = result.proyecto.nombre.replace(/[^\w.-]+/g, "-").slice(0, 60)
      pdf.save(`informe-due-diligence-${safe}.pdf`)
    } finally {
      setExporting(false)
    }
  }, [laminas, result.proyecto.nombre])

  const active = laminas[activeIdx]

  return (
    <Card>
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PencilRuler className="size-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Observaciones sobre los planos</p>
          </div>
          {done && laminas.length > 0 && (
            <div className="flex items-center gap-2">
              {laminas.length > 1 && (
                <div className="flex gap-1">
                  {laminas.map((l, i) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveIdx(i)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        i === activeIdx
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/20",
                      )}
                    >
                      Lámina {i + 1}
                      {l.anotaciones.length > 0 && ` · ${l.anotaciones.length}`}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => void exportarPDF()} disabled={exporting}>
                {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                PDF
              </Button>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Marca las observaciones de la DOM y los hallazgos del due diligence directamente sobre la lámina,
          como lo haría el revisor a mano.
        </p>
      </div>

      <CardBody
        loading={loading}
        error={error}
        done={done}
        active={active}
        hoverId={hoverId}
        setHoverId={setHoverId}
        onGenerar={generar}
      />
    </Card>
  )
}

// Card wrapper local (evita importar Card genérico dos veces con estilos duplicados).
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  )
}

interface BodyProps {
  loading: boolean
  error: string | null
  done: boolean
  active: LaminaConImagen | undefined
  hoverId: string | null
  setHoverId: (id: string | null) => void
  onGenerar: () => void
}

function CardBody({ loading, error, done, active, hoverId, setHoverId, onGenerar }: BodyProps) {
  if (!done) {
    return (
      <div className="space-y-3 p-5">
        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        <Button onClick={onGenerar} disabled={loading} className="bg-primary text-white hover:bg-primary/90">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Marcando observaciones sobre los planos…
            </>
          ) : (
            <>
              <PencilRuler className="size-4" /> Marcar observaciones sobre los planos
            </>
          )}
        </Button>
      </div>
    )
  }

  if (!active) {
    return <p className="p-5 text-xs text-muted-foreground">No se pudieron marcar los planos.</p>
  }

  return (
    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_300px]">
      {/* Lámina con overlay */}
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.dataUrl} alt={active.nombre} className="block w-full" />
          {active.anotaciones.map((a, i) => {
            const color = colorDeMarca(a.convencionLinea, a.severidad)
            const on = hoverId === a.id
            return (
              <div
                key={a.id}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId(null)}
                className="absolute"
                style={{
                  left: `${a.bbox.x * 100}%`,
                  top: `${a.bbox.y * 100}%`,
                  width: `${a.bbox.w * 100}%`,
                  height: `${a.bbox.h * 100}%`,
                  border: `2px ${a.convencionLinea ? "dashed" : "solid"} ${color}`,
                  borderRadius: a.tipoMarca === "circulo" ? "9999px" : "4px",
                  background: on ? `${color}1f` : "transparent",
                  boxShadow: on ? `0 0 0 2px ${color}55` : "none",
                  opacity: a.confianza < 0.5 ? 0.7 : 1,
                }}
              >
                <span
                  className="absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {Object.values(CONVENCION_LINEA).map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Panel de observaciones */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {active.anotaciones.length} observaciones en esta lámina
        </p>
        {active.anotaciones.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            Sin marcas en esta lámina.
          </p>
        )}
        {active.anotaciones.map((a, i) => {
          const color = colorDeMarca(a.convencionLinea, a.severidad)
          const on = hoverId === a.id
          return (
            <div
              key={a.id}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              className={cn(
                "rounded-lg border bg-white p-2.5 transition-all",
                on ? "border-primary/40 shadow-sm" : "border-border",
              )}
            >
              <div className="mb-1 flex items-start gap-2">
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-primary">{a.textoCorto}</span>
                <span
                  className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: `${SEVERIDAD_COLOR[a.severidad]}1a`, color: SEVERIDAD_COLOR[a.severidad] }}
                >
                  {a.severidad}
                </span>
              </div>
              {a.articulo && (
                <span className="mb-1 inline-block rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {a.articulo}
                </span>
              )}
              <p className="text-[11px] leading-relaxed text-foreground/75">{a.observacion}</p>
              {a.sugerencia && (
                <p className="mt-1 rounded bg-primary/5 px-1.5 py-1 text-[10px] leading-relaxed text-primary/80">
                  <span className="font-semibold">Corregir: </span>
                  {a.sugerencia}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
