// Generación del informe PDF profesional del due diligence (portada con riesgo,
// estado DOM, hallazgos, próximos pasos y documentos + una página por lámina de
// plano anotada). Autocontenido: dado (proyectoId, result) consulta documentos,
// datos del proyecto y las anotaciones guardadas, rasteriza los planos y arma el
// PDF. Reutilizado por el botón superior de la ficha y por PlanosAnotados.

import type { jsPDF as JsPDF } from "jspdf"
import { createClient } from "@/lib/supabase/client"
import { esPlano } from "@/lib/planos"
import { CONVENCION_LINEA, colorDeMarca, type Anotacion } from "@/lib/anotacion-convenciones"
import type { DueDiligenceResult } from "@/lib/due-diligence"
import { calcularCuadro, type CuadroInput, type CuadroResultado } from "@/lib/cuadros-calculo"

export const COVER_W = 794
export const COVER_H = 1123

export interface CoverInfo {
  cliente?: string | null
  numeroExpediente?: string | null
  tipo?: string | null
  documentos: { nombre: string; tipo: string }[]
}

interface Lamina {
  dataUrl: string
  anotaciones: Anotacion[]
  documentoId: string
  pagina: number
}

// Rasteriza cada página de un PDF (por URL) a imagen JPEG en el cliente.
export async function pdfUrlToImages(
  url: string,
  base: string,
): Promise<{ nombre: string; dataUrl: string }[]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
  const buf = await (await fetch(url)).arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const out: { nombre: string; dataUrl: string }[] = []
  const MAX_W = 1600
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

// Observaciones para marcar = estado DOM + hallazgos VERIFICADOS del due
// diligence (con su cita normativa como pista para la anotación). Si ningún
// hallazgo fue confirmado aún, cae a todos (compatibilidad con DD sin verificar).
export function observacionesDesdeReporte(result: DueDiligenceResult): string {
  const lines: string[] = []
  if (result.estadoDOM?.detalle) lines.push(result.estadoDOM.detalle)
  const confirmados = result.hallazgos.filter((h) => (h.estadoRevision ?? "propuesto") === "confirmado")
  const fuente = confirmados.length > 0 ? confirmados : result.hallazgos
  for (const h of fuente) {
    const titulo = h.tituloEditado ?? h.titulo
    const descripcion = h.descripcionEditada ?? h.descripcion
    const cita = h.refNormativa?.find((r) => r.verificado)?.etiqueta
    lines.push(`${titulo}: ${descripcion}${cita ? ` [${cita}]` : ""}${h.refDOM ? ` (${h.refDOM})` : ""}`)
  }
  return lines.join("\n")
}

function riesgoRGB(r: DueDiligenceResult["riesgoGlobal"]): [number, number, number] {
  if (r === "ALTO") return [239, 68, 68]
  if (r === "MEDIO") return [245, 158, 11]
  return [16, 163, 74]
}
function sevRGB(s: string): [number, number, number] {
  if (s === "critico" || s === "crítica") return [239, 68, 68]
  if (s === "alto" || s === "media") return [245, 158, 11]
  return [59, 130, 246]
}

// Quema las marcas sobre la lámina a resolución natural y devuelve JPEG + dims.
async function burnLamina(l: Lamina): Promise<{ dataUrl: string; w: number; h: number }> {
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
    // Ubicación incierta (confianza < 0.5) se imprime atenuada, igual que en
    // el visor: nunca falsa precisión sobre una lámina impresa.
    ctx.globalAlpha = a.confianza < 0.5 ? 0.55 : 1
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
    ctx.globalAlpha = 1
  })
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), w: W, h: H }
}

// Banda de leyenda bajo la lámina: convención de líneas + lista numerada de
// las marcas. La lámina impresa debe explicarse sola, como un plano real.
function drawLaminaLeyenda(pdf: JsPDF, l: Lamina, W: number, top: number, bandH: number): void {
  const pad = W * 0.015
  const fs = Math.max(9, W * 0.011)
  const lh = fs * 1.55

  pdf.setFillColor(255, 255, 255)
  pdf.rect(0, top, W, bandH, "F")
  pdf.setDrawColor(180, 180, 180)
  pdf.setLineWidth(Math.max(0.75, W * 0.0006))
  pdf.line(0, top, W, top)

  // Línea de convención.
  const y = top + pad + fs
  pdf.setFontSize(fs)
  let x = pad
  for (const c of Object.values(CONVENCION_LINEA)) {
    const rgb = hexToRgb(c.color)
    pdf.setDrawColor(rgb[0], rgb[1], rgb[2])
    pdf.setLineWidth(Math.max(1.5, W * 0.0015))
    pdf.setLineDashPattern([W * 0.006, W * 0.004], 0)
    pdf.line(x, y - fs * 0.35, x + W * 0.02, y - fs * 0.35)
    pdf.setLineDashPattern([], 0)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(80, 80, 80)
    pdf.text(c.label, x + W * 0.025, y)
    x += W * 0.025 + pdf.getTextWidth(c.label) + W * 0.03
  }
  pdf.setTextColor(120, 120, 120)
  pdf.text("Marca atenuada = ubicación aproximada", x, y)

  // Marcas en dos columnas.
  const colW = (W - pad * 3) / 2
  const half = Math.ceil(l.anotaciones.length / 2)
  l.anotaciones.forEach((a, i) => {
    const col = i < half ? 0 : 1
    const row = i < half ? i : i - half
    const ix = pad + col * (colW + pad)
    const iy = y + lh + row * lh
    const rgb = hexToRgb(colorDeMarca(a.convencionLinea, a.severidad))
    pdf.setFillColor(rgb[0], rgb[1], rgb[2])
    pdf.circle(ix + fs * 0.45, iy - fs * 0.32, fs * 0.5, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(fs * 0.78)
    pdf.setTextColor(255, 255, 255)
    pdf.text(String(i + 1), ix + fs * 0.45, iy - fs * 0.32, { align: "center", baseline: "middle" })
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(fs)
    pdf.setTextColor(50, 50, 50)
    const label = `${a.textoCorto}${a.articulo ? ` — ${a.articulo}` : ""}${a.confianza < 0.5 ? " (aprox.)" : ""}`
    pdf.text(pdf.splitTextToSize(label, colW - fs * 1.4)[0] ?? label, ix + fs * 1.2, iy)
  })
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return [100, 100, 100]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Dibuja el cuadro de cálculo normativo como viñeta (esquina inferior derecha)
// sobre la página de una lámina — como un cuadro de superficies en un plano real.
function drawCuadroBlock(pdf: JsPDF, cuadro: CuadroResultado, W: number, H: number): void {
  const pad = W * 0.012
  const boxW = Math.min(W * 0.34, 330)
  const titleFs = Math.max(9, W / 110)
  const rowFs = Math.max(8, W / 135)
  const lh = rowFs * 1.7

  const relevantes = cuadro.filas.filter((f) =>
    ["Constructibilidad", "Ocupación de suelo", "Altura de edificación", "Rasante", "Distanciamiento"].includes(
      f.concepto,
    ),
  )
  const corto: Record<string, string> = {
    "Ocupación de suelo": "Ocupación",
    "Altura de edificación": "Altura",
    Distanciamiento: "Distanc.",
  }
  const rows: { label: string; val: string; color: [number, number, number] }[] = [
    { label: "Sup. edificada", val: `${cuadro.superficieTotalEdificada} m²`, color: [30, 30, 30] },
    ...relevantes.map((f) => ({
      label: corto[f.concepto] ?? f.concepto,
      val: `${f.valor}${f.unidad}${f.limite !== null ? ` / ${f.limite}${f.unidad}` : ""}`,
      color: (f.veredicto === "excede"
        ? [220, 38, 38]
        : f.veredicto === "cumple"
          ? [22, 163, 74]
          : [90, 90, 90]) as [number, number, number],
    })),
  ]

  const headerH = titleFs * 2.2
  const boxH = headerH + rows.length * lh + pad
  const x = W - boxW - pad
  const y = H - boxH - pad

  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(60, 60, 60)
  pdf.setLineWidth(Math.max(1, W * 0.001))
  pdf.roundedRect(x, y, boxW, boxH, 4, 4, "FD")

  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(titleFs)
  pdf.setTextColor(26, 51, 40)
  pdf.text("CUADRO DE CÁLCULO NORMATIVO", x + pad, y + titleFs + 4)

  let ry = y + headerH + rowFs
  for (const r of rows) {
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(rowFs)
    pdf.setTextColor(90, 90, 90)
    pdf.text(r.label, x + pad, ry)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(r.color[0], r.color[1], r.color[2])
    pdf.text(r.val, x + boxW - pad, ry, { align: "right" })
    ry += lh
  }
}

// Dibuja la portada del informe (resumen del due diligence) en la página actual.
function drawCoverPage(pdf: JsPDF, result: DueDiligenceResult, info: CoverInfo): void {
  const M = 48
  const CW = COVER_W - M * 2
  let y = 62
  const ensure = (need: number) => {
    if (y + need > COVER_H - 44) {
      pdf.addPage([COVER_W, COVER_H], "portrait")
      y = 62
    }
  }

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
  y += 16

  const infoRows: [string, string][] = [
    ["Cliente", info.cliente ?? "—"],
    ["Municipio", result.proyecto.municipio ?? "—"],
    ["Dirección", result.proyecto.direccion ?? "—"],
    ["N° Expediente", info.numeroExpediente ?? "—"],
    ["Tipo", info.tipo ?? "—"],
  ]
  const cardH = 14 + Math.ceil(infoRows.length / 2) * 26
  pdf.setFillColor(247, 247, 245)
  pdf.roundedRect(M, y, CW, cardH, 5, 5, "F")
  infoRows.forEach(([label, value], i) => {
    const col = i % 2
    const cx = M + 14 + col * (CW / 2)
    const cy = y + 13 + Math.floor(i / 2) * 26
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(140, 140, 140)
    pdf.text(label.toUpperCase(), cx, cy)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.setTextColor(30, 30, 30)
    pdf.text(pdf.splitTextToSize(value, CW / 2 - 26)[0] ?? value, cx, cy + 9)
  })
  y += cardH + 20

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
    y += 6
  }

  if (info.documentos.length > 0) {
    ensure(24)
    pdf.setTextColor(26, 51, 40)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10)
    pdf.text(`Documentos del expediente (${info.documentos.length})`, M, y)
    y += 14
    info.documentos.forEach((d, i) => {
      ensure(13)
      if (i % 2 === 0) {
        pdf.setFillColor(250, 250, 249)
        pdf.rect(M, y - 8, CW, 12, "F")
      }
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(8)
      pdf.setTextColor(30, 30, 30)
      pdf.text(pdf.splitTextToSize(d.nombre, CW - 130)[0] ?? d.nombre, M + 6, y)
      pdf.setTextColor(140, 140, 140)
      pdf.setFontSize(7.5)
      pdf.text(d.tipo, M + CW - 6, y, { align: "right" })
      y += 13
    })
    y += 8
  }

  pdf.setTextColor(150, 150, 150)
  pdf.setFont("helvetica", "italic")
  pdf.setFontSize(7.5)
  pdf.text(
    `Generado el ${result.generadoEl} · Revisión preliminar, no constituye pronunciamiento de la DOM.`,
    M,
    COVER_H - 30,
  )
}

// Genera y descarga el informe PDF profesional completo para un proyecto.
// Autocontenido: obtiene documentos, datos del proyecto y las anotaciones
// guardadas, rasteriza los planos y arma portada + láminas anotadas.
export async function generarInformePDF(
  proyectoId: string,
  result: DueDiligenceResult,
): Promise<void> {
  const supabase = createClient()

  const { data: docsData } = await supabase
    .from("documentos")
    .select("id, nombre, url, tipo")
    .eq("proyecto_id", proyectoId)
  const allDocs = (docsData ?? []) as { id: string; nombre: string; url: string; tipo: string | null }[]
  const planos = allDocs.filter((d) => esPlano(d.tipo))

  const { data: pRow } = await supabase
    .from("proyectos")
    .select("numero_expediente, tipo, cliente:clientes(nombre)")
    .eq("id", proyectoId)
    .maybeSingle()
  const cli = pRow?.cliente as { nombre?: string } | { nombre?: string }[] | null
  const info: CoverInfo = {
    cliente: (Array.isArray(cli) ? cli[0]?.nombre : cli?.nombre) ?? null,
    numeroExpediente: (pRow?.numero_expediente as string | null) ?? null,
    tipo: (pRow?.tipo as string | null) ?? null,
    documentos: allDocs.map((d) => ({ nombre: d.nombre, tipo: d.tipo ?? "—" })),
  }

  const { data: stored } = await supabase
    .from("planos_anotaciones")
    .select("documento_id, pagina, anotaciones")
    .eq("proyecto_id", proyectoId)
  const map = new Map(
    (stored ?? []).map((s) => [`${s.documento_id}-${s.pagina}`, (s.anotaciones ?? []) as Anotacion[]]),
  )

  // Cuadro de cálculo normativo (viñeta sobre la primera lámina), si existe.
  let cuadro: CuadroResultado | null = null
  const { data: cuadroRow } = await supabase
    .from("cuadros_calculo")
    .select("data")
    .eq("proyecto_id", proyectoId)
    .maybeSingle()
  if (cuadroRow?.data) {
    const r = calcularCuadro(cuadroRow.data as CuadroInput)
    if (!r.incompleto) cuadro = r
  }

  const laminas: Lamina[] = []
  for (const p of planos) {
    const base = p.nombre.replace(/\.pdf$/i, "")
    const imgs = /\.pdf$/i.test(p.nombre)
      ? await pdfUrlToImages(p.url, base)
      : [{ nombre: base, dataUrl: p.url }]
    imgs.forEach((im, i) =>
      laminas.push({
        dataUrl: im.dataUrl,
        anotaciones: map.get(`${p.id}-${i}`) ?? [],
        documentoId: p.id,
        pagina: i,
      }),
    )
  }
  const recorte = laminas.slice(0, 6)

  const mod = await import("jspdf")
  const pdf = new mod.jsPDF({ orientation: "portrait", unit: "px", format: [COVER_W, COVER_H] })
  drawCoverPage(pdf, result, info)
  for (const [idx, l] of recorte.entries()) {
    const { dataUrl, w, h } = await burnLamina(l)
    // Banda de leyenda bajo el dibujo (no tapa la lámina): convención + lista
    // numerada de marcas, en dos columnas.
    const fs = Math.max(9, w * 0.011)
    const lh = fs * 1.55
    const bandH =
      l.anotaciones.length > 0
        ? w * 0.03 + fs + lh * (Math.ceil(l.anotaciones.length / 2) + 0.5)
        : 0
    const totalH = h + bandH
    const orientation = w >= totalH ? "landscape" : "portrait"
    pdf.addPage([w, totalH], orientation)
    pdf.addImage(dataUrl, "JPEG", 0, 0, w, h)
    if (bandH > 0) drawLaminaLeyenda(pdf, l, w, h, bandH)
    if (idx === 0 && cuadro) drawCuadroBlock(pdf, cuadro, w, h)
  }
  const safe = result.proyecto.nombre.replace(/[^\w.-]+/g, "-").slice(0, 60)
  pdf.save(`informe-due-diligence-${safe}.pdf`)
}
