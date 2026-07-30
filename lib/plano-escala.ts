// ---------------------------------------------------------------------------
// Escala gráfica de un plano PDF vectorial — DETERMINISTA (nunca por el LLM).
//
// Los planos que sube el arquitecto son en su mayoría PDF vectoriales (export
// de AutoCAD/Revit), no imágenes escaneadas: el texto del rótulo ("ESCALA
// 1:50") y las dimensiones reales de la página (en puntos PDF, 1 pt = 1/72")
// se pueden leer directamente, sin visión artificial. Con eso, una distancia
// medida en la lámina se convierte a metros reales por geometría pura — igual
// que el motor de envolvente (lib/cuadros-calculo.ts) nunca adivina un
// número, aquí tampoco: si no se detecta la escala, se devuelve null y quien
// llama debe deshabilitar la medición en vez de inventar un valor.
// ---------------------------------------------------------------------------

export interface EscalaPlano {
  // Denominador de "1:N" (ej. 50 para 1:50). null si no se detectó en el rótulo.
  escala: number | null
  // Dimensiones de la página en puntos PDF (1 pt = 1/72"), a escala 1 del viewport.
  anchoPt: number
  altoPt: number
  // Texto exacto donde se detectó la escala (auditable, se puede mostrar al usuario).
  fuente: string | null
}

const RE_ESCALA = /ESC(?:ALA)?\.?\s*1\s*[:/]\s*(\d{1,4})/i

// Recorre TODAS las páginas de un PDF en una sola apertura (mismo patrón de
// iteración que pdfUrlToImages en lib/informe-pdf.ts) y devuelve la escala
// detectada por página, en el mismo orden que las imágenes rasterizadas.
export async function detectarEscalasPdf(url: string): Promise<EscalaPlano[]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
  const buf = await (await fetch(url)).arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const out: EscalaPlano[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    let escala: number | null = null
    let fuente: string | null = null
    try {
      const content = await page.getTextContent()
      for (const item of content.items) {
        const str = "str" in item ? item.str : ""
        const match = RE_ESCALA.exec(str)
        if (match) {
          const n = Number(match[1])
          if (Number.isFinite(n) && n > 0) {
            escala = n
            fuente = str.trim()
            break
          }
        }
      }
    } catch {
      // Plano sin capa de texto extraíble (ej. escaneado) → escala null. No
      // se cae la carga de la lámina por esto, solo queda sin medición real.
    }
    out.push({ escala, anchoPt: viewport.width, altoPt: viewport.height, fuente })
  }
  return out
}

// Distancia real en metros entre dos puntos normalizados [0,1] (mismo sistema
// de coordenadas que las marcas de anotación: x,y relativos al ancho/alto
// completo de la lámina). Aritmética pura — nunca por IA. Devuelve null si la
// lámina no tiene escala detectada (no hay de dónde derivar metros reales).
export function distanciaRealM(
  a: { x: number; y: number },
  b: { x: number; y: number },
  plano: EscalaPlano | null | undefined,
): number | null {
  if (!plano?.escala || plano.escala <= 0) return null
  const dxPt = (b.x - a.x) * plano.anchoPt
  const dyPt = (b.y - a.y) * plano.altoPt
  const distPt = Math.hypot(dxPt, dyPt)
  const distMm = distPt * (25.4 / 72)
  const distM = (distMm / 1000) * plano.escala
  return Math.round((distM + Number.EPSILON) * 100) / 100
}
