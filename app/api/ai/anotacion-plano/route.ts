export const dynamic = 'force-dynamic'
export const maxDuration = 120

import sharp from 'sharp'
import { isAIAvailable, aiCompleteWithImages } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { reportWarning } from '@/lib/observability'
import { getContextoNormativo, flagUnverifiedCita, REGLAS_CITACION } from '@/lib/normativa-retrieval'
import type { Anotacion, LaminaAnotada } from '@/lib/anotacion-convenciones'
import {
  conMargen,
  cuadrantesConTraslape,
  recorteAHoja,
  recorteEnPixeles,
  sanearBBox,
  valeLaPenaRecortar,
  type BBox,
} from '@/lib/plano-recorte'

// ---------------------------------------------------------------------------
// Anotación sobre planos — "rayar el plano" como el revisor DOM.
//
// Ubica cada observación normativa SOBRE la lámina (bbox normalizado 0..1) con
// su tipo de marca, convención de línea, artículo y sugerencia de corrección.
// El overlay y el arrastre manual de marcas viven en el cliente.
//
// ESTRATEGIA ESPACIAL (por qué son dos pases y no uno)
// Una lámina chilena trae 6-8 sub-dibujos en una hoja A1/A0. Enviada completa,
// la API de visión la reescala a ~1024×768: cada sub-dibujo queda en ~340×250 px
// y un muro concreto en ~15 px. A esa escala el modelo NO puede ubicar un
// elemento — lo aproxima, y la marca aparece flotando en un espacio vacío.
//
// Por eso:
//   Pase 1 (hoja completa) — tarea GRUESA que sí resuelve a baja resolución:
//     inventariar los sub-dibujos y decidir en cuál cae cada observación.
//   Pase 2 (un recorte por sub-dibujo) — el recorte recibe sus propios 768 px
//     de lado corto, así que el modelo lee cotas, nombres de recinto y muros;
//     ubica el elemento DENTRO del recorte y devolvemos la coordenada a la hoja.
//
// Si el pase 1 falla, se cae al pase único de antes: peor precisión, pero nunca
// cero marcas.
// ---------------------------------------------------------------------------

/** Sub-dibujos a recortar por lámina. Acota el costo: cada uno es un request. */
const MAX_RECORTES_POR_LAMINA = 4

// NOTA SOBRE LOS EJEMPLOS DE JSON EN LOS PROMPTS
// Van en UNA sola línea a propósito. Con `response_format: json_object`, un
// ejemplo de esquema pretty-printed (multilínea, indentado) hacía que el modelo
// devolviera contenido VACÍO — verificado contra este mismo plano: mismo prompt
// con esquema multilínea → 0 caracteres; con el esquema compacto → respuesta
// correcta. El síntoma era silencioso (caía al pase de respaldo), así que si
// alguien vuelve a formatear estos ejemplos, el pipeline se degrada sin ruido.

// Artículos OGUC de PROCEDIMIENTO (cómo se solicita/tramita el permiso): regulan
// la tramitación, no una norma de fondo. Nunca fundan un defecto FÍSICO sobre el
// plano. Si el modelo los cita en una anotación de lámina, se descartan de forma
// determinista → la marca queda "sin fundamento verificado" (honesto, verificable
// por el arquitecto) en vez de mostrar una cita falsa. La tesis de la app:
// mejor SIN artículo que con uno equivocado. No incluye 5.1.17/5.1.18
// (modificación de proyecto), que sí pueden relacionarse con cambios físicos.
const ARTICULOS_PROCEDIMIENTO_OGUC = ['5.1.1', '5.1.2', '5.1.6']

function sanitizarArticuloPlano(articulo: string): string {
  const m = articulo.match(/\b(\d+(?:\.\d+)+)\s*OGUC\b/i)
  if (m && ARTICULOS_PROCEDIMIENTO_OGUC.includes(m[1])) return ''
  return flagUnverifiedCita(articulo)
}

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

## Disciplina del "articulo" (CRÍTICO)
- "articulo" debe ser la norma SUSTANTIVA que la observación incumple, y solo si un artículo del CONTEXTO NORMATIVO de arriba la funda DIRECTAMENTE.
- NUNCA cites artículos de PROCEDIMIENTO/tramitación (solicitud o modificación de permiso: p. ej. 5.1.1, 5.1.2, 5.1.6, 5.1.17) como fundamento de un defecto físico, de diseño, de accesibilidad, de rasante/distanciamiento o de destino: esos regulan CÓMO se tramita, no la norma de fondo que se incumple.
- Si el contexto NO trae un artículo que funde directamente esta observación, deja "articulo": "" (vacío) y explica la materia en "fundamento". Es mejor SIN artículo que con uno equivocado — el arquitecto verá "sin fundamento verificado" y lo revisará.
- Ejemplo: una observación de accesibilidad SIN un artículo de accesibilidad en el contexto → "articulo": "" (no 5.1.2).

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
      "articulo": "Art. X.X.X OGUC / DDU N — o \"\" si ningún artículo del contexto funda la observación",
      "fundamento": "por qué se observa (norma y razón concreta)",
      "sugerencia": "qué debe dibujar/corregir el arquitecto",
      "confianza": 0.0-1.0
    }
  ]
}

Devuelve solo las anotaciones ubicables en ESTA lámina (hasta 10), ordenadas por severidad (crítica → menor). Si de verdad no hay nada ubicable en este dibujo, devuelve "anotaciones": [] — es mejor una lámina sin marcas que marcas inventadas.`
}

// ── PASE 1 · Inventario de la hoja ────────────────────────────────────────
// Tarea deliberadamente GRUESA: qué sub-dibujos hay, dónde está cada uno y en
// cuál cae cada observación. Eso sí se resuelve a la resolución de la hoja
// completa; ubicar un muro, no.
function buildInventarioPrompt(nombre: string, observaciones?: string, contexto?: string): string {
  const obs = observaciones?.trim()
    ? `## Hallazgos del expediente (pistas)\n${observaciones.trim()}`
    : `## Sin acta adjunta\nNo hay observaciones previas: detecta tú, como revisor DOM, qué sub-dibujos muestran algo observable.`
  const ctx = contexto?.trim() ? `## Contexto del proyecto\n${contexto.trim()}` : ''

  return `Estás mirando una lámina de arquitectura chilena ("${nombre}"). Una lámina de este tipo contiene VARIOS sub-dibujos en la misma hoja (plantas por piso, elevaciones, cortes, plano de emplazamiento, plano de ubicación, planta de techos, plano de accesibilidad, cuadros de superficies y la viñeta/rótulo).

Tu tarea AHORA es solo inventariar y repartir. NO ubiques elementos concretos todavía.

${obs}

${ctx}

## Qué hacer
1. Identifica cada sub-dibujo de la hoja y su recuadro aproximado (bbox normalizado 0..1 sobre la hoja completa). Incluye el título que lleva impreso si lo tiene (ej. "PLANO DE EMPLAZAMIENTO", "SEGUNDA AMPLIACIÓN CON P.E. 222/96", "PLANTA DE TECHOS").
2. Para cada sub-dibujo, indica qué observaciones podrían verse EN ÉL, en una frase cada una. Reparte los hallazgos del contexto entre los sub-dibujos donde de verdad se apreciarían, y agrega los que tú detectes.
3. NO incluyas la viñeta/rótulo ni los cuadros de superficies como candidatos a observación: son texto, no dibujo. Inventáríalos igual con "observables": [].
4. Los hallazgos puramente DOCUMENTALES (direcciones que no coinciden entre documentos, numeración de permisos, documentos faltantes, firmas) NO van sobre ningún dibujo: omítelos por completo.

El bbox debe encerrar el sub-dibujo COMPLETO, con su título si lo tiene. Es un recuadro amplio; la precisión fina viene después.

Responde SOLO con JSON válido, con esta forma (una entrada por sub-dibujo): {"subdibujos":[{"titulo":"título impreso o descripción del sub-dibujo","bbox":{"x":0.66,"y":0.02,"w":0.33,"h":0.44},"observables":["qué se observaría aquí, una frase por ítem"]}]}

Los cuatro valores del bbox van normalizados entre 0 y 1 sobre la hoja completa. Ordena los sub-dibujos poniendo primero los que tienen "observables" no vacío.`
}

interface SubDibujo {
  titulo: string
  bbox: BBox
  observables: string[]
}

/**
 * `null` = el inventario no se pudo leer → corresponde el pase único de
 * respaldo. `[]` = se leyó bien y NO hay nada observable en esta lámina → se
 * respeta y la lámina queda sin marcas. La distinción importa: caer al pase
 * único cuando el inventario ya dijo "aquí no hay nada" reintroduce las marcas
 * adivinadas que este pipeline vino a eliminar.
 */
function parseInventario(text: string): SubDibujo[] | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    console.warn('[anotacion-plano] inventario sin JSON:', text.slice(0, 160))
    return null
  }
  let raw: { subdibujos?: unknown[] }
  try {
    raw = JSON.parse(match[0]) as { subdibujos?: unknown[] }
  } catch {
    // Causa habitual: la respuesta se cortó por max_tokens y el JSON quedó a
    // medias. Se registra el final del texto porque ahí se ve el corte.
    console.warn(
      `[anotacion-plano] inventario ilegible (${text.length} chars), cola:`,
      text.slice(-160),
    )
    return null
  }
  if (!Array.isArray(raw.subdibujos) || raw.subdibujos.length === 0) return null
  return raw.subdibujos
    .map((item): SubDibujo => {
      const s = item as Partial<SubDibujo> & { bbox?: Partial<BBox> }
      return {
        titulo: typeof s.titulo === 'string' ? s.titulo : 'sub-dibujo',
        bbox: sanearBBox(s.bbox, { x: 0, y: 0, w: 1, h: 1 }),
        observables: Array.isArray(s.observables)
          ? s.observables.filter((o): o is string => typeof o === 'string')
          : [],
      }
    })
    .filter((s) => s.observables.length > 0 && valeLaPenaRecortar(s.bbox))
}

// ── PASE 2 · Localización dentro de un recorte ────────────────────────────
// Aquí el modelo ve el sub-dibujo a ~4× la resolución efectiva que tenía en la
// hoja completa: puede leer cotas, nombres de recinto y seguir un muro. Las
// coordenadas que devuelve son RELATIVAS AL RECORTE.
function buildLocalizacionPrompt(
  nombreLamina: string,
  sub: SubDibujo,
  observaciones?: string,
  contexto?: string,
): string {
  const normativaCtx = getContextoNormativo(
    `${sub.observables.join(' ')} ${observaciones ?? ''} ${contexto ?? ''} muros aleros rasante distanciamiento elevacion emplazamiento destino uso cotas`,
  )

  return `Actúas como revisor de la Dirección de Obras Municipales (DOM) de Chile, del lado del arquitecto. La imagen adjunta es UN RECORTE de la lámina "${nombreLamina}": corresponde al sub-dibujo "${sub.titulo}". Lo ves ampliado, así que puedes leer cotas, nombres de recinto y seguir muros.

Antes de la pandemia el revisor rayaba el plano a mano y el arquitecto veía DÓNDE estaba el problema. Tú devuelves esa ubicación.

${
    sub.observables.length > 0
      ? `## Lo que hay que ubicar en este recorte
${sub.observables.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Son pistas, no una lista para colocar a la fuerza: marca solo lo que de verdad VEAS en este recorte. Si una pista no se aprecia aquí, omítela. Puedes agregar lo que el propio dibujo evidencie.`
      : `## Qué buscar
No hay una lista previa para este recorte: revísalo tú como revisor DOM y marca lo observable que veas. Si el recorte solo contiene rótulo, cuadros de texto o espacio en blanco, devuelve una lista vacía — es la respuesta correcta.
${observaciones?.trim() ? `\nPara referencia, la DOM observó lo siguiente en el expediente (puede o no verse aquí):\n${observaciones.trim()}` : ''}`
  }

${contexto?.trim() ? `## Contexto del proyecto\n${contexto.trim()}\n` : ''}
## Contexto normativo (OGUC · LGUC · DDU)
${normativaCtx}

${REGLAS_CITACION}

## Disciplina del "articulo" (CRÍTICO)
- "articulo" debe ser la norma SUSTANTIVA que la observación incumple, y solo si un artículo del CONTEXTO NORMATIVO de arriba la funda DIRECTAMENTE.
- NUNCA cites artículos de PROCEDIMIENTO/tramitación (5.1.1, 5.1.2, 5.1.6, 5.1.17) como fundamento de un defecto físico, de diseño, de accesibilidad, de rasante/distanciamiento o de destino: regulan CÓMO se tramita, no la norma de fondo.
- Si ningún artículo del contexto la funda, deja "articulo": "" y explica la materia en "fundamento". Mejor SIN artículo que con uno equivocado.

## Convención gráfica (obligatoria)
- "rojo_segmentado" = muros perimetrales que se prolongan.
- "amarillo_segmentado" = elementos eliminados o nuevos.
- Si no encaja, "convencionLinea": null.

## Qué marcar y qué NO
- Marca cosas ubicables: muros / aleros / vanos, cotas y niveles (NPT), rasantes y distanciamientos, superficies y recintos, destino o uso, accesos, escaleras, estacionamientos, elementos estructurales alterados, ampliaciones no reflejadas, discordancias entre lo dibujado y lo declarado.
- NO marques hallazgos documentales (direcciones, numeración de permisos, documentos faltantes, firmas): esos no van sobre el dibujo.
- NUNCA pongas la marca sobre el título, la leyenda o el cuadro de superficies del sub-dibujo: va sobre el ELEMENTO.

## Coordenadas (CRÍTICO)
- El bbox va normalizado 0..1 RESPECTO A ESTA IMAGEN RECORTADA, no respecto a la lámina completa. La esquina superior izquierda de esta imagen es (0,0) y la inferior derecha (1,1).
- Ajusta el bbox AL ELEMENTO: un muro/alero/vano puntual ≈ 0.05–0.25 de este recorte; un recinto ≈ 0.15–0.40. Solo una observación de zona completa justifica más de 0.6.
- En "ancla" describe el elemento concreto que estás encerrando (ej. "muro perimetral norponiente del 2° piso", "volumen agregado sobre la techumbre").
- Si ves la observación pero no logras fijar el elemento, entrégala con "confianza" < 0.5. NUNCA inventes una ubicación.

Responde SOLO con JSON válido, con esta forma: {"anotaciones":[{"bbox":{"x":0.31,"y":0.22,"w":0.12,"h":0.09},"ancla":"elemento concreto que encierras (obligatorio)","tipoMarca":"circulo","convencionLinea":"rojo_segmentado","severidad":"crítica","textoCorto":"etiqueta breve (máx 4 palabras)","observacion":"la observación completa, redacción del revisor","articulo":"Art. X.X.X OGUC o cadena vacía si ninguno la funda","fundamento":"por qué se observa","sugerencia":"qué debe dibujar/corregir el arquitecto","confianza":0.8}]}

Valores admitidos: "tipoMarca" es "circulo", "flecha", "cuadro_nota" o "linea"; "convencionLinea" es "rojo_segmentado", "amarillo_segmentado" o null; "severidad" es "crítica", "media" o "menor"; "confianza" va entre 0 y 1. El bbox va normalizado entre 0 y 1 SOBRE ESTE RECORTE.

Hasta 4 anotaciones en este recorte, por severidad. Si no hay nada ubicable aquí, devuelve una lista vacía en "anotaciones".`
}

/** Decodifica el data URL recibido a un buffer manipulable por sharp. */
async function decodificarLamina(
  dataUrl: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const buffer = Buffer.from(base64, 'base64')
  const meta = await sharp(buffer).metadata()
  if (!meta.width || !meta.height) throw new Error('No se pudo leer la lámina')
  return { buffer, width: meta.width, height: meta.height }
}

/**
 * Recorta el sub-dibujo. Se envía como JPEG de calidad alta: el recorte es
 * pequeño en píxeles comparado con la hoja, así que la calidad no encarece el
 * request y sí importa para leer cotas.
 */
async function recortarADataUrl(
  buffer: Buffer,
  rect: { left: number; top: number; width: number; height: number },
): Promise<string> {
  const out = await sharp(buffer).extract(rect).jpeg({ quality: 92 }).toBuffer()
  return `data:image/jpeg;base64,${out.toString('base64')}`
}

function parseAnotaciones(text: string, laminaId: string): Anotacion[] {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    // Antes esto degradaba a [] sin ningún rastro — indistinguible de
    // "la IA revisó el recorte y genuinamente no encontró nada que anotar".
    reportWarning('anotacion-plano: la respuesta de la IA no trae JSON — sin anotaciones para esta lámina', {
      scope: 'ai.anotacion-plano',
      extra: { laminaId, largoRespuesta: text.length },
    })
    return []
  }
  let raw: { anotaciones?: unknown[] }
  try {
    raw = JSON.parse(match[0]) as { anotaciones?: unknown[] }
  } catch (err) {
    reportWarning('anotacion-plano: JSON no parseable — sin anotaciones para esta lámina', {
      scope: 'ai.anotacion-plano',
      extra: { laminaId, error: err instanceof Error ? err.message : String(err) },
    })
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
      articulo: sanitizarArticuloPlano(typeof a.articulo === 'string' ? a.articulo : ''),
      fundamento: typeof a.fundamento === 'string' ? a.fundamento : '',
      sugerencia: typeof a.sugerencia === 'string' ? a.sugerencia : '',
      confianza,
      ancla: typeof a.ancla === 'string' ? a.ancla : undefined,
    }
  })
}

/** Pase único sobre la hoja completa: el comportamiento anterior, ahora solo
 *  como red de seguridad si el inventario no devuelve sub-dibujos usables. */
async function anotarPaseUnico(
  lamina: LaminaInput,
  observaciones?: string,
  contexto?: string,
): Promise<Anotacion[]> {
  const text = await aiCompleteWithImages(
    buildPrompt(lamina.nombre, observaciones, contexto),
    [lamina.dataUrl],
    { max_tokens: 3000, json: true },
  )
  return parseAnotaciones(text, lamina.id)
}

async function anotarLamina(
  lamina: LaminaInput,
  observaciones?: string,
  contexto?: string,
): Promise<Anotacion[]> {
  // ── Pase 1: inventario de la hoja ──
  // Se reintenta una vez: el modelo devuelve de forma intermitente una
  // respuesta vacía (finish_reason "stop" con 10 tokens y cero contenido) y
  // sin reintento la lámina se degradaba al pase único sin motivo real.
  let subdibujos: SubDibujo[] | null = null
  for (let intento = 1; intento <= 2 && subdibujos === null; intento++) {
    try {
      const inv = await aiCompleteWithImages(
        buildInventarioPrompt(lamina.nombre, observaciones, contexto),
        [lamina.dataUrl],
        // Una lámina trae 6-8 sub-dibujos, cada uno con título, bbox y sus
        // observables: con 1500 tokens el JSON se cortaba a medias y el
        // inventario se descartaba entero, degradando al pase único.
        { max_tokens: 3000, json: true },
      )
      subdibujos = parseInventario(inv)
      if (subdibujos === null && intento === 1) {
        console.info(`[anotacion-plano] "${lamina.nombre}": inventario vacío, reintentando`)
      }
    } catch (err) {
      console.warn(`[anotacion-plano] inventario falló (intento ${intento}):`, err)
    }
  }

  if (subdibujos === null) {
    // Sin inventario seguimos recortando, solo que a ciegas por cuadrantes:
    // se pierde el reparto por sub-dibujo pero se conserva la resolución, que
    // es lo que hace que las marcas caigan sobre el elemento correcto.
    console.info(`[anotacion-plano] "${lamina.nombre}": sin inventario → grilla de cuadrantes`)
    subdibujos = cuadrantesConTraslape().map((bbox, i) => ({
      titulo: `cuadrante ${i + 1} de la lámina`,
      bbox,
      observables: [],
    }))
  }
  if (subdibujos.length === 0) {
    // El inventario leyó la hoja y no encontró nada ubicable. Se respeta.
    console.info(`[anotacion-plano] "${lamina.nombre}": sin sub-dibujos observables`)
    return []
  }

  // ── Pase 2: un recorte por sub-dibujo con observables ──
  let imagen: { buffer: Buffer; width: number; height: number }
  try {
    imagen = await decodificarLamina(lamina.dataUrl)
  } catch (err) {
    console.warn('[anotacion-plano] no se pudo decodificar la lámina:', err)
    return anotarPaseUnico(lamina, observaciones, contexto)
  }

  const seleccion = subdibujos.slice(0, MAX_RECORTES_POR_LAMINA)
  const porSubdibujo = await Promise.all(
    seleccion.map(async (sub, i): Promise<{ ok: boolean; anotaciones: Anotacion[] }> => {
      const recorte = conMargen(sub.bbox)
      try {
        const crop = await recortarADataUrl(
          imagen.buffer,
          recorteEnPixeles(recorte, imagen.width, imagen.height),
        )
        const text = await aiCompleteWithImages(
          buildLocalizacionPrompt(lamina.nombre, sub, observaciones, contexto),
          [crop],
          { max_tokens: 2000, json: true },
        )
        // El modelo respondió en coordenadas DEL RECORTE: hay que devolverlas
        // a la hoja para que la marca caiga donde corresponde en el visor.
        return {
          ok: true,
          anotaciones: parseAnotaciones(text, `${lamina.id}-s${i + 1}`).map((a) => ({
            ...a,
            bbox: recorteAHoja(a.bbox, recorte),
            ancla: a.ancla ? `${sub.titulo} — ${a.ancla}` : sub.titulo,
          })),
        }
      } catch (err) {
        console.warn(`[anotacion-plano] recorte "${sub.titulo}" falló:`, err)
        return { ok: false, anotaciones: [] }
      }
    }),
  )

  // Un recorte sin marcas es un resultado válido ("aquí no hay nada"); un
  // recorte que reventó, no. Solo si reventaron TODOS recurrimos al respaldo.
  if (porSubdibujo.every((r) => !r.ok)) {
    console.warn(`[anotacion-plano] "${lamina.nombre}": todos los recortes fallaron`)
    return anotarPaseUnico(lamina, observaciones, contexto)
  }

  const anotaciones = porSubdibujo.flatMap((r) => r.anotaciones)
  console.info(
    `[anotacion-plano] "${lamina.nombre}": ${seleccion.length} recorte(s) → ${anotaciones.length} marca(s)`,
  )
  return anotaciones
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
      body.laminas.map(async (lamina) => ({
        id: lamina.id,
        nombre: lamina.nombre,
        anotaciones: await anotarLamina(lamina, body.observaciones, body.contexto),
      })),
    )

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, laminas })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
