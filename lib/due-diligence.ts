// ---------------------------------------------------------------------------
// Due Diligence documental — motor map-reduce
//
// Etapa 1 (map):    extractDocumentContent()  — lee UN PDF con gpt-4o vision y
//                   devuelve hechos estructurados (tipo real, datos clave,
//                   fechas, vigencia, si es un acto DOM / rechazo, incoherencias).
// Etapa 2 (reduce): synthesizeDueDiligence()  — recibe los resúmenes de TODOS
//                   los documentos y produce el informe cruzado (inventario,
//                   hallazgos priorizados, vigencias, próximos pasos, veredicto).
//
// La orquestación (descarga desde Storage, batching, escritura del progreso en
// la tabla due_diligence_reports) vive en app/api/ai/due-diligence/route.ts.
// ---------------------------------------------------------------------------

import { aiComplete, aiCompleteWithPDF } from '@/lib/ai'

// ── Tipos compartidos (contrato entre route ⇆ UI) ──────────────────────────

export type Severidad = 'critico' | 'alto' | 'medio'
export type RiesgoGlobal = 'BAJO' | 'MEDIO' | 'ALTO'
export type EstadoInventario =
  | 'conforme'
  | 'revisar'
  | 'corregir'
  | 'faltante'
  | 'vigente'
  | 'legible'
  | 'acto_dom'

/** Resumen estructurado que devuelve la IA por CADA documento (etapa map). */
export interface DocExtract {
  nombreArchivo: string
  tipoReal: string // p.ej. "Resolución DOM (rechazo)", "Memoria explicativa", "Plano"
  esActoDOM: boolean // true si es resolución/ordinario/acta emitido por la DOM
  esRechazo: boolean // true si el acto DOM rechaza/observa el ingreso
  datosClave: string[] // rol, direccion, superficies, N° permiso, N° expediente, etc.
  fechas: string[] // fechas relevantes detectadas (emisión, vigencia, ingreso…)
  vigencia: string | null // "vigente hasta 2027-11", "sin vencimiento", null si N/A
  observacionesDOM: string[] // si es acto DOM: observaciones textuales
  incoherenciasInternas: string[] // contradicciones dentro del propio documento
  resumen: string // 1-2 frases
  error?: string // si el documento no se pudo leer (DWG, corrupto, etc.)
}

export interface InventarioItem {
  indice: string // "01".."99" o "—"
  documento: string
  fecha?: string
  estado: EstadoInventario
  estadoLabel: string // etiqueta para el pill, p.ej. "Conforme", "Faltante"
  observacion: string
}

export interface Hallazgo {
  codigo: string // "C1", "A2", "M3"
  severidad: Severidad
  titulo: string
  descripcion: string
  refDOM?: string // "RES. 63/2026 · N°1.1"
  refFuente?: string // "Memoria (02) vs EETT (05)"
}

export interface Vigencia {
  hito: string
  fecha: string
  estado: string
  nivel: 'ok' | 'warn' | 'crit'
}

export interface HistorialNodo {
  periodo: string
  titulo: string
  detalle: string
  m2?: string
  critico?: boolean
}

export interface PasoRecomendado {
  titulo: string
  detalle: string
  critico?: boolean
}

export interface EstadoDOM {
  rechazado: boolean
  resolucion?: string
  fecha?: string
  expediente?: string
  detalle?: string
}

/** Informe final (etapa reduce). Es el `result` guardado en la tabla. */
export interface DueDiligenceResult {
  proyecto: {
    nombre: string
    direccion?: string
    municipio?: string
    rol?: string
  }
  riesgoGlobal: RiesgoGlobal
  completitud: { presentes: number; esperados: number }
  estadoDOM: EstadoDOM
  resumenEjecutivo: string
  inventario: InventarioItem[]
  hallazgos: Hallazgo[]
  historial: HistorialNodo[]
  vigencias: Vigencia[]
  proximosPasos: PasoRecomendado[]
  conteos: { criticos: number; altos: number; medios: number }
  generadoEl: string // ISO date
}

export interface DueDiligenceProgress {
  current: number
  total: number
  label: string
}

/** Fila de la tabla due_diligence_reports. */
export interface DueDiligenceReportRow {
  id: string
  proyecto_id: string
  user_id: string
  status: 'pending' | 'processing' | 'done' | 'error'
  progress: DueDiligenceProgress | null
  result: DueDiligenceResult | null
  error: string | null
  created_at: string
}

/** Datos mínimos del proyecto que pasa el route a la síntesis. */
export interface ProyectoContexto {
  nombre: string
  direccion?: string | null
  municipio?: string | null
  rol_sii?: string | null
  tipo?: string | null
}

// ── Utilidades ──────────────────────────────────────────────────────────────

/** Extrae el primer bloque JSON balanceado de un texto (tolera ```json ... ```). */
export function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

/**
 * Ejecuta `worker` sobre `items` con concurrencia acotada, preservando el orden
 * del arreglo de salida. `onSettled` se llama tras cada ítem (para progreso).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onSettled?: (index: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) break
      results[i] = await worker(items[i], i)
      onSettled?.(i)
    }
  })
  await Promise.all(runners)
  return results
}

// ── Etapa 1 · extracción por documento ──────────────────────────────────────

const EXTRACT_PROMPT = `Eres un revisor experto de la Dirección de Obras Municipales (DOM) chilena analizando UN documento de un expediente de permiso/edificación.

Lee el documento adjunto y extrae SOLO hechos verificables (no inventes datos que no aparezcan).

Presta especial atención a:
- Si el documento es un ACTO DE LA DOM (resolución, ordinario, acta de observaciones, certificado de recepción). Marca esActoDOM=true.
- Si ese acto RECHAZA u OBSERVA el ingreso (busca "RECHAZAR", "no cumple", "se observa", "subsanar"). Marca esRechazo=true y copia las observaciones textuales en observacionesDOM.
- Datos clave: rol SII, dirección, N° de permiso/expediente/resolución, superficies (m²), carga de ocupación, N° de estacionamientos, destino, artículos citados (OGUC/LGUC/PRC).
- Fechas relevantes (emisión, ingreso, vigencia, recepción).
- Vigencia si es un certificado con caducidad (ej. dotación sanitaria válida 2 años).
- Incoherencias DENTRO del propio documento.

Responde SOLO con JSON válido (sin markdown):
{
  "tipoReal": "tipo real del documento inferido de su CONTENIDO",
  "esActoDOM": true|false,
  "esRechazo": true|false,
  "datosClave": ["dato: valor", ...],
  "fechas": ["etiqueta: YYYY-MM-DD | texto", ...],
  "vigencia": "texto de vigencia" | null,
  "observacionesDOM": ["observación textual", ...],
  "incoherenciasInternas": ["descripción", ...],
  "resumen": "1-2 frases"
}`

/**
 * Etapa map: lee un PDF y devuelve su resumen estructurado.
 * Nunca lanza: ante error devuelve un DocExtract con `error` para no abortar el lote.
 */
export async function extractDocumentContent(
  pdfBase64: string,
  nombreArchivo: string,
): Promise<DocExtract> {
  const base: DocExtract = {
    nombreArchivo,
    tipoReal: 'Desconocido',
    esActoDOM: false,
    esRechazo: false,
    datosClave: [],
    fechas: [],
    vigencia: null,
    observacionesDOM: [],
    incoherenciasInternas: [],
    resumen: '',
  }

  try {
    const text = await aiCompleteWithPDF(EXTRACT_PROMPT, pdfBase64, nombreArchivo, {
      max_tokens: 1800,
    })
    const parsed = extractJson<Partial<DocExtract>>(text)
    if (!parsed) {
      return { ...base, error: 'La IA no devolvió JSON legible para este documento.' }
    }
    return {
      ...base,
      tipoReal: parsed.tipoReal ?? base.tipoReal,
      esActoDOM: parsed.esActoDOM ?? false,
      esRechazo: parsed.esRechazo ?? false,
      datosClave: parsed.datosClave ?? [],
      fechas: parsed.fechas ?? [],
      vigencia: parsed.vigencia ?? null,
      observacionesDOM: parsed.observacionesDOM ?? [],
      incoherenciasInternas: parsed.incoherenciasInternas ?? [],
      resumen: parsed.resumen ?? '',
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { ...base, error: `No se pudo leer el documento: ${msg}` }
  }
}

// ── Etapa 2 · síntesis cruzada ───────────────────────────────────────────────

function buildSynthesisPrompt(extracts: DocExtract[], proyecto: ProyectoContexto): string {
  return `Eres un revisor senior de permisos de edificación en Chile (OGUC/LGUC + Plan Regulador). Recibes los resúmenes estructurados de TODOS los documentos de un expediente. Tu tarea es producir un DUE DILIGENCE documental: cruzar la información entre documentos, detectar el estado real ante la DOM y priorizar hallazgos.

## Proyecto
- Nombre: ${proyecto.nombre}
- Dirección: ${proyecto.direccion ?? 'no informada'}
- Municipio: ${proyecto.municipio ?? 'no informado'}
- Rol SII: ${proyecto.rol_sii ?? 'no informado'}
- Tipo de trámite: ${proyecto.tipo ?? 'no informado'}

## Documentos analizados (JSON por documento)
${JSON.stringify(extracts, null, 2)}

## Instrucciones
1. ESTADO DOM: si algún documento es un acto de la DOM que rechaza/observa el ingreso, el estado es RECHAZADO; usa su N° de resolución, fecha y expediente. Ese rechazo domina el riesgo global (ALTO).
2. INVENTARIO: una fila por documento (usa el índice numérico si el nombre lo trae, ej. "01"). Marca faltantes evidentes (documentos que un expediente de este tipo debería tener y no aparecen).
3. HALLAZGOS: prioriza. Cada observación de la DOM es al menos "alto"; un rechazo de fondo o falta de documento esencial es "critico". Las contradicciones ENTRE documentos (superficies, carga de ocupación, numeración de permisos/recepciones) son hallazgos: cítalas en refFuente. Códigos: C1,C2… (crítico), A1,A2… (alto), M1,M2… (medio/saneo).
4. VIGENCIAS: lista certificados con caducidad y su estado (ok/warn/crit).
5. PRÓXIMOS PASOS: acciones concretas en orden; marca critico=true las de fondo.
6. No inventes artículos ni números que no estén en los documentos.

Responde SOLO con JSON válido (sin markdown), con esta forma EXACTA:
{
  "riesgoGlobal": "BAJO" | "MEDIO" | "ALTO",
  "completitud": { "presentes": number, "esperados": number },
  "estadoDOM": { "rechazado": boolean, "resolucion": string|null, "fecha": string|null, "expediente": string|null, "detalle": string|null },
  "resumenEjecutivo": "2-4 frases",
  "inventario": [ { "indice": "01", "documento": "…", "fecha": "…"|null, "estado": "conforme|revisar|corregir|faltante|vigente|legible|acto_dom", "estadoLabel": "…", "observacion": "…" } ],
  "hallazgos": [ { "codigo": "C1", "severidad": "critico|alto|medio", "titulo": "…", "descripcion": "…", "refDOM": "…"|null, "refFuente": "…"|null } ],
  "historial": [ { "periodo": "…", "titulo": "…", "detalle": "…", "m2": "…"|null, "critico": false } ],
  "vigencias": [ { "hito": "…", "fecha": "…", "estado": "…", "nivel": "ok|warn|crit" } ],
  "proximosPasos": [ { "titulo": "…", "detalle": "…", "critico": false } ]
}`
}

interface SynthesisPayload {
  riesgoGlobal?: RiesgoGlobal
  completitud?: { presentes?: number; esperados?: number }
  estadoDOM?: Partial<EstadoDOM>
  resumenEjecutivo?: string
  inventario?: InventarioItem[]
  hallazgos?: Hallazgo[]
  historial?: HistorialNodo[]
  vigencias?: Vigencia[]
  proximosPasos?: PasoRecomendado[]
}

/**
 * Etapa reduce: cruza todos los DocExtract y arma el informe final.
 * `generadoEl` se inyecta desde el route (Date no está disponible en algunos
 * contextos de build); si no se pasa, queda string vacío.
 */
export async function synthesizeDueDiligence(
  extracts: DocExtract[],
  proyecto: ProyectoContexto,
  generadoEl: string,
): Promise<DueDiligenceResult> {
  const text = await aiComplete(
    [{ role: 'user', content: buildSynthesisPrompt(extracts, proyecto) }],
    { max_tokens: 4096 },
  )
  const parsed = extractJson<SynthesisPayload>(text)

  const hallazgos = parsed?.hallazgos ?? []
  const conteos = {
    criticos: hallazgos.filter((h) => h.severidad === 'critico').length,
    altos: hallazgos.filter((h) => h.severidad === 'alto').length,
    medios: hallazgos.filter((h) => h.severidad === 'medio').length,
  }

  return {
    proyecto: {
      nombre: proyecto.nombre,
      direccion: proyecto.direccion ?? undefined,
      municipio: proyecto.municipio ?? undefined,
      rol: proyecto.rol_sii ?? undefined,
    },
    riesgoGlobal: parsed?.riesgoGlobal ?? 'MEDIO',
    completitud: {
      presentes: parsed?.completitud?.presentes ?? extracts.filter((e) => !e.error).length,
      esperados: parsed?.completitud?.esperados ?? extracts.length,
    },
    estadoDOM: {
      rechazado: parsed?.estadoDOM?.rechazado ?? false,
      resolucion: parsed?.estadoDOM?.resolucion ?? undefined,
      fecha: parsed?.estadoDOM?.fecha ?? undefined,
      expediente: parsed?.estadoDOM?.expediente ?? undefined,
      detalle: parsed?.estadoDOM?.detalle ?? undefined,
    },
    resumenEjecutivo: parsed?.resumenEjecutivo ?? '',
    inventario: parsed?.inventario ?? [],
    hallazgos,
    historial: parsed?.historial ?? [],
    vigencias: parsed?.vigencias ?? [],
    proximosPasos: parsed?.proximosPasos ?? [],
    conteos,
    generadoEl,
  }
}
