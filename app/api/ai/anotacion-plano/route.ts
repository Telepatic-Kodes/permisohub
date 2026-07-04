export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { isAIAvailable, aiCompleteWithImages } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { getContextoNormativo, flagUnverifiedCita, REGLAS_CITACION } from '@/lib/normativa-retrieval'
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
  const normativaCtx = getContextoNormativo(
    `${observaciones ?? ''} ${contexto ?? ''} muros perimetrales aleros rasante distanciamiento elevacion emplazamiento destino uso proyeccion cotas`,
  )

  const obsSection = observaciones?.trim()
    ? `## Hallazgos del expediente (CONTEXTO — pistas, no una lista para colocar a la fuerza)
${observaciones.trim()}

Trátalos como pistas de lo que la DOM observó. Marca sobre el dibujo SOLO los que puedas ubicar realmente en ESTA lámina. Los que sean puramente documentales, ignóralos aquí (van en el informe, no sobre el plano).`
    : `## Sin acta adjunta
No se adjuntaron observaciones. Detecta tú mismo, como revisor DOM, los puntos observables en ESTA lámina y ubícalos.`

  const ctxSection = contexto?.trim() ? `## Contexto del proyecto\n${contexto.trim()}` : ''

  return `Actúas como un revisor experimentado de la Dirección de Obras Municipales (DOM) de Chile, pero del lado del arquitecto. Recibes UNA lámina de un plano de arquitectura ("${nombre}"). Tu tarea es LEER el dibujo y UBICAR sobre él las observaciones que de verdad se ven en la lámina, como lo hacía el revisor a mano cuando rayaba el plano físico: marcando exactamente dónde está el problema.

Antes de la pandemia el revisor dibujaba encima del plano; hoy solo escribe texto y el arquitecto no ve DÓNDE está la observación. Tú devuelves esa ubicación — pero solo de lo que es realmente ubicable en el dibujo.

${obsSection}

${ctxSection}

## Contexto normativo (OGUC · LGUC · DDU)
${normativaCtx}

${REGLAS_CITACION}

## Convención gráfica (obligatoria)
- Línea roja segmentada ("rojo_segmentado") = muros perimetrales que se prolongan.
- Línea amarilla segmentada ("amarillo_segmentado") = elementos eliminados o nuevos.
- Si la observación no encaja en la convención de líneas, deja "convencionLinea": null y usa el tipo de marca que corresponda.

## Qué marcar y qué NO
- Marca SOLO cosas ubicables en el dibujo: muros / aleros / vanos, cotas y niveles (NPT), rasantes y distanciamientos, superficies y recintos, destino o uso de recintos, accesos, escaleras, estacionamientos, elementos estructurales alterados, ampliaciones no reflejadas, discordancias entre lo dibujado y lo declarado.
- NO marques sobre el plano hallazgos puramente DOCUMENTALES: incoherencias de dirección entre documentos, numeración o citación de permisos, documentos faltantes o vencidos, firmas, coherencia entre formularios. Eso NO va sobre la lámina — omítelo por completo aquí.
- Detecta además, por tu cuenta, observaciones que el propio dibujo evidencie aunque no estén en la lista de contexto.
- Cada anotación DEBE corresponder a algo visible en ESTA lámina. Si un hallazgo del expediente no se puede ubicar en este dibujo, omítelo (irá en otra lámina o solo en el informe).

## Método de ubicación (síguelo en orden)
1. Primero INVENTARÍA la lámina: identifica cada sub-dibujo que contiene (plantas, elevaciones, cortes, plano de emplazamiento, plano de ubicación, cuadros de superficies, viñeta/rótulo) y su posición aproximada en la hoja. Una lámina chilena típica trae varios dibujos en una misma hoja.
2. Para cada observación, decide EN QUÉ sub-dibujo se ve el problema. La marca va DENTRO de ese sub-dibujo, sobre el elemento observado — NUNCA sobre el rótulo, el título o la leyenda del sub-dibujo.
3. Describe el ancla visual en "ancla": sub-dibujo + referencia del elemento (ej. "planta 2° piso (dibujo superior derecho), muro perimetral norte", "elevación oriente, volumen agregado sobre la techumbre"). Si no puedes describir un ancla concreta, la observación NO es ubicable: omítela.
4. Ajusta el bbox AL ELEMENTO, no al sub-dibujo completo: un muro/alero/vano puntual ≈ 0.03–0.12 de ancho/alto; un recinto ≈ 0.05–0.20; solo una observación de zona completa (ej. todo el emplazamiento) justifica un bbox grande.

## Reglas
- NO degrades ni pidas bajar la calidad del dibujo.
- Coordenadas SIEMPRE normalizadas 0..1 respecto a la imagen COMPLETA (x,y = esquina superior izquierda del recuadro; w,h = ancho/alto).
- Si ubicas una observación real pero no con total certeza, entrégala con "confianza" < 0.5 y el bbox del sub-dibujo probable (no de la hoja entera). NUNCA inventes una ubicación para forzar una marca.
- "sugerencia" = qué debe DIBUJAR/corregir el arquitecto, concreto.

Responde SOLO con JSON válido (sin markdown), con esta forma:
{
  "anotaciones": [
    {
      "bbox": { "x": 0.0-1.0, "y": 0.0-1.0, "w": 0.0-1.0, "h": 0.0-1.0 },
      "ancla": "sub-dibujo + elemento concreto que anclas (obligatorio)",
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

Devuelve solo las anotaciones ubicables en ESTA lámina (hasta 10), ordenadas por severidad (crítica → menor). Si de verdad no hay nada ubicable en este dibujo, devuelve "anotaciones": [] — es mejor una lámina sin marcas que marcas inventadas.`
}

// Segundo pase de visión: el modelo revisa SUS PROPIAS marcas contra la lámina
// y corrige bboxes desviados (o descarta lo no ubicable). Un solo request extra
// por lámina; sube la precisión espacial sin tocar el flujo.
function buildVerifyPrompt(nombre: string, anotaciones: Anotacion[]): string {
  const compact = anotaciones.map((a) => ({
    id: a.id,
    bbox: a.bbox,
    ancla: a.ancla ?? '',
    textoCorto: a.textoCorto,
    observacion: a.observacion,
  }))
  return `Estás verificando marcas de revisión sobre la lámina "${nombre}" (la imagen adjunta). Cada marca tiene un "ancla" (dónde DEBERÍA estar) y un "bbox" normalizado 0..1 (dónde ESTÁ dibujada).

Para CADA marca, mira la imagen y responde:
- Si el bbox ya encierra el elemento del ancla → mantenlo igual.
- Si el bbox está desplazado o con tamaño equivocado → devuelve el bbox corregido que encierre el elemento del ancla (ajustado al elemento, no al sub-dibujo entero).
- Si el elemento del ancla NO se ve en esta lámina → devuelve "descartar": true.
- Si no logras decidir con certeza → conserva el bbox y baja "confianza" a menos de 0.5.

Marcas a verificar:
${JSON.stringify(compact)}

Responde SOLO con JSON válido:
{
  "marcas": [
    { "id": "...", "bbox": { "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1 }, "confianza": 0.0-1.0, "descartar": false }
  ]
}
Incluye TODAS las marcas recibidas (con "descartar": true las que no correspondan). No agregues marcas nuevas.`
}

interface VerifyMarca {
  id?: string
  bbox?: Partial<Anotacion['bbox']>
  confianza?: number
  descartar?: boolean
}

// Aplica el resultado del pase de verificación. Ante cualquier problema de
// parseo devuelve las anotaciones originales (el pase es mejora, no bloqueo).
function applyVerification(anotaciones: Anotacion[], text: string): Anotacion[] {
  let raw: { marcas?: unknown[] }
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return anotaciones
    raw = JSON.parse(match[0]) as { marcas?: unknown[] }
  } catch {
    return anotaciones
  }
  if (!Array.isArray(raw.marcas)) return anotaciones
  const byId = new Map<string, VerifyMarca>()
  for (const m of raw.marcas) {
    const v = m as VerifyMarca
    if (typeof v.id === 'string') byId.set(v.id, v)
  }
  const clamp01 = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
  return anotaciones
    .filter((a) => byId.get(a.id)?.descartar !== true)
    .map((a) => {
      const v = byId.get(a.id)
      if (!v) return a
      return {
        ...a,
        bbox: {
          x: clamp01(v.bbox?.x, a.bbox.x),
          y: clamp01(v.bbox?.y, a.bbox.y),
          w: clamp01(v.bbox?.w, a.bbox.w),
          h: clamp01(v.bbox?.h, a.bbox.h),
        },
        confianza: clamp01(v.confianza, a.confianza),
      }
    })
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
    const bbox = {
      x: clamp(a.bbox?.x, 0.1),
      y: clamp(a.bbox?.y, 0.1),
      // Mínimo visible: una marca de 0 px no se puede ver ni clickear.
      w: Math.max(0.015, clamp(a.bbox?.w, 0.2)),
      h: Math.max(0.015, clamp(a.bbox?.h, 0.2)),
    }
    let confianza = clamp(a.confianza, 0.5)
    // Un bbox que cubre más de media hoja con confianza alta es casi siempre
    // una ubicación no resuelta: se muestra, pero como incierta.
    if (bbox.w * bbox.h > 0.5 && confianza >= 0.5) confianza = 0.4
    return {
      id: `${laminaId}-a${i + 1}`,
      bbox,
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
      articulo: flagUnverifiedCita(typeof a.articulo === 'string' ? a.articulo : ''),
      fundamento: typeof a.fundamento === 'string' ? a.fundamento : '',
      sugerencia: typeof a.sugerencia === 'string' ? a.sugerencia : '',
      confianza,
      ancla: typeof a.ancla === 'string' ? a.ancla : undefined,
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
          { max_tokens: 3000, json: true },
        )
        let anotaciones = parseAnotaciones(text, lamina.id)

        // Pase de auto-verificación espacial: el modelo revisa sus marcas
        // contra la lámina y corrige/descarta. Si falla, seguimos con el
        // primer pase (mejora incremental, nunca bloqueo).
        if (anotaciones.length > 0) {
          try {
            const verifyText = await aiCompleteWithImages(
              buildVerifyPrompt(lamina.nombre, anotaciones),
              [lamina.dataUrl],
              { max_tokens: 1500, json: true },
            )
            anotaciones = applyVerification(anotaciones, verifyText)
          } catch (err) {
            console.warn('[anotacion-plano] pase de verificación falló:', err)
          }
        }

        return { id: lamina.id, nombre: lamina.nombre, anotaciones }
      }),
    )

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, laminas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
