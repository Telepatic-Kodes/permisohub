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
  /** Cita de la fuente oficial (formulario/artículo) cuando el ítem viene
   *  transcrito de un formulario Minvu real, no de la lista curada genérica.
   *  Ver CHECKLIST_OBRA_MENOR_AMPLIACION, CHECKLIST_PERMISO_EDIFICACION,
   *  CHECKLIST_ANTEPROYECTO y CHECKLIST_RECEPCION_FINAL. */
  fuente?: string
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

const R_PLANOS_ARQ: RequisitoDoc = {
  clave: "planos_arquitectura",
  label: "Planos de arquitectura",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Plano de arquitectura" ||
    /\bplano|planta|elevaci|corte|l[aá]mina|arquitect/.test(norm(nombre)),
}

// ── Requisitos de formularios Minvu reales (transcripción literal) ──────────
// A diferencia del resto del archivo, estos ítems SÍ citan la fuente oficial
// exacta (`fuente`) porque no son una aproximación curada: son la lista real
// que exige cada formulario, descargado de minvu.gob.cl/elementos-tecnicos/
// formularios/. Cuatro formularios cubiertos en esta sesión (31 jul 2026):
//   · Formulario 1-1.1 (S.OM-Am 5.1.4 1A) — Solicitud Permiso Obra Menor,
//     Ampliación hasta 100m² → usado por `obra_menor_con_permiso`.
//   · Formulario 2-3.1/2-3.2 (S.P.ON/S.P.AM, Art. 5.1.6 OGUC) — Solicitud
//     Permiso de Edificación, Obra Nueva / Ampliación mayor a 100m² (sección
//     9 IDÉNTICA entre ambos) → usado por `permiso_edificacion` y `ampliacion`.
//   · Formulario 2-1.1 (S.A.A.ON, Art. 5.1.5 OGUC) — Solicitud Aprobación de
//     Anteproyecto, Obra Nueva → usado por `anteproyecto`.
//   · Formulario 2-7.1 (S.R.D.ON) — Solicitud Recepción Definitiva de Obras
//     de Edificación, Obra Nueva → usado por `recepcion_final`.
// OJO: el primer intento de esta sesión asignó por error la checklist del
// Formulario 1-1.1 (obra MENOR) a `permiso_edificacion` — se corrigió tras
// descargar el listado oficial de minvu.gob.cl y verificar el código impreso
// en el propio formulario ("S.OM-Am 5.1.4") contra el pantallazo de Estefanía.

const R_LISTADO_DOCUMENTOS: RequisitoDoc = {
  clave: "listado_documentos_planos",
  label: "Listado de documentos y planos numerados",
  obligatorio: true,
  detecta: (_tipo, nombre) => /listado.*(documento|plano)/.test(norm(nombre)),
  fuente: "Formulario 1-1.1 Minvu, sección 9",
}

const R_PATENTES_PROFESIONALES: RequisitoDoc = {
  clave: "patentes_profesionales",
  label: "Patentes de los profesionales responsables",
  obligatorio: true,
  detecta: (_tipo, nombre) => /patente.*(profesional|responsab)/.test(norm(nombre)),
  fuente: "Art. 1.2.1 OGUC",
}

const R_DECLARACION_SIMPLE_ARQUITECTO: RequisitoDoc = {
  clave: "declaracion_simple_arquitecto",
  label: "Declaración simple del arquitecto",
  obligatorio: true,
  detecta: (_tipo, nombre) => /declaraci[oó]n simple.*arquitect/.test(norm(nombre)),
  fuente: "N°4 letra A numeral 1, Art. 5.1.4 OGUC",
}

const R_CROQUIS_UBICACION: RequisitoDoc = {
  clave: "croquis_ubicacion",
  label: "Croquis de ubicación o de emplazamiento, a escala",
  obligatorio: true,
  detecta: (_tipo, nombre) => /croquis.*(ubicaci[oó]n|emplazamiento)/.test(norm(nombre)),
  fuente: "N°5 letra A numeral 1, Art. 5.1.4 OGUC",
}

const R_PLANOS_1_50: RequisitoDoc = {
  clave: "planos_escala_1_50",
  label: "Planos a escala 1:50 (planta general, elevaciones y cuadro de superficies)",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Plano de arquitectura" || /\bplano|planta|elevaci|l[aá]mina|arquitect/.test(norm(nombre)),
  fuente: "N°6 letra A numeral 1, Art. 5.1.4 OGUC",
}

const R_CERT_INSCRIPCION_REVISORES: RequisitoDoc = {
  clave: "certificado_inscripcion_revisores",
  label: "Certificado de inscripción vigente de revisores independientes / de cálculo estructural / ITO",
  obligatorio: false,
  detecta: (_tipo, nombre) => /inscripci[oó]n.*(revisor|revisora|\bito\b)/.test(norm(nombre)),
  fuente: "Formulario 1-1.1 Minvu, sección 9 — cuando corresponda",
}

const R_INFORME_REVISOR_INDEPENDIENTE: RequisitoDoc = {
  clave: "informe_revisor_independiente",
  label: "Informe favorable del revisor independiente",
  obligatorio: false,
  detecta: (_tipo, nombre) => /informe.*revisor.*independiente/.test(norm(nombre)),
  fuente: "Formulario 1-1.1 Minvu, sección 9 — cuando corresponda",
}

const R_INFORME_REVISOR_CALCULO: RequisitoDoc = {
  clave: "informe_revisor_calculo",
  label: "Informe favorable del revisor de cálculo estructural",
  obligatorio: false,
  detecta: (_tipo, nombre) => /informe.*revisor.*c[aá]lculo/.test(norm(nombre)),
  fuente: "Formulario 1-1.1 Minvu, sección 9 — cuando corresponda",
}

const R_CERT_IMIV_SEIM: RequisitoDoc = {
  clave: "certificado_imiv_seim",
  label: "Certificado de ingreso del IMIV en el SEIM",
  obligatorio: false,
  detecta: (_tipo, nombre) => /\bimiv\b|\bseim\b/.test(norm(nombre)),
  fuente: "Art. 1° transitorio Ley N°20.958 — exigible según plazos",
}

const R_CERT_AVALUO_FISCAL: RequisitoDoc = {
  clave: "certificado_avaluo_fiscal",
  label: "Certificado de avalúo fiscal vigente y detallado del predio",
  obligatorio: false,
  detecta: (_tipo, nombre) => /aval[uú]o fiscal/.test(norm(nombre)),
  fuente: "Art. 70 LGUC — proyectos con crecimiento urbano por densificación con aporte",
}

const R_PROYECTO_CALCULO_ESTRUCTURAL: RequisitoDoc = {
  clave: "proyecto_calculo_estructural",
  label: "Proyecto de cálculo estructural",
  obligatorio: false,
  detecta: (tipo, nombre) => tipo === "Plano estructural" || /estruct|c[aá]lculo/.test(norm(nombre)),
  fuente: "Inciso final Art. 5.1.7 OGUC — cuando corresponda",
}

const R_SOLICITUD_DEMOLICION: RequisitoDoc = {
  clave: "solicitud_demolicion",
  label: "Solicitud de demolición",
  obligatorio: false,
  detecta: (_tipo, nombre) => /demolici[oó]n/.test(norm(nombre)),
  fuente: "Art. 5.1.4 N°5 OGUC",
}

const R_EETT_RESUMIDAS: RequisitoDoc = {
  clave: "especificaciones_tecnicas_resumidas",
  label: "Especificaciones técnicas resumidas",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Especificaciones técnicas" || /especificaci|\beett\b/.test(norm(nombre)),
  fuente: "Formulario 1-1.1 Minvu, sección 9",
}

const R_PROYECTO_TELECOM: RequisitoDoc = {
  clave: "proyecto_telecomunicaciones",
  label: "Proyecto de telecomunicaciones",
  obligatorio: false,
  detecta: (_tipo, nombre) => /telecomunicaci/.test(norm(nombre)),
  fuente: "Art. 11 D.S. N°167/2016 MTT — cuando corresponda",
}

const R_ESTUDIO_CARGA_COMBUSTIBLE: RequisitoDoc = {
  clave: "estudio_carga_combustible",
  label: "Estudio de carga combustible",
  obligatorio: false,
  detecta: (_tipo, nombre) => /carga.*combustible|combustible/.test(norm(nombre)),
  fuente: "Art. 4.3.4 OGUC — cuando corresponda",
}

const R_ESTUDIO_SEGURIDAD: RequisitoDoc = {
  clave: "estudio_seguridad",
  label: "Estudio de seguridad",
  obligatorio: false,
  detecta: (_tipo, nombre) => /estudio.*seguridad/.test(norm(nombre)),
  fuente: "Arts. 4.2.13, 4.2.14, 4.2.15, 4.3.1, 4.3.2, 4.3.6 OGUC — cuando corresponda",
}

const R_ESTUDIO_EVACUACION: RequisitoDoc = {
  clave: "estudio_evacuacion",
  label: "Estudio de evacuación",
  obligatorio: false,
  detecta: (_tipo, nombre) => /evacuaci[oó]n/.test(norm(nombre)),
  fuente: "Art. 4.2.10 OGUC — cuando corresponda",
}

const R_PLANO_ACCESIBILIDAD: RequisitoDoc = {
  clave: "plano_accesibilidad",
  label: "Plano y memoria de accesibilidad",
  obligatorio: false,
  detecta: (_tipo, nombre) => /accesibilidad/.test(norm(nombre)),
  fuente: "Art. 5.1.6 N°14 OGUC — cuando corresponda",
}

const R_ESTUDIO_EISTU: RequisitoDoc = {
  clave: "estudio_eistu",
  label: "Estudio de Impacto sobre el Sistema de Transporte Urbano (EISTU)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /\beistu\b|impacto.*transporte urbano/.test(norm(nombre)),
  fuente: "Arts. 2.4.3, 4.5.4, 4.8.3, 4.13.4 OGUC — exigible según plazos Ley N°20.958",
}

const R_AUTORIZACION_MONUMENTOS: RequisitoDoc = {
  clave: "autorizacion_consejo_monumentos",
  label: "Autorización previa del Consejo de Monumentos Nacionales (Zona Típica)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /monumentos nacionales/.test(norm(nombre)),
  fuente: "Ley 17.288, Art. 30 N°1 — cuando corresponda",
}

const R_AUTORIZACION_SEREMI_MINVU: RequisitoDoc = {
  clave: "autorizacion_seremi_minvu",
  label: "Autorización SEREMI MINVU",
  obligatorio: false,
  detecta: (_tipo, nombre) => /seremi.*minvu/.test(norm(nombre)),
  fuente: "Inciso segundo Art. 60 LGUC — cuando corresponda",
}

const R_ESTUDIO_RIESGO_MITIGACION: RequisitoDoc = {
  clave: "estudio_riesgo_mitigacion",
  label: "Estudio específico de riesgo (con medidas y obras de mitigación)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /riesgo.*mitigaci[oó]n|mitigaci[oó]n.*riesgo/.test(norm(nombre)),
  fuente: "Art. 2.1.17 OGUC — cuando corresponda",
}

const R_CONSTRUCCIONES_AREA_RURAL: RequisitoDoc = {
  clave: "construcciones_area_rural",
  label: "Autorización/informes para construcciones en área rural",
  obligatorio: false,
  detecta: (_tipo, nombre) => /[aá]rea rural|minagri|\bsag\b/.test(norm(nombre)),
  fuente: "Art. 55 LGUC — loteos (MINAGRI) o construcciones (SAG y SEREMI-MINVU)",
}

// ── Requisitos del Formulario 2-3.1 / 2-3.2 (S.P.ON / S.P.AM, Art. 5.1.6 OGUC)
// Solicitud de Permiso de Edificación — Obra Nueva y Ampliación mayor a 100m²
// tienen la sección "Antecedentes que se adjuntan" IDÉNTICA (verificado
// descargando ambos PDF), así que comparten checklist. Varios ítems del
// Formulario 1-1.1 de arriba se reutilizan tal cual (mismo concepto, misma
// cita Art. 5.1.6 N°14 en el caso de accesibilidad, EISTU, etc.).

const R_FOTOCOPIA_RESOLUCION_ANTEPROYECTO: RequisitoDoc = {
  clave: "fotocopia_resolucion_anteproyecto",
  label: "Fotocopia de la resolución de aprobación de anteproyecto, si corresponde",
  obligatorio: false,
  detecta: (_tipo, nombre) => /resoluci[oó]n.*anteproyecto|anteproyecto.*resoluci[oó]n/.test(norm(nombre)),
  fuente: "Formulario 2-3.x Minvu, sección 8 — si corresponde",
}

const R_CERT_INSCRIPCION_REVISOR_INDEPENDIENTE: RequisitoDoc = {
  clave: "certificado_inscripcion_revisor_independiente",
  label: "Certificado de inscripción vigente del revisor independiente",
  obligatorio: false,
  detecta: (_tipo, nombre) => /inscripci[oó]n.*revisor.*independiente/.test(norm(nombre)),
  fuente: "Formulario 2-3.x Minvu, sección 8 — cuando corresponda",
}

const R_CERT_INSCRIPCION_REVISOR_CALCULO: RequisitoDoc = {
  clave: "certificado_inscripcion_revisor_calculo",
  label: "Certificado de inscripción vigente del revisor de cálculo estructural",
  obligatorio: false,
  detecta: (_tipo, nombre) => /inscripci[oó]n.*revisor.*c[aá]lculo/.test(norm(nombre)),
  fuente: "Formulario 2-3.x Minvu, sección 8 — cuando corresponda",
}

const R_CERT_INSCRIPCION_ITO: RequisitoDoc = {
  clave: "certificado_inscripcion_ito",
  label: "Certificado de inscripción vigente del ITO",
  obligatorio: false,
  detecta: (_tipo, nombre) => /inscripci[oó]n.*\bito\b/.test(norm(nombre)),
  fuente: "Formulario 2-3.x Minvu, sección 8 — cuando corresponda",
}

const R_CERT_INGRESO_INE: RequisitoDoc = {
  clave: "certificado_ingreso_ine_estadisticas",
  label: "Certificado de ingreso en línea del Formulario Único de Estadísticas de Edificación (INE)",
  obligatorio: true,
  detecta: (_tipo, nombre) => /\bine\b.*estad[ií]stic|estad[ií]stic.*edificaci[oó]n/.test(norm(nombre)),
  fuente: "N°3 Art. 5.1.6 OGUC",
}

const R_CERT_FACTIBILIDAD_SANITARIA: RequisitoDoc = {
  clave: "certificado_factibilidad_sanitaria",
  label: "Certificado de factibilidad de agua potable y alcantarillado (o proyecto propio en áreas no concesionadas)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /factibilidad.*(agua|alcantarill|sanitari)/.test(norm(nombre)),
  fuente: "N°6 Art. 5.1.6 OGUC — cuando corresponda",
}

const R_MEMORIA_ACCESIBILIDAD: RequisitoDoc = {
  clave: "memoria_accesibilidad",
  label: "Memoria de accesibilidad",
  obligatorio: false,
  detecta: (_tipo, nombre) => /memoria.*accesibilidad/.test(norm(nombre)),
  fuente: "N°14 Art. 5.1.6 OGUC — cuando corresponda",
}

const R_PLANOS_ARQUITECTURA_COMPLETOS: RequisitoDoc = {
  clave: "planos_arquitectura_completos",
  label: "Planos de arquitectura (ubicación, emplazamiento, plantas, cortes y elevaciones, cubiertas)",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Plano de arquitectura" ||
    /\bplano|planta|elevaci|corte|l[aá]mina|arquitect|emplazamiento|cubiert/.test(norm(nombre)),
  fuente: "N°7 Art. 5.1.6 OGUC",
}

const R_PLANO_CIERRE: RequisitoDoc = {
  clave: "plano_cierre",
  label: "Plano de cierre, cuando el proyecto lo consulte",
  obligatorio: false,
  detecta: (_tipo, nombre) => /plano.*cierre/.test(norm(nombre)),
  fuente: "Letra f) N°7 Art. 5.1.6 OGUC — cuando corresponda",
}

const R_PLANO_SOMBRAS: RequisitoDoc = {
  clave: "plano_comparativo_sombras",
  label: "Plano comparativo de sombras",
  obligatorio: false,
  detecta: (_tipo, nombre) => /sombras/.test(norm(nombre)),
  fuente: "N°9 Art. 5.1.6 OGUC — cuando corresponda",
}

const R_LEVANTAMIENTO_TOPOGRAFICO: RequisitoDoc = {
  clave: "levantamiento_topografico",
  label: "Levantamiento topográfico",
  obligatorio: true,
  detecta: (_tipo, nombre) => /levantamiento.*topogr[aá]fic|topogr[aá]fic/.test(norm(nombre)),
  fuente: "N°12 Art. 5.1.6 OGUC",
}

const R_CUADRO_SUPERFICIES: RequisitoDoc = {
  clave: "cuadro_superficies",
  label: "Cuadro de superficies",
  obligatorio: true,
  detecta: (_tipo, nombre) => /cuadro.*superficie/.test(norm(nombre)),
  fuente: "N°8 Art. 5.1.6 OGUC",
}

const R_CARPETA_ASCENSORES: RequisitoDoc = {
  clave: "carpeta_ascensores",
  label: "Carpeta de ascensores e instalaciones similares (plano general, especificaciones técnicas, estudio)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /ascensor|montacargas|rampa.*mec[aá]nic/.test(norm(nombre)),
  fuente: "N°13 Art. 5.1.6 OGUC — cuando corresponda",
}

const R_MECANICA_SUELO: RequisitoDoc = {
  clave: "mecanica_suelo",
  label: "Mecánica de suelo",
  obligatorio: false,
  detecta: (_tipo, nombre) => /mec[aá]nica.*suelo/.test(norm(nombre)),
  fuente: "Art. 1.2.14 OGUC — cuando corresponda",
}

// ── Requisitos del Formulario 2-1.1 (S.A.A.ON, Art. 5.1.5 OGUC) ─────────────
// Solicitud de Aprobación de Anteproyecto de Obras de Edificación, Obra
// Nueva. Checklist mucho más corta que la del permiso — el anteproyecto es
// una aprobación previa de diseño, no el expediente completo.

const R_PATENTE_ARQUITECTO: RequisitoDoc = {
  clave: "patente_arquitecto",
  label: "Fotocopia de la patente al día del arquitecto",
  obligatorio: true,
  detecta: (_tipo, nombre) => /patente.*arquitect/.test(norm(nombre)),
  fuente: "Formulario 2-1.1 Minvu, sección 7",
}

const R_CUADRO_SUPERFICIES_GENERAL: RequisitoDoc = {
  clave: "cuadro_superficies_general",
  label: "Cuadro general de superficies (salvo que ya esté incluido en los planos)",
  obligatorio: true,
  detecta: (_tipo, nombre) => /cuadro.*superficie/.test(norm(nombre)),
  fuente: "Formulario 2-1.1 Minvu, sección 7",
}

const R_INFORME_CALIDAD_SUELO: RequisitoDoc = {
  clave: "informe_calidad_suelo",
  label: "Informe con estudio y medidas por calidad del suelo",
  obligatorio: false,
  detecta: (_tipo, nombre) => /calidad.*suelo|estudio.*suelo/.test(norm(nombre)),
  fuente: "Art. 5.1.15 OGUC — cuando corresponda",
}

const R_PLANOS_ANTEPROYECTO: RequisitoDoc = {
  clave: "planos_anteproyecto",
  label: "Planos del anteproyecto (ubicación, emplazamiento, plantas esquemáticas, siluetas de elevaciones)",
  obligatorio: true,
  detecta: (tipo, nombre) =>
    tipo === "Plano de arquitectura" ||
    /\bplano|planta|silueta|elevaci|emplazamiento|esquem[aá]tic/.test(norm(nombre)),
  fuente: "Formulario 2-1.1 Minvu, sección 7",
}

// ── Requisitos del Formulario 2-7.1 (S.R.D.ON) ──────────────────────────────
// Solicitud de Recepción Definitiva de Obras de Edificación, Obra Nueva. Es
// la checklist más larga de las cuatro: certifica que la obra construida
// coincide con lo permitido y que cada especialidad quedó operativa.

const R_INFORME_ARQUITECTO_EJECUCION: RequisitoDoc = {
  clave: "informe_arquitecto_ejecucion",
  label: "Informe del arquitecto certificando ejecución conforme al permiso aprobado",
  obligatorio: true,
  detecta: (_tipo, nombre) => /informe.*arquitect/.test(norm(nombre)),
  fuente: "Inciso segundo Art. 144 LGUC",
}

const R_DECLARACION_JURADA_CONSTRUCTOR: RequisitoDoc = {
  clave: "declaracion_jurada_constructor",
  label: "Declaración jurada simple del constructor (medidas de gestión y control de calidad)",
  obligatorio: true,
  detecta: (_tipo, nombre) => /declaraci[oó]n.*jurada.*constructor|constructor.*declaraci[oó]n/.test(norm(nombre)),
  fuente: "Inciso tercero Art. 143 LGUC",
}

const R_LIBRO_DE_OBRAS: RequisitoDoc = {
  clave: "libro_de_obras",
  label: "Libro de obras",
  obligatorio: true,
  detecta: (_tipo, nombre) => /libro.*obra/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8",
}

const R_CERT_DOTACION_AGUA: RequisitoDoc = {
  clave: "certificado_dotacion_agua_alcantarillado",
  label: "Certificado de dotación de agua potable y alcantarillado",
  obligatorio: true,
  detecta: (_tipo, nombre) => /dotaci[oó]n.*(agua|alcantarill)/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8",
}

const R_INFORME_ITO: RequisitoDoc = {
  clave: "informe_ito",
  label: "Informe del Inspector Técnico de Obras (ITO)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /informe.*\bito\b|inspector.*t[eé]cnico/.test(norm(nombre)),
  fuente: "Inciso segundo Art. 144 LGUC — si corresponde",
}

const R_PLAN_EVACUACION_BOMBEROS: RequisitoDoc = {
  clave: "plan_evacuacion_bomberos",
  label: "Copia del plan de evacuación ingresado a Bomberos",
  obligatorio: false,
  detecta: (_tipo, nombre) => /plan.*evacuaci[oó]n|bomberos/.test(norm(nombre)),
  fuente: "Inciso tercero Art. 144 LGUC",
}

const R_INFORME_TELECOM_RIT: RequisitoDoc = {
  clave: "informe_telecom_rit",
  label: "Informe favorable del proyectista de telecomunicaciones y registro de mediciones RIT",
  obligatorio: false,
  detecta: (_tipo, nombre) => /telecomunicaci|\brit\b/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8 — si corresponde",
}

const R_RESOLUCION_CALIFICACION_AMBIENTAL: RequisitoDoc = {
  clave: "resolucion_calificacion_ambiental",
  label: "Resolución de calificación ambiental favorable",
  obligatorio: false,
  detecta: (_tipo, nombre) => /calificaci[oó]n ambiental|\brca\b/.test(norm(nombre)),
  fuente: "Art. 25 bis Ley 19.300 — cuando proceda",
}

const R_DOCUMENTOS_ACTUALIZADOS_CAMBIOS: RequisitoDoc = {
  clave: "documentos_actualizados_cambios",
  label: "Documentos actualizados por cambios respecto del proyecto aprobado",
  obligatorio: false,
  detecta: (_tipo, nombre) => /actualizad/.test(norm(nombre)),
  fuente: "Inciso cuarto Art. 5.2.6 OGUC — cuando corresponda",
}

const R_COMPROBANTE_DERECHOS_CONVENIO: RequisitoDoc = {
  clave: "comprobante_derechos_convenio_pago",
  label: "Comprobante de derechos municipales (convenio de pago)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /convenio.*pago|comprobante.*derech/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8 — en caso de convenio de pago",
}

const R_DOC_INSTALACIONES_ELECTRICAS_GAS: RequisitoDoc = {
  clave: "documentos_instalaciones_electricas_gas",
  label: "Documentos de instalaciones eléctricas interiores e instalaciones interiores de gas",
  obligatorio: false,
  detecta: (_tipo, nombre) => /instalaci[oó]n.*(el[eé]ctric|gas)/.test(norm(nombre)),
  fuente: "Arts. 5.9.2 y 5.9.3 OGUC — cuando proceda",
}

const R_DOC_ASCENSORES_RECEPCION: RequisitoDoc = {
  clave: "documentacion_ascensores_recepcion",
  label: "Documentación de la instalación de ascensores, montacargas o escaleras/rampas mecánicas",
  obligatorio: false,
  detecta: (_tipo, nombre) => /ascensor|montacargas|rampa.*mec[aá]nic/.test(norm(nombre)),
  fuente: "N°2 Art. 5.9.5 OGUC — cuando proceda",
}

const R_DECLARACION_INSTALACIONES_CALEFACCION: RequisitoDoc = {
  clave: "declaracion_instalaciones_calefaccion",
  label: "Declaración de instalaciones eléctricas de calefacción, agua caliente central y aire acondicionado",
  obligatorio: false,
  detecta: (_tipo, nombre) => /calefacci[oó]n|aire acondicionado/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8 — cuando proceda",
}

const R_CERT_ENSAYE_HORMIGONES: RequisitoDoc = {
  clave: "certificado_ensaye_hormigones",
  label: "Certificado de ensaye de hormigones y otros materiales",
  obligatorio: false,
  detecta: (_tipo, nombre) => /ensaye.*hormig[oó]n|hormig[oó]n/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8 — según proceda",
}

const R_CERT_REPOSICION_PAVIMENTOS: RequisitoDoc = {
  clave: "certificado_reposicion_pavimentos",
  label: "Certificado de reposición de pavimentos y obras de ornato",
  obligatorio: false,
  detecta: (_tipo, nombre) => /reposici[oó]n.*pavimento|pavimento/.test(norm(nombre)),
  fuente: "Circulares DDU 326 y 384 — cuando corresponda",
}

const R_CERT_RPI: RequisitoDoc = {
  clave: "certificado_rpi",
  label: "Certificado de registro en el Registro de Proyectos Inmobiliarios (RPI)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /\brpi\b|registro.*proyectos inmobiliarios/.test(norm(nombre)),
  fuente: "D.S. N°167/2016 (Ley 20.808) — cuando corresponda",
}

const R_DOC_GARANTIA_EISTU_IMIV: RequisitoDoc = {
  clave: "documentacion_garantia_eistu_imiv",
  label: "Documentación/garantía de las medidas del EISTU, IMIV o IVB",
  obligatorio: false,
  detecta: (_tipo, nombre) => /\bivb\b|garant[ií]a.*(eistu|imiv)/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8 — según corresponda",
}

const R_PLANOS_TELECOM_EVACUACION: RequisitoDoc = {
  clave: "planos_telecom_evacuacion",
  label: "Planos de telecomunicaciones y de evacuación",
  obligatorio: false,
  detecta: (_tipo, nombre) => /plano.*(telecomunicaci|evacuaci[oó]n)/.test(norm(nombre)),
  fuente: "Formulario 2-7.1 Minvu, sección 8",
}

// ── Requisitos del Formulario 1.1.2.1.1 (Art. 1.6.3/5.1.4 N°1A OGUC) ───────
// Declaración Jurada de Inicio de Obras: Obra Menor, Ampliación hasta 100m².
// Vía sin permiso (Art. 5.1.4 inciso final N°1 OGUC). Reutiliza casi todos los
// ítems del Formulario 1-1.1 de arriba — es la misma obra, sin permiso previo.

const R_CERT_IMIV_O_NO_REQUIERE: RequisitoDoc = {
  clave: "certificado_imiv_o_no_requiere",
  label: "Certificado de ingreso del IMIV en el SEIM, o certificado que acredite que el proyecto no requiere IMIV",
  obligatorio: true,
  detecta: (_tipo, nombre) => /\bimiv\b|\bseim\b/.test(norm(nombre)),
  fuente: "Formulario 1.1.2.1.1 Minvu, sección 10",
}

const R_PRESUPUESTO_OBRAS_ALTERACION: RequisitoDoc = {
  clave: "presupuesto_obras_alteracion",
  label: "Presupuesto informativo de las obras de alteración, cuando se presenta en conjunto",
  obligatorio: false,
  detecta: (_tipo, nombre) => /presupuesto.*(obra|alteraci[oó]n)/.test(norm(nombre)),
  fuente: "Formulario 1.1.2.1.1 Minvu — en caso de alteración conjunta",
}

const R_PLANO_EMPLAZAMIENTO_DEMOLER: RequisitoDoc = {
  clave: "plano_emplazamiento_demoler",
  label: "Plano de emplazamiento graficando la parte a demoler y cuadro de superficies de lo que se conserva",
  obligatorio: false,
  detecta: (_tipo, nombre) => /emplazamiento.*demol|demol.*emplazamiento/.test(norm(nombre)),
  fuente: "Formulario 1.1.2.1.1 Minvu — en caso de demolición conjunta",
}

const R_INFORME_PAREO: RequisitoDoc = {
  clave: "informe_pareo",
  label: "Informe del profesional competente, en caso de pareo",
  obligatorio: false,
  detecta: (_tipo, nombre) => /pareo/.test(norm(nombre)),
  fuente: "Formulario 1.1.2.1.1 Minvu — en caso de demolición conjunta",
}

const R_PRESUPUESTO_DEMOLICION: RequisitoDoc = {
  clave: "presupuesto_demolicion",
  label: "Presupuesto de la demolición",
  obligatorio: false,
  detecta: (_tipo, nombre) => /presupuesto.*demolici[oó]n/.test(norm(nombre)),
  fuente: "Formulario 1.1.2.1.1 Minvu — en caso de demolición conjunta",
}

// ── Requisitos del Formulario 3.1.1.1 (Art. 3.1.5 OGUC) / 4.1.1 (Art. 3.1.2
// OGUC) ──────────────────────────────────────────────────────────────────
// Solicitud de Permiso de Loteo y Solicitud de Aprobación de Subdivisión.
// Comparten varios ítems (misma redacción en ambos PDF).

const R_SOLICITUD_FIRMADA: RequisitoDoc = {
  clave: "solicitud_firmada_profesionales",
  label: "Solicitud firmada por el propietario y los profesionales que participan",
  obligatorio: true,
  detecta: (_tipo, nombre) => /solicitud.*firmad|firmad.*solicitud/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 / 4.1.1 Minvu",
}

const R_CERT_AVALUO_NOTARIAL: RequisitoDoc = {
  clave: "certificado_avaluo_notarial",
  label: "Original o copia autorizada por notario del certificado de avalúo fiscal vigente",
  obligatorio: true,
  detecta: (_tipo, nombre) => /aval[uú]o fiscal/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 / 4.1.1 Minvu",
}

const R_LEVANTAMIENTO_TOPOGRAFICO_COND: RequisitoDoc = {
  clave: "levantamiento_topografico_condicional",
  label: "Levantamiento topográfico, cuando se haya presentado conforme a la declaración del propietario",
  obligatorio: false,
  detecta: (_tipo, nombre) => /levantamiento.*topogr[aá]fic|topogr[aá]fic/.test(norm(nombre)),
  fuente: "Art. 1.4.8 OGUC — cuando corresponda",
}

const R_PLANO_SITUACION_ACTUAL_DESLINDES: RequisitoDoc = {
  clave: "plano_situacion_actual_deslindes",
  label: "Plano de situación actual del predio con roles y medidas de deslindes",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Plano de arquitectura" || /deslinde|situaci[oó]n actual/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PLANO_SITUACION_ACTUAL_PROYECTO: RequisitoDoc = {
  clave: "plano_situacion_actual_proyecto",
  label: "Plano situación actual (proyecto) a escala no menor a 1:1.000",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Plano de arquitectura" || /\bplano\b/.test(norm(nombre)),
  fuente: "N°5 Art. 3.1.4 OGUC",
}

const R_MEMORIA_EXPLICATIVA_LOTEO: RequisitoDoc = {
  clave: "memoria_explicativa_loteo",
  label: "Memoria explicativa del loteo",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Memoria" || /memoria/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_EETT_URBANIZACION: RequisitoDoc = {
  clave: "especificaciones_tecnicas_urbanizacion",
  label: "Especificaciones técnicas de los proyectos de urbanización",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Especificaciones técnicas" || /especificaci|\beett\b/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_MEDIDAS_PREVENCION_RIESGO: RequisitoDoc = {
  clave: "medidas_prevencion_riesgo",
  label: "Medidas de prevención de riesgos provenientes de áreas colindantes o del mismo terreno",
  obligatorio: false,
  detecta: (_tipo, nombre) => /prevenci[oó]n.*riesgo/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu — cuando el DOM lo exija en el CIP",
}

const R_AUTORIZACION_CESION_VOLUNTARIA: RequisitoDoc = {
  clave: "autorizacion_cesion_urbanizacion_voluntaria",
  label: "Autorización municipal para la cesión y urbanización voluntaria que excede lo obligatorio",
  obligatorio: false,
  detecta: (_tipo, nombre) => /cesi[oó]n.*voluntaria|urbanizaci[oó]n.*voluntaria/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu — cuando corresponda",
}

const R_RESOLUCION_IMIV: RequisitoDoc = {
  clave: "resolucion_imiv_o_silencio_positivo",
  label: "Resolución que aprueba el IMIV, o certificación del silencio positivo (Art. 64 Ley 19.880)",
  obligatorio: false,
  detecta: (_tipo, nombre) => /\bimiv\b|silencio positivo/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu — según corresponda",
}

const R_PROYECTO_PAVIMENTACION: RequisitoDoc = {
  clave: "proyecto_pavimentacion",
  label: "Proyecto de pavimentación",
  obligatorio: false,
  detecta: (_tipo, nombre) => /pavimentaci[oó]n/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PLANOS_AGUA_POTABLE: RequisitoDoc = {
  clave: "planos_red_agua_potable",
  label: "Planos de red de agua potable",
  obligatorio: false,
  detecta: (_tipo, nombre) => /red.*agua potable|agua potable/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PLANOS_ALCANTARILLADO: RequisitoDoc = {
  clave: "planos_alcantarillado_aguas_servidas",
  label: "Planos de alcantarillado de aguas servidas",
  obligatorio: false,
  detecta: (_tipo, nombre) => /alcantarill/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PROYECTO_AGUAS_LLUVIA: RequisitoDoc = {
  clave: "proyecto_evacuacion_aguas_lluvia",
  label: "Proyecto de evacuación de aguas lluvia",
  obligatorio: false,
  detecta: (_tipo, nombre) => /aguas lluvia/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PROYECTO_AGUAS_GRISES: RequisitoDoc = {
  clave: "proyecto_reutilizacion_aguas_grises",
  label: "Proyecto de sistema de reutilización de aguas grises",
  obligatorio: false,
  detecta: (_tipo, nombre) => /aguas grises/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PROYECTO_RED_ELECTRICA: RequisitoDoc = {
  clave: "proyecto_red_electrica_alumbrado",
  label: "Proyecto de red eléctrica y/o alumbrado público",
  obligatorio: false,
  detecta: (_tipo, nombre) => /red el[eé]ctrica|alumbrado p[uú]blico/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PROYECTO_RED_GAS: RequisitoDoc = {
  clave: "proyecto_red_gas",
  label: "Proyecto de red de gas",
  obligatorio: false,
  detecta: (_tipo, nombre) => /red.*gas/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11 — cuando corresponda",
}

const R_PROYECTO_PLANTACIONES_ORNATO: RequisitoDoc = {
  clave: "proyecto_plantaciones_ornato",
  label: "Proyecto de plantaciones y obras de ornato",
  obligatorio: false,
  detecta: (_tipo, nombre) => /plantaci|ornato/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11",
}

const R_PROYECTO_DEFENSA_TERRENO: RequisitoDoc = {
  clave: "proyecto_defensa_terreno",
  label: "Proyecto de defensa del terreno",
  obligatorio: false,
  detecta: (_tipo, nombre) => /defensa.*terreno/.test(norm(nombre)),
  fuente: "Formulario 3.1.1.1 Minvu, sección 11 — cuando corresponda",
}

// ── Requisitos exclusivos del Formulario 4.1.1 (Art. 3.1.2 OGUC) ───────────
// Solicitud de Aprobación de Subdivisión — más simple que el loteo, sin obras
// de urbanización.

const R_PLANO_SUBDIVISION: RequisitoDoc = {
  clave: "plano_subdivision",
  label: "Plano de subdivisión (curvas de nivel, deslindes, lotes resultantes, cuadro de superficies)",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Plano de arquitectura" || /subdivisi[oó]n/.test(norm(nombre)),
  fuente: "Formulario 4.1.1 Minvu, sección 9.1",
}

const R_PLANO_UBICACION_TERRENO: RequisitoDoc = {
  clave: "plano_ubicacion_terreno",
  label: "Plano de ubicación del terreno a escala no inferior a 1:5.000",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Plano de arquitectura" || /ubicaci[oó]n.*terreno/.test(norm(nombre)),
  fuente: "Formulario 4.1.1 Minvu, sección 9.1",
}

const R_PLANO_SUBDIVISION_EXISTENTE_PROPUESTA: RequisitoDoc = {
  clave: "plano_subdivision_existente_propuesta",
  label: "Plano que grafica la subdivisión predial existente y la propuesta",
  obligatorio: true,
  detecta: (tipo, nombre) => tipo === "Plano de arquitectura" || /subdivisi[oó]n/.test(norm(nombre)),
  fuente: "Formulario 4.1.1 Minvu, sección 9.1",
}

const R_GRAFICO_CUMPLIMIENTO_EDIFICACIONES: RequisitoDoc = {
  clave: "grafico_cumplimiento_edificaciones_existentes",
  label: "Gráfico de cumplimiento normativo de las edificaciones existentes respecto de los nuevos predios",
  obligatorio: false,
  detecta: (_tipo, nombre) => /cumplimiento.*edificaci[oó]n/.test(norm(nombre)),
  fuente: "Formulario 4.1.1 Minvu, sección 9.1 — cuando corresponda",
}

// ── Checklists por tipo de trámite ───────────────────────────────────────────
// Curadas de forma conservadora. Para trámites sin entrada específica se usa
// la checklist genérica (base de un ingreso documental ante la DOM).

// Checklist REAL del Formulario 1-1.1 (S.OM-Am 5.1.4 1A) — Solicitud de
// Permiso de Obra Menor, Ampliación hasta 100m². Usada por
// `obra_menor_con_permiso` (Art. 5.1.4 OGUC).
const CHECKLIST_OBRA_MENOR_AMPLIACION: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_LISTADO_DOCUMENTOS,
  R_PATENTES_PROFESIONALES,
  R_CIP,
  R_DECLARACION_SIMPLE_ARQUITECTO,
  R_CROQUIS_UBICACION,
  R_PLANOS_1_50,
  R_EETT_RESUMIDAS,
  R_CERT_INSCRIPCION_REVISORES,
  R_INFORME_REVISOR_INDEPENDIENTE,
  R_INFORME_REVISOR_CALCULO,
  R_CERT_IMIV_SEIM,
  R_CERT_AVALUO_FISCAL,
  R_PROYECTO_CALCULO_ESTRUCTURAL,
  R_SOLICITUD_DEMOLICION,
  R_PROYECTO_TELECOM,
  R_ESTUDIO_CARGA_COMBUSTIBLE,
  R_ESTUDIO_SEGURIDAD,
  R_ESTUDIO_EVACUACION,
  R_PLANO_ACCESIBILIDAD,
  R_ESTUDIO_EISTU,
  R_AUTORIZACION_MONUMENTOS,
  R_AUTORIZACION_SEREMI_MINVU,
  R_ESTUDIO_RIESGO_MITIGACION,
  R_CONSTRUCCIONES_AREA_RURAL,
]

// Checklist REAL del Formulario 2-3.1 / 2-3.2 (S.P.ON / S.P.AM, Art. 5.1.6
// OGUC) — Solicitud de Permiso de Edificación, Obra Nueva / Ampliación mayor
// a 100m² (secciones idénticas). Usada por `permiso_edificacion` y `ampliacion`.
const CHECKLIST_PERMISO_EDIFICACION: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_LISTADO_DOCUMENTOS,
  R_PATENTES_PROFESIONALES,
  R_CIP,
  R_CERT_INGRESO_INE,
  R_PLANOS_ARQUITECTURA_COMPLETOS,
  R_LEVANTAMIENTO_TOPOGRAFICO,
  R_CUADRO_SUPERFICIES,
  R_FOTOCOPIA_RESOLUCION_ANTEPROYECTO,
  R_CERT_INSCRIPCION_REVISOR_INDEPENDIENTE,
  R_CERT_INSCRIPCION_REVISOR_CALCULO,
  R_CERT_INSCRIPCION_ITO,
  R_INFORME_REVISOR_INDEPENDIENTE,
  R_INFORME_REVISOR_CALCULO,
  R_CERT_FACTIBILIDAD_SANITARIA,
  R_CERT_IMIV_SEIM,
  R_CERT_AVALUO_FISCAL,
  R_MEMORIA_ACCESIBILIDAD,
  R_PLANO_ACCESIBILIDAD,
  R_PROYECTO_TELECOM,
  R_PROYECTO_CALCULO_ESTRUCTURAL,
  R_CARPETA_ASCENSORES,
  R_PLANO_CIERRE,
  R_PLANO_SOMBRAS,
  R_MECANICA_SUELO,
  R_ESTUDIO_CARGA_COMBUSTIBLE,
  R_ESTUDIO_SEGURIDAD,
  R_ESTUDIO_EVACUACION,
  R_ESTUDIO_EISTU,
  R_AUTORIZACION_MONUMENTOS,
  R_AUTORIZACION_SEREMI_MINVU,
  R_ESTUDIO_RIESGO_MITIGACION,
  R_CONSTRUCCIONES_AREA_RURAL,
]

// Checklist REAL del Formulario 2-1.1 (S.A.A.ON, Art. 5.1.5 OGUC) —
// Solicitud de Aprobación de Anteproyecto, Obra Nueva. Usada por `anteproyecto`.
const CHECKLIST_ANTEPROYECTO: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_LISTADO_DOCUMENTOS,
  R_CIP,
  R_PATENTE_ARQUITECTO,
  R_CUADRO_SUPERFICIES_GENERAL,
  R_PLANOS_ANTEPROYECTO,
  R_INFORME_CALIDAD_SUELO,
  R_PLANO_SOMBRAS,
]

// Checklist REAL del Formulario 2-7.1 (S.R.D.ON) — Solicitud de Recepción
// Definitiva de Obras de Edificación, Obra Nueva. Usada por `recepcion_final`.
const CHECKLIST_RECEPCION_FINAL: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_INFORME_ARQUITECTO_EJECUCION,
  R_DECLARACION_JURADA_CONSTRUCTOR,
  R_LIBRO_DE_OBRAS,
  R_CERT_DOTACION_AGUA,
  R_INFORME_REVISOR_INDEPENDIENTE,
  R_INFORME_ITO,
  R_CERT_INSCRIPCION_REVISOR_INDEPENDIENTE,
  R_CERT_INSCRIPCION_ITO,
  R_CERT_INSCRIPCION_REVISOR_CALCULO,
  R_PLAN_EVACUACION_BOMBEROS,
  R_INFORME_TELECOM_RIT,
  R_RESOLUCION_CALIFICACION_AMBIENTAL,
  R_DOCUMENTOS_ACTUALIZADOS_CAMBIOS,
  R_COMPROBANTE_DERECHOS_CONVENIO,
  R_DOC_INSTALACIONES_ELECTRICAS_GAS,
  R_DOC_ASCENSORES_RECEPCION,
  R_DECLARACION_INSTALACIONES_CALEFACCION,
  R_CERT_ENSAYE_HORMIGONES,
  R_CERT_REPOSICION_PAVIMENTOS,
  R_CERT_RPI,
  R_DOC_GARANTIA_EISTU_IMIV,
  R_PLANOS_TELECOM_EVACUACION,
]

// Checklist REAL del Formulario 1.1.2.1.1 (Art. 1.6.3/5.1.4 N°1A OGUC) —
// Declaración Jurada de Inicio de Obras: Obra Menor, Ampliación hasta 100m².
// Usada por `obra_menor_sin_permiso`.
const CHECKLIST_OBRA_MENOR_SIN_PERMISO: RequisitoDoc[] = [
  R_LISTADO_DOCUMENTOS,
  R_PATENTES_PROFESIONALES,
  R_CIP,
  R_DECLARACION_SIMPLE_ARQUITECTO,
  R_CROQUIS_UBICACION,
  R_PLANOS_1_50,
  R_EETT_RESUMIDAS,
  R_CERT_IMIV_O_NO_REQUIERE,
  R_CERT_INSCRIPCION_REVISORES,
  R_INFORME_REVISOR_INDEPENDIENTE,
  R_INFORME_REVISOR_CALCULO,
  R_CERT_AVALUO_FISCAL,
  R_PROYECTO_CALCULO_ESTRUCTURAL,
  R_PROYECTO_TELECOM,
  R_ESTUDIO_CARGA_COMBUSTIBLE,
  R_ESTUDIO_SEGURIDAD,
  R_ESTUDIO_EVACUACION,
  R_PLANO_ACCESIBILIDAD,
  R_CONSTRUCCIONES_AREA_RURAL,
  R_PRESUPUESTO_OBRAS_ALTERACION,
  R_PLANO_EMPLAZAMIENTO_DEMOLER,
  R_INFORME_PAREO,
  R_PRESUPUESTO_DEMOLICION,
]

// Checklist REAL del Formulario 3.1.1.1 (Art. 3.1.5 OGUC) — Solicitud de
// Permiso de Loteo y de sus Obras de Urbanización. Usada por `loteo`.
const CHECKLIST_LOTEO: RequisitoDoc[] = [
  R_SOLICITUD_FIRMADA,
  R_CERT_AVALUO_NOTARIAL,
  R_CIP,
  R_PLANO_SITUACION_ACTUAL_DESLINDES,
  R_PLANO_SITUACION_ACTUAL_PROYECTO,
  R_MEMORIA_EXPLICATIVA_LOTEO,
  R_EETT_URBANIZACION,
  R_PATENTES_PROFESIONALES,
  R_MEDIDAS_PREVENCION_RIESGO,
  R_PLANO_ACCESIBILIDAD,
  R_CERT_FACTIBILIDAD_SANITARIA,
  R_INFORME_REVISOR_INDEPENDIENTE,
  R_CERT_INSCRIPCION_REVISOR_INDEPENDIENTE,
  R_CERT_INSCRIPCION_ITO,
  R_CONSTRUCCIONES_AREA_RURAL,
  R_AUTORIZACION_MONUMENTOS,
  R_AUTORIZACION_SEREMI_MINVU,
  R_ESTUDIO_RIESGO_MITIGACION,
  R_LEVANTAMIENTO_TOPOGRAFICO_COND,
  R_AUTORIZACION_CESION_VOLUNTARIA,
  R_RESOLUCION_IMIV,
  R_PROYECTO_PAVIMENTACION,
  R_PLANOS_AGUA_POTABLE,
  R_PLANOS_ALCANTARILLADO,
  R_PROYECTO_AGUAS_LLUVIA,
  R_PROYECTO_AGUAS_GRISES,
  R_PROYECTO_RED_ELECTRICA,
  R_PROYECTO_RED_GAS,
  R_PROYECTO_TELECOM,
  R_PROYECTO_PLANTACIONES_ORNATO,
  R_PROYECTO_DEFENSA_TERRENO,
]

// Checklist REAL del Formulario 4.1.1 (Art. 3.1.2 OGUC) — Solicitud de
// Aprobación de Subdivisión. Usada por `subdivision`.
const CHECKLIST_SUBDIVISION: RequisitoDoc[] = [
  R_SOLICITUD_FIRMADA,
  R_CERT_AVALUO_NOTARIAL,
  R_CIP,
  R_PATENTE_ARQUITECTO,
  R_PLANO_SUBDIVISION,
  R_PLANO_UBICACION_TERRENO,
  R_PLANO_SUBDIVISION_EXISTENTE_PROPUESTA,
  R_CONSTRUCCIONES_AREA_RURAL,
  R_LEVANTAMIENTO_TOPOGRAFICO_COND,
  R_GRAFICO_CUMPLIMIENTO_EDIFICACIONES,
]

// Base genérica: lo mínimo transversal a casi cualquier ingreso a la DOM. Es
// el único fallback no atado a un formulario específico — se usa para tipos
// sin trámite DOM propio (patente comercial, revisión normativa, etc.) o
// desconocidos. A diferencia de las checklists de arriba, esta SÍ es
// deliberadamente aproximada y está documentada como tal desde el inicio del
// archivo.
export const CHECKLIST_GENERICA: RequisitoDoc[] = [
  R_FORMULARIO_SOLICITUD,
  R_CIP,
  R_MEMORIA,
  R_PLANOS_ARQ,
]

/**
 * Checklist por tipo de trámite. Las claves usan los `TipoPermiso` de
 * types/index.ts. Cada entrada es la transcripción real de un formulario
 * Minvu (ver comentarios de cada CHECKLIST_* arriba) — no hay aproximaciones
 * curadas en este mapa. `cambio_destino` no tiene entrada propia porque no
 * existe un formulario Minvu para el cambio de destino puro (se ampara en el
 * Art. 116 LGUC y circulares DDU, no en un permiso de edificación/obra
 * menor distinto — ver lib/mapa-formularios.ts). Los tipos sin entrada
 * degradan a `CHECKLIST_GENERICA`.
 */
export const DOCS_REQUERIDOS_POR_TIPO: Record<string, RequisitoDoc[]> = {
  permiso_edificacion: CHECKLIST_PERMISO_EDIFICACION,
  ampliacion: CHECKLIST_PERMISO_EDIFICACION,
  anteproyecto: CHECKLIST_ANTEPROYECTO,
  obra_menor_sin_permiso: CHECKLIST_OBRA_MENOR_SIN_PERMISO,
  obra_menor_con_permiso: CHECKLIST_OBRA_MENOR_AMPLIACION,
  recepcion_final: CHECKLIST_RECEPCION_FINAL,
  // Formulario 2-7.1 acepta "Recepción Definitiva Parcial" y "Total" con el
  // mismo formulario (casilla de tipo de solicitud) — mismos antecedentes.
  recepcion_parcial: CHECKLIST_RECEPCION_FINAL,
  loteo: CHECKLIST_LOTEO,
  subdivision: CHECKLIST_SUBDIVISION,
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
