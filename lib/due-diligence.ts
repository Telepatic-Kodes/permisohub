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
import {
  getContextoNormativo,
  getArticuloById,
  urlDeCitable,
  flagUnverifiedCita,
  REGLAS_CITACION,
  type FuenteNormativa,
} from '@/lib/normativa-retrieval'
import { fixMojibakeArcGIS } from '@/lib/zonificacion-format'

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

// Fuente de un hallazgo: las tres curadas (OGUC/LGUC/DDU, resueltas contra
// normativa-retrieval.ts) más 'PRC' — la zonificación real del proyecto,
// resuelta directamente desde sus datos de zona (NUNCA contra la base curada,
// que no sabe resolver PRC; ver Anti-Pattern del research de Fase 12).
export type FuenteHallazgo = FuenteNormativa | 'PRC'

// Cita normativa estructurada que fundamenta un hallazgo (OGUC/LGUC/DDU/PRC).
// `verificado=true` solo si getArticuloById() encontró el id en la base curada
// (o, para PRC, si la zona del proyecto era utilizable).
export interface RefNormativa {
  fuente: FuenteHallazgo
  id: string // id contra la base: '5.1.2' (OGUC), '116 bis' (LGUC), 'ddu-328' (DDU); zona_codigo o 'zona' (PRC)
  etiqueta: string // texto para render: "Art. 5.1.2 OGUC" / "DDU 328" / "Zona ZC-3 — ..."
  url?: string // link a la fuente (propio o fallback); ausente si no aplica
  verificado: boolean
}

export type EstadoRevision = 'propuesto' | 'confirmado' | 'descartado'

export interface Hallazgo {
  codigo: string // "C1", "A2", "M3"
  severidad: Severidad
  titulo: string
  descripcion: string
  refDOM?: string // "RES. 63/2026 · N°1.1"
  refFuente?: string // "Memoria (02) vs EETT (05)"
  // ── Verificación (checkpoint humano) — todos opcionales para tolerar filas
  // antiguas; normalizar al leer con defaults. ──
  refNormativa?: RefNormativa[] // fundamento normativo citado + verificado
  estadoRevision?: EstadoRevision // undefined ⇒ 'propuesto'
  tituloEditado?: string // edición humana del título (el original se conserva)
  descripcionEditada?: string
  editadoEl?: string // ISO
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
  // Gate de verificación humana. undefined ⇒ 'pendiente' (filas antiguas). El
  // DD solo fluye al PMO/planos cuando revisionEstado === 'verificado'.
  revisionEstado?: 'pendiente' | 'verificado'
  verificadoEl?: string // ISO, al confirmar
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
  destino_sii?: string | null
  zona_status?: string | null
  zona_usos_disponibles?: boolean | null
  zona_codigo?: string | null
  zona_nombre?: string | null
  zona_uperm?: string | null
  zona_uproh?: string | null
  zona_fuente_url?: string | null
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

// Query de recuperación normativa: se arma desde los hechos ya extraídos de los
// documentos (tipo real, observaciones DOM, datos clave, incoherencias) + el
// tipo de trámite, para traer los artículos OGUC/LGUC/DDU más pertinentes.
function buildRetrievalQuery(extracts: DocExtract[], proyecto: ProyectoContexto): string {
  const bits: string[] = [proyecto.tipo ?? '']
  for (const e of extracts) {
    if (e.error) continue
    bits.push(e.tipoReal, ...e.observacionesDOM, ...e.datosClave, ...e.incoherenciasInternas)
  }
  return bits
    .join(' ')
    .toLowerCase()
    .slice(0, 1200) // acota el input del scorer de keywords
}

// Sección opcional de zonificación (PRC) del proyecto, para que la síntesis
// pueda contrastar el destino declarado (SII) contra los usos permitidos y
// prohibidos de la zona. Mismo guard compuesto que el resto de la fase: la
// zona debe estar 'encontrado' Y tener usos disponibles (una comuna como
// Ñuñoa queda 'encontrado' pero sin texto de uperm/uproh que comparar — ver
// Pitfall 1 del research). Aplica fixMojibakeArcGIS() a todo texto de zona
// antes de inyectarlo en el prompt. Vacía (string '') si la zona no es
// utilizable — no hay nada que agregar al prompt en ese caso.
function seccionZonaProyecto(proyecto: ProyectoContexto): string {
  const utilizable = proyecto.zona_status === 'encontrado' && proyecto.zona_usos_disponibles === true
  if (!utilizable) return ''
  const uperm = fixMojibakeArcGIS(proyecto.zona_uperm) ?? '(sin dato)'
  const uproh = fixMojibakeArcGIS(proyecto.zona_uproh) ?? '(sin dato)'
  const nombre = fixMojibakeArcGIS(proyecto.zona_nombre)
  return `\n## Zonificación (PRC) del proyecto\n- Zona: ${proyecto.zona_codigo ?? ''}${nombre ? ` — ${nombre}` : ''}\n- Usos permitidos: ${uperm}\n- Usos prohibidos: ${uproh}\n- Destino declarado (SII): ${proyecto.destino_sii ?? 'no informado'}\n`
}

function buildSynthesisPrompt(extracts: DocExtract[], proyecto: ProyectoContexto): string {
  // Contexto normativo real (OGUC/LGUC/DDU) para que los hallazgos se funden en
  // artículos existentes y no en invención. Cap de tamaño por presupuesto de
  // tokens (el JSON de extracts ya es grande).
  const ctxRaw = getContextoNormativo(buildRetrievalQuery(extracts, proyecto), 5)
  const contextoNormativo = ctxRaw.length > 4000 ? `${ctxRaw.slice(0, 4000)}\n…(contexto truncado)` : ctxRaw
  const zonaSeccion = seccionZonaProyecto(proyecto)

  return `Eres un revisor senior de permisos de edificación en Chile (OGUC/LGUC + Plan Regulador). Recibes los resúmenes estructurados de TODOS los documentos de un expediente. Tu tarea es producir un DUE DILIGENCE documental: cruzar la información entre documentos, detectar el estado real ante la DOM y priorizar hallazgos FUNDAMENTADOS en la normativa.

## Proyecto
- Nombre: ${proyecto.nombre}
- Dirección: ${proyecto.direccion ?? 'no informada'}
- Municipio: ${proyecto.municipio ?? 'no informado'}
- Rol SII: ${proyecto.rol_sii ?? 'no informado'}
- Tipo de trámite: ${proyecto.tipo ?? 'no informado'}

## Documentos analizados (JSON por documento)
${JSON.stringify(extracts, null, 2)}

## Contexto normativo (OGUC · LGUC · DDU)
${contextoNormativo}
${zonaSeccion}
${REGLAS_CITACION}

## Instrucciones
1. ESTADO DOM: si algún documento es un acto de la DOM que rechaza/observa el ingreso, el estado es RECHAZADO; usa su N° de resolución, fecha y expediente. Ese rechazo domina el riesgo global (ALTO).
2. INVENTARIO: una fila por documento (usa el índice numérico si el nombre lo trae, ej. "01"). Marca faltantes evidentes (documentos que un expediente de este tipo debería tener y no aparecen).
3. HALLAZGOS: prioriza. Cada observación de la DOM es al menos "alto"; un rechazo de fondo o falta de documento esencial es "critico". Las contradicciones ENTRE documentos (superficies, carga de ocupación, numeración de permisos/recepciones) son hallazgos: cítalas en refFuente. Códigos: C1,C2… (crítico), A1,A2… (alto), M1,M2… (medio/saneo).
4. FUNDAMENTO NORMATIVO — obligatorio: por cada hallazgo, en "refNormativa", cita el/los artículo(s) del CONTEXTO NORMATIVO que lo fundan, usando el "id" EXACTO tal como aparece (OGUC/LGUC: el número de artículo, ej. "5.1.2"; DDU: el id "ddu-###" o el número). Cita SOLO ids presentes en el contexto. Si además, según la sección "Zonificación (PRC) del proyecto" (cuando esté presente), el DESTINO DECLARADO no calza con los usos permitidos de la zona (o coincide con un uso prohibido), agrega un hallazgo adicional citando "fuente": "PRC" (el "id" puede ser cualquier valor, ej. "zona" — se resuelve automáticamente contra los datos de zona del proyecto, no contra este contexto). Si NINGÚN artículo del contexto funda un hallazgo y no aplica PRC, deja "refNormativa": [] (se mostrará como "sin fundamento verificado" — es preferible a inventar).
5. VIGENCIAS: lista certificados con caducidad y su estado (ok/warn/crit).
6. PRÓXIMOS PASOS: acciones concretas en orden; marca critico=true las de fondo.

Responde SOLO con JSON válido (sin markdown), con esta forma EXACTA:
{
  "riesgoGlobal": "BAJO" | "MEDIO" | "ALTO",
  "completitud": { "presentes": number, "esperados": number },
  "estadoDOM": { "rechazado": boolean, "resolucion": string|null, "fecha": string|null, "expediente": string|null, "detalle": string|null },
  "resumenEjecutivo": "2-4 frases",
  "inventario": [ { "indice": "01", "documento": "…", "fecha": "…"|null, "estado": "conforme|revisar|corregir|faltante|vigente|legible|acto_dom", "estadoLabel": "…", "observacion": "…" } ],
  "hallazgos": [ { "codigo": "C1", "severidad": "critico|alto|medio", "titulo": "…", "descripcion": "…", "refDOM": "…"|null, "refFuente": "…"|null, "refNormativa": [ { "fuente": "OGUC|LGUC|DDU|PRC", "id": "<id EXACTO del contexto, o 'zona' para PRC>" } ] } ],
  "historial": [ { "periodo": "…", "titulo": "…", "detalle": "…", "m2": "…"|null, "critico": false } ],
  "vigencias": [ { "hito": "…", "fecha": "…", "estado": "…", "nivel": "ok|warn|crit" } ],
  "proximosPasos": [ { "titulo": "…", "detalle": "…", "critico": false } ]
}`
}

// El modelo devuelve refNormativa como { fuente, id } crudo; el post-proceso lo
// resuelve contra la base curada (etiqueta/url/verificado).
interface RawRefNormativa {
  fuente?: string
  id?: string
}
type RawHallazgo = Omit<Hallazgo, 'refNormativa'> & { refNormativa?: RawRefNormativa[] }

interface SynthesisPayload {
  riesgoGlobal?: RiesgoGlobal
  completitud?: { presentes?: number; esperados?: number }
  estadoDOM?: Partial<EstadoDOM>
  resumenEjecutivo?: string
  inventario?: InventarioItem[]
  hallazgos?: RawHallazgo[]
  historial?: HistorialNodo[]
  vigencias?: Vigencia[]
  proximosPasos?: PasoRecomendado[]
}

const FUENTES_VALIDAS: FuenteNormativa[] = ['OGUC', 'LGUC', 'DDU']

// Resuelve las citas crudas del modelo. OGUC/LGUC/DDU: contra la base curada
// (setea verificado/url/etiqueta; id inexistente queda verificado=false con
// "(por verificar)" — nunca se presenta como fundada). PRC: NUNCA contra
// getArticuloById (no conoce PRC) — se construye directo desde los datos de
// zona del proyecto, solo si la zona es utilizable; si no, se descarta la
// cita en silencio (nunca una cita a medias). Descarta citas con fuente
// inválida.
function resolverRefNormativa(raw: RawRefNormativa[] | undefined, proyecto: ProyectoContexto): RefNormativa[] {
  if (!Array.isArray(raw)) return []
  const out: RefNormativa[] = []
  const zonaUtilizable = proyecto.zona_status === 'encontrado' && proyecto.zona_usos_disponibles === true
  for (const r of raw) {
    const fuenteRaw = typeof r.fuente === 'string' ? r.fuente.toUpperCase() : null
    if (fuenteRaw === 'PRC') {
      if (zonaUtilizable) {
        const nombre = fixMojibakeArcGIS(proyecto.zona_nombre)
        out.push({
          fuente: 'PRC',
          id: proyecto.zona_codigo ?? 'zona',
          etiqueta: `Zona ${proyecto.zona_codigo ?? ''}${nombre ? ` — ${nombre}` : ''}`.trim(),
          url: proyecto.zona_fuente_url ?? undefined,
          verificado: true,
        })
      }
      // zona no utilizable: descarta la cita silenciosamente, no empuja nada a `out`.
      continue
    }
    const fuente = fuenteRaw && FUENTES_VALIDAS.includes(fuenteRaw as FuenteNormativa) ? (fuenteRaw as FuenteNormativa) : null
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    if (!fuente || !id) continue
    const art = getArticuloById(fuente, id)
    if (art) {
      out.push({ fuente, id: art.id, etiqueta: art.etiqueta, url: urlDeCitable(art), verificado: art.verificado })
    } else {
      out.push({ fuente, id, etiqueta: flagUnverifiedCita(`Art. ${id} ${fuente}`), verificado: false })
    }
  }
  return out
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

  // Post-proceso de citas + estado de revisión: cada hallazgo nace 'propuesto'
  // con su fundamento normativo resuelto y verificado contra la base.
  const hallazgos: Hallazgo[] = (parsed?.hallazgos ?? []).map((h) => ({
    ...h,
    refNormativa: resolverRefNormativa(h.refNormativa, proyecto),
    estadoRevision: 'propuesto' as const,
  }))
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
    revisionEstado: 'pendiente',
  }
}
