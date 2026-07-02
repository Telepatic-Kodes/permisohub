export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { isAIAvailable, aiCompleteWithImages } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import type { Anotacion, LaminaAnotada } from '@/lib/anotacion-convenciones'

// ---------------------------------------------------------------------------
// Anotación sobre planos — "rayar el plano" como el revisor DOM.
//
// Ubica cada observación normativa SOBRE la lámina (bbox normalizado 0..1) con
// su tipo de marca, convención de línea, artículo y sugerencia de corrección.
// El overlay y el arrastre manual de marcas viven en el cliente.
// ---------------------------------------------------------------------------

interface LaminaInput {
  id: string
  nombre: string
  dataUrl: string // data:image/...;base64,...
}

interface AnotacionPlanoRequest {
  laminas: LaminaInput[]
  observaciones?: string // acta / observaciones del revisor (opcional)
  contexto?: string // municipio, tipo de trámite, objetivo (ej. "encaminar como 512")
}

function buildPrompt(nombre: string, observaciones?: string, contexto?: string): string {
  const ogucCtx = getContextoOGUC(
    'muros perimetrales aleros rasante distanciamiento elevacion emplazamiento destino uso proyeccion cotas',
  )

  const obsSection = observaciones?.trim()
    ? `## Observaciones del revisor a ubicar sobre la lámina\n${observaciones.trim()}`
    : `## Sin acta adjunta\nNo se adjuntaron observaciones. Detecta tú mismo, como revisor DOM, los puntos que probablemente se observarían en esta lámina y ubícalos.`

  const ctxSection = contexto?.trim() ? `## Contexto del proyecto\n${contexto.trim()}` : ''

  return `Actúas como un revisor experimentado de la Dirección de Obras Municipales (DOM) de Chile, pero del lado del arquitecto. Recibes UNA lámina de un plano de arquitectura ("${nombre}"). Tu tarea es UBICAR cada observación normativa SOBRE el dibujo, como lo hacía el revisor a mano cuando rayaba el plano físico: marcando exactamente dónde está el problema.

Antes de la pandemia el revisor dibujaba encima del plano; hoy solo escribe texto y el arquitecto no ve DÓNDE está la observación. Tú devuelves esa ubicación.

${obsSection}

${ctxSection}

## Artículos OGUC de referencia
${ogucCtx}

## Convención gráfica (obligatoria)
- Línea roja segmentada ("rojo_segmentado") = muros perimetrales que se prolongan.
- Línea amarilla segmentada ("amarillo_segmentado") = elementos eliminados o nuevos.
- Si la observación no encaja en la convención de líneas, deja "convencionLinea": null y usa el tipo de marca que corresponda.

## Reglas
- NO degrades ni pidas bajar la calidad del dibujo.
- Coordenadas SIEMPRE normalizadas 0..1 respecto a esta imagen (x,y = esquina superior izquierda del recuadro; w,h = ancho/alto). Un recuadro que cubra un alero puntual es pequeño; el emplazamiento completo es grande.
- Si no logras ubicar una observación con certeza, entrégala igual con "confianza" < 0.5 y un bbox amplio de la zona probable. NUNCA inventes precisión.
- "sugerencia" = qué debe DIBUJAR/corregir el arquitecto, concreto.

Responde SOLO con JSON válido (sin markdown), con esta forma:
{
  "anotaciones": [
    {
      "bbox": { "x": 0.0-1.0, "y": 0.0-1.0, "w": 0.0-1.0, "h": 0.0-1.0 },
      "tipoMarca": "circulo" | "flecha" | "cuadro_nota" | "linea",
      "convencionLinea": "rojo_segmentado" | "amarillo_segmentado" | null,
      "severidad": "crítica" | "media" | "menor",
      "textoCorto": "etiqueta breve visible junto a la marca (máx 4 palabras)",
      "observacion": "la observación completa, redacción del revisor",
      "articulo": "Art. X.X.X OGUC / DDU N / PRC",
      "fundamento": "por qué se observa (norma y razón concreta)",
      "sugerencia": "qué debe dibujar/corregir el arquitecto",
      "confianza": 0.0-1.0
    }
  ]
}

Devuelve entre 2 y 10 anotaciones, ordenadas por severidad (crítica → menor).`
}

function parseAnotaciones(text: string, laminaId: string): Anotacion[] {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return []
  let raw: { anotaciones?: unknown[] }
  try {
    raw = JSON.parse(match[0]) as { anotaciones?: unknown[] }
  } catch {
    return []
  }
  const list = Array.isArray(raw.anotaciones) ? raw.anotaciones : []
  return list.map((item, i): Anotacion => {
    const a = item as Partial<Anotacion> & { bbox?: Partial<Anotacion['bbox']> }
    const clamp = (n: unknown, fallback: number) =>
      typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
    return {
      id: `${laminaId}-a${i + 1}`,
      bbox: {
        x: clamp(a.bbox?.x, 0.1),
        y: clamp(a.bbox?.y, 0.1),
        w: clamp(a.bbox?.w, 0.2),
        h: clamp(a.bbox?.h, 0.2),
      },
      tipoMarca:
        a.tipoMarca === 'flecha' || a.tipoMarca === 'cuadro_nota' || a.tipoMarca === 'linea'
          ? a.tipoMarca
          : 'circulo',
      convencionLinea:
        a.convencionLinea === 'rojo_segmentado' || a.convencionLinea === 'amarillo_segmentado'
          ? a.convencionLinea
          : null,
      severidad:
        a.severidad === 'crítica' || a.severidad === 'media' ? a.severidad : 'menor',
      textoCorto: typeof a.textoCorto === 'string' ? a.textoCorto : `Obs. ${i + 1}`,
      observacion: typeof a.observacion === 'string' ? a.observacion : '',
      articulo: typeof a.articulo === 'string' ? a.articulo : '',
      fundamento: typeof a.fundamento === 'string' ? a.fundamento : '',
      sugerencia: typeof a.sugerencia === 'string' ? a.sugerencia : '',
      confianza: clamp(a.confianza, 0.5),
    }
  })
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json()) as AnotacionPlanoRequest
  if (!Array.isArray(body.laminas) || body.laminas.length === 0) {
    return Response.json({ error: 'Debes adjuntar al menos una lámina' }, { status: 400 })
  }
  if (body.laminas.length > 6) {
    return Response.json({ error: 'Máximo 6 láminas por análisis' }, { status: 400 })
  }
  const invalid = body.laminas.find((l) => !l.dataUrl?.startsWith('data:image/'))
  if (invalid) {
    return Response.json({ error: 'Cada lámina debe ser una imagen (PNG/JPG)' }, { status: 400 })
  }

  try {
    const laminas: LaminaAnotada[] = await Promise.all(
      body.laminas.map(async (lamina) => {
        const text = await aiCompleteWithImages(
          buildPrompt(lamina.nombre, body.observaciones, body.contexto),
          [lamina.dataUrl],
          { max_tokens: 3000 },
        )
        return {
          id: lamina.id,
          nombre: lamina.nombre,
          anotaciones: parseAnotaciones(text, lamina.id),
        }
      }),
    )

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, laminas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
