// ---------------------------------------------------------------------------
// Gate de completitud del expediente (Δ5) — determinista, SIN IA.
//
// Antes del Due Diligence de fondo, esta ayuda responde una pregunta simple y
// honesta: dado el tipo de trámite, ¿están presentes los documentos que un
// expediente de ese tipo SUELE tener? Compara los tipos de documento subidos
// (los mismos que clasifica document-upload.tsx) contra una checklist curada.
//
// IMPORTANTE — alcance y honestidad:
//   · Es una checklist PRELIMINAR de referencia, curada de forma conservadora
//     con documentos de amplio consenso para un ingreso ante la DOM. NO es la
//     lista oficial de un municipio ni un pronunciamiento normativo.
//   · Cada DOM publica sus propios requisitos (Art. 5.1.6 OGUC y ordenanzas
//     locales fijan el detalle exacto según el caso). Esta lista NO reemplaza
//     ese checklist oficial: lo antecede, para evitar el "expediente incompleto".
//   · Es determinista: mismo input → mismo output. No inventa exigencias
//     legales con número de artículo ni afirma obligatoriedad que no podamos
//     fundar; por eso el resumen habla de "presente/faltante", no de "cumple".
//   · Refinable: los detectores y la obligatoriedad se pueden ajustar por
//     municipio a medida que se curen requisitos oficiales.
// ---------------------------------------------------------------------------

/**
 * Un requisito documental de un expediente. `detecta` recibe el tipo de
 * documento ya clasificado (ver `clasificarTipo` en document-upload.tsx) y el
 * nombre del archivo, y decide si ese documento satisface el requisito.
 */
export interface RequisitoDoc {
  clave: string
  label: string
  /** Si es un documento que el expediente normalmente debe incluir (gate). */
  obligatorio: boolean
  detecta: (tipoDoc: string, nombre: string) => boolean
}

const norm = (s: string | undefined): string => (s ?? "").toLowerCase()

// ── Requisitos reutilizables ─────────────────────────────────────────────────
// Cada uno matchea primero por el tipo clasificado y, como respaldo, por el
// nombre del archivo (algunos documentos caen en "Otro"/"Correspondencia").

const R_FORMULARIO_SOLICITUD: RequisitoDoc = {
  clave: "formulario_solicitud",
  label: "Formulario / solicitud de ingreso",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Formulario municipal" || /formulario|solicitud/.test(norm(nombre)),
}

const R_CIP: RequisitoDoc = {
  clave: "certificado_informaciones_previas",
  label: "Certificado de Informaciones Previas (CIP)",
  obligatorio: true,
  detecta: (tipo, nombre) => {
    const n = norm(nombre)
    if (/informaciones previas|\bcip\b/.test(n)) return true
    return tipo === "Certificado DOM" && /previa|informaci/.test(n)
  },
}

const R_MEMORIA: RequisitoDoc = {
  clave: "memoria",
  label: "Memoria / descripción del proyecto",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Memoria" || /memoria|descripci[oó]n del proyecto/.test(norm(nombre)),
}

const R_EETT: RequisitoDoc = {
  clave: "especificaciones_tecnicas",
  label: "Especificaciones técnicas (EETT)",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Especificaciones técnicas" || /especificaci|\beett\b/.test(norm(nombre)),
}

const R_PLANOS_ARQ: RequisitoDoc = {
  clave: "planos_arquitectura",
  label: "Planos de arquitectura",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Plano de arquitectura" ||
    /\bplano|planta|elevaci|corte|l[aá]mina|arquitect/.test(norm(nombre)),
}

const R_DECLARACION_ARQ: RequisitoDoc = {
  clave: "declaracion_arquitecto",
  label: "Declaración del arquitecto (patrocinio / responsabilidad)",
  obligatorio: true,
  detecta: (_tipo, nombre) =>
    /declaraci|patrocinio|responsab/.test(norm(nombre)),
}

const R_DECLARACION_JURADA: RequisitoDoc = {
  clave: "declaracion_jurada",
  label: "Declaración jurada",
  obligatorio: true,
  detecta: (_tipo, nombre) => /declaraci[oó]n\s+jurada|declaraci[oó]n/.test(norm(nombre)),
}

const R_CROQUIS: RequisitoDoc = {
  clave: "croquis_plano",
  label: "Croquis o plano de la obra",
  obligatorio: false,
  detecta: (tipo, nombre) =>
    tipo === "Plano de arquitectura" ||
    tipo === "Plano estructural" ||
    /\bplano|planta|croquis|l[aá]mina/.test(norm(nombre)),
}

const R_PERMISO_ANTERIOR: RequisitoDoc = {
  clave: "permiso_anterior",
  label: "Permiso / antecedente anterior de la propiedad",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Permiso anterior" ||
    /permiso|resoluci[oó]n|recepci[oó]n|antecedente/.test(norm(nombre)),
}

const R_PLANO_ESTRUCTURAL: RequisitoDoc = {
  clave: "plano_estructural",
  label: "Planos / memoria de cálculo estructural",
  obligatorio: false,
  detecta: (tipo, nombre) =>
    tipo === "Plano estructural" || /estruct|c[aá]lculo/.test(norm(nombre)),
}

// ── Checklists por tipo de trámite ───────────────────────────────────────────
// Curadas de forma conservadora. Para trámites sin entrada específica se usa
// la checklist genérica (base de un ingreso documental ante la DOM).

const CHECKLIST_EDIFICACION: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_CIP,
  R_MEMORIA,
  R_EETT,
  R_PLANOS_ARQ,
  R_DECLARACION_ARQ,
  R_PLANO_ESTRUCTURAL,
]

// Base genérica: lo mínimo transversal a casi cualquier ingreso a la DOM.
export const CHECKLIST_GENERICA: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_CIP,
  R_MEMORIA,
  R_PLANOS_ARQ,
]

/**
 * Checklist preliminar de referencia por tipo de trámite. Las claves usan los
 * `TipoPermiso` de types/index.ts. Los tipos no listados degradan a
 * `CHECKLIST_GENERICA`.
 */
export const DOCS_REQUERIDOS_POR_TIPO: Record<string, RequisitoDoc[]> = {
  permiso_edificacion: CHECKLIST_EDIFICACION,
  ampliacion: [
    R_FORMULARIO_SOLICITUD,
    R_CIP,
    R_MEMORIA,
    R_EETT,
    R_PLANOS_ARQ,
    R_DECLARACION_ARQ,
    R_PERMISO_ANTERIOR,
  ],
  anteproyecto: [
    R_FORMULARIO_SOLICITUD,
    R_CIP,
    R_MEMORIA,
    R_PLANOS_ARQ,
  ],
  cambio_destino: [
    R_FORMULARIO_SOLICITUD,
    R_CIP,
    R_MEMORIA,
    R_PLANOS_ARQ,
    R_PERMISO_ANTERIOR,
  ],
  // Obra menor exenta: por su naturaleza el expediente es mínimo.
  obra_menor_sin_permiso: [
    R_DECLARACION_JURADA,
    R_CROQUIS,
  ],
  obra_menor_con_permiso: [
    R_FORMULARIO_SOLICITUD,
    R_MEMORIA,
    R_PLANOS_ARQ,
    R_DECLARACION_ARQ,
  ],
  // Recepción: se apoya en el permiso otorgado y sus antecedentes.
  recepcion_final: [
    R_FORMULARIO_SOLICITUD,
    R_PERMISO_ANTERIOR,
    R_PLANOS_ARQ,
    R_DECLARACION_ARQ,
  ],
  recepcion_parcial: [
    R_FORMULARIO_SOLICITUD,
    R_PERMISO_ANTERIOR,
    R_PLANOS_ARQ,
  ],
}

// ── Evaluación ───────────────────────────────────────────────────────────────

export interface DocEntrada {
  tipo?: string
  nombre: string
}

export interface ItemCompletitud {
  requisito: RequisitoDoc
  presente: boolean
}

export interface ResumenCompletitud {
  /** Requisitos obligatorios presentes. */
  presentes: number
  /** Total de requisitos obligatorios (denominador del gate). */
  total: number
  /** Obligatorios ausentes (= total - presentes). */
  faltantes: number
}

export interface ResultadoCompletitud {
  items: ItemCompletitud[]
  resumen: ResumenCompletitud
}

/** Devuelve la checklist aplicable a un tipo de trámite. */
export function checklistDe(tipo: string | undefined): RequisitoDoc[] {
  if (!tipo) return CHECKLIST_GENERICA
  return DOCS_REQUERIDOS_POR_TIPO[tipo] ?? CHECKLIST_GENERICA
}

/**
 * Evalúa la completitud del expediente de forma determinista: para cada
 * requisito, marca `presente` si algún documento subido lo satisface. El
 * resumen contabiliza solo los obligatorios (los opcionales se muestran pero
 * no bloquean el gate).
 */
export function evaluarCompletitud(
  tipo: string | undefined,
  docs: DocEntrada[],
): ResultadoCompletitud {
  const requisitos = checklistDe(tipo)
  const items: ItemCompletitud[] = requisitos.map((requisito) => ({
    requisito,
    presente: docs.some((d) => requisito.detecta(d.tipo ?? "", d.nombre)),
  }))

  const obligatorios = items.filter((i) => i.requisito.obligatorio)
  const presentes = obligatorios.filter((i) => i.presente).length
  const total = obligatorios.length

  return {
    items,
    resumen: { presentes, total, faltantes: total - presentes },
  }
}
