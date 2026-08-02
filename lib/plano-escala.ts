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

// El denominador puede traer separador de miles ("ESC. 1:1.000") — capturar
// solo \d{1,4} cortaba en el primer punto y leía "1" en vez de "1.000",
// dando una escala 1000× más chica y por lo tanto una distanciaRealM()
// 1000× más chica que la real (con una confianza "detectada", no
// degradando a null). La escala siempre es un entero, así que se aceptan
// dígitos + separadores y se limpian después.
const RE_ESCALA = /ESC(?:ALA)?\.?\s*1\s*[:/]\s*(\d[\d.,]*)/i

// Extraído como función pura (testeable sin pdfjs/DOM) del loop de
// detectarEscalasPdf de abajo.
export function parsearEscalaDeTexto(str: string): { escala: number; fuente: string } | null {
  const match = RE_ESCALA.exec(str)
  if (!match) return null
  const n = Number(match[1].replace(/[.,]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return { escala: n, fuente: str.trim() }
}

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
        const resultado = parsearEscalaDeTexto(str)
        if (resultado) {
          escala = resultado.escala
          fuente = resultado.fuente
          break
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

// ---------------------------------------------------------------------------
// Detección automática de cotas impresas — SUGERENCIA, nunca aplicación
// directa.
//
// A diferencia de distanciaRealM (que mide sobre el dibujo y depende de la
// escala detectada), una cota impresa es el número que el proyectista ya
// escribió en metros reales sobre la lámina — no hay conversión de por medio,
// solo hay que leerlo. El riesgo no es de cálculo, es de FALSOS POSITIVOS: un
// regex sobre texto no distingue "3.20" (una cota) de un fragmento de fecha,
// de un RUT o de un artículo citado. Por eso esto es siempre una lista para
// que el arquitecto revise y elija — igual que la IA de anotación de planos
// propone marcas con `confianza` y el humano las corrige o descarta.
// ---------------------------------------------------------------------------

export interface CotaDetectada {
  valorM: number
  texto: string // texto original detectado (auditable)
  x: number // posición normalizada [0,1], mismo sistema que las anotaciones
  y: number
}

// Número con separador decimal (. o ,) y EXACTAMENTE 2 decimales, 1-2 dígitos
// enteros — acota a valores plausibles para un elemento constructivo (evita
// capturar fragmentos de números más largos: RUT, expedientes, superficies de
// 3+ dígitos). El lookbehind/lookahead impide matchear a mitad de un número
// mayor (ej. no toma "38.60" de "138.60"). Excluye explícitamente si sigue
// "m²"/"m2" (es una superficie, no una distancia).
const RE_COTA = /(?<![\d.,])([+-]?\d{1,2}[.,]\d{2})(?!\d)(?!\s*m[²2])/g

const COTA_MIN_M = 0.05
const COTA_MAX_M = 50
const MAX_COTAS_POR_LAMINA = 40

// Extrae candidatos a cota de un fragmento de texto plano — sin PDF de por
// medio, así se puede testear la lógica de falsos positivos (RUT, fechas,
// artículos citados, superficies en m²) de forma aislada y determinista.
export function extraerCotasDeTexto(texto: string): { valorM: number; texto: string }[] {
  const out: { valorM: number; texto: string }[] = []
  RE_COTA.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = RE_COTA.exec(texto))) {
    const valorM = Number(match[1].replace(",", "."))
    if (!Number.isFinite(valorM) || valorM < COTA_MIN_M || valorM > COTA_MAX_M) continue
    out.push({ valorM, texto: texto.trim() })
  }
  return out
}

interface TextItemConTransform {
  str: string
  transform: number[]
}

function esTextItemConTransform(item: unknown): item is TextItemConTransform {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item &&
    Array.isArray((item as { transform: unknown }).transform)
  )
}

// Recorre todas las páginas del PDF (apertura propia — no reutiliza la de
// detectarEscalasPdf para no acoplar ambas funciones) y devuelve, por página,
// las cotas candidatas detectadas. Capado a MAX_COTAS_POR_LAMINA para no
// saturar la lámina de marcadores en planos muy densos (elevaciones con
// muchas cotas); si se trunca, el llamador puede avisarlo.
export async function detectarCotasPdf(url: string): Promise<CotaDetectada[][]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()
  const buf = await (await fetch(url)).arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  const out: CotaDetectada[][] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1 })
    const cotas: CotaDetectada[] = []
    try {
      const content = await page.getTextContent()
      for (const item of content.items) {
        if (cotas.length >= MAX_COTAS_POR_LAMINA) break
        if (!esTextItemConTransform(item)) continue
        for (const { valorM, texto } of extraerCotasDeTexto(item.str)) {
          // transform[4]/[5] = posición del texto en puntos PDF, origen
          // abajo-izquierda. Se normaliza al mismo sistema [0,1] con origen
          // arriba-izquierda que usan las marcas de anotación (y invertida).
          const x = item.transform[4] / viewport.width
          const y = 1 - item.transform[5] / viewport.height
          if (x < 0 || x > 1 || y < 0 || y > 1) continue
          cotas.push({ valorM, texto, x, y })
          if (cotas.length >= MAX_COTAS_POR_LAMINA) break
        }
      }
    } catch {
      // Sin capa de texto extraíble → sin cotas detectadas, no rompe la carga.
    }
    out.push(cotas)
  }
  return out
}
