// ---------------------------------------------------------------------------
// Mapa de Formularios Minvu — transcripción fiel de los 5 PDF oficiales que
// clasifican cada trámite DOM por Grupo → Régimen → Actuación → Obra
// Específica, con el nombre EXACTO del documento que presenta el solicitante
// y el que emite/archiva la DOM. Fuente (jul 2026, Estefanía → Tomás):
//   Grupo 1  Obras Menores            MAPA-FORMULARIOS-OBRAS-MENORES.pdf
//   Grupo 2  Obras de Edificación     MAPA-FORMULARIOS-OBRAS-DE-EDIFICACION.pdf
//   Grupo 3  Obras de Urbanización    Mapa-Formularios-GRUPO-3.pdf
//   Grupo 4  Subdivisión y Fusión     Mapa-Formularios-GRUPO-4.pdf
//   Grupo 5  Otras Obras              MAPA-FORMULARIOS-OTRAS-OBRAS.pdf
//
// Es DETERMINISTA y NO inventa nada: cada fila es una transcripción literal de
// una celda del PDF. Donde el PDF no muestra una fila (p. ej. un régimen sin
// esa obra específica), esa combinación simplemente no existe en este arreglo
// — no se completa por analogía, salvo la excepción marcada `domInferido`
// (ver más abajo), documentada caso a caso.
// ---------------------------------------------------------------------------

import type { RespuestasVia } from "@/lib/via-tramitacion"

export type GrupoId = 1 | 2 | 3 | 4 | 5

export interface Grupo {
  id: GrupoId
  nombre: string
  fuenteUrl: string
}

export const GRUPOS: Record<GrupoId, Grupo> = {
  1: {
    id: 1,
    nombre: "Obras Menores",
    fuenteUrl: "https://www.minvu.gob.cl/wp-content/uploads/2019/07/MAPA-FORMULARIOS-OBRAS-MENORES.pdf",
  },
  2: {
    id: 2,
    nombre: "Obras de Edificación",
    fuenteUrl: "https://www.minvu.gob.cl/wp-content/uploads/2019/07/MAPA-FORMULARIOS-OBRAS-DE-EDIFICACION.pdf",
  },
  3: {
    id: 3,
    nombre: "Obras de Urbanización",
    fuenteUrl: "https://www.minvu.gob.cl/wp-content/uploads/2019/07/Mapa-Formularios-GRUPO-3.pdf",
  },
  4: {
    id: 4,
    nombre: "Subdivisión y Fusión Predial",
    fuenteUrl: "https://www.minvu.gob.cl/wp-content/uploads/2019/07/Mapa-Formularios-GRUPO-4.pdf",
  },
  5: {
    id: 5,
    nombre: "Otras Obras",
    fuenteUrl: "https://www.minvu.gob.cl/wp-content/uploads/2019/07/MAPA-FORMULARIOS-OTRAS-OBRAS.pdf",
  },
}

export type Regimen = "permiso_autorizacion" | "declaracion_jurada"

export const REGIMEN_LABELS: Record<Regimen, string> = {
  permiso_autorizacion: "Permiso o autorización",
  declaracion_jurada: "Declaración jurada",
}

export type ActuacionId =
  | "anteproyecto"
  | "permiso"
  | "modificacion_proyecto"
  | "recepcion_definitiva"
  | "garantias"
  | "inicio_obra"
  | "termino_ejecucion"

export const ACTUACION_LABELS: Record<ActuacionId, string> = {
  anteproyecto: "Anteproyecto",
  permiso: "Permiso",
  modificacion_proyecto: "Modificación de proyecto",
  recepcion_definitiva: "Recepción definitiva",
  garantias: "Garantías",
  inicio_obra: "Inicio de obra",
  termino_ejecucion: "Término de ejecución",
}

export interface FilaTramite {
  grupo: GrupoId
  regimen: Regimen
  actuacion: ActuacionId
  obraEspecificaId: string
  obraEspecificaLabel: string
  /** Nombre exacto del documento que presenta el solicitante. */
  nombreSolicitante: string
  /** Nombre exacto del documento/resolución/comprobante que usa o emite la DOM. */
  nombreDom: string
  /** true si `nombreDom` se completó por el patrón de nomenclatura 1:1 del
   *  resto de la tabla porque esa celda del PDF salió en blanco (recorte de
   *  fila), no porque el dato no exista. Ver nota en Grupo 1 más abajo. */
  domInferido?: boolean
}

// =============================================================================
// GRUPO 1 — OBRAS MENORES
// =============================================================================
// Obra específica: 1 Ampliación Hasta 100m² · 2 Modificación sin Alterar su
// Estructura · 3 Ampliación Vivienda Social y Otras · 4 Regularización
// Edificación Antigua · 5 Proyectos Radicación Art. 6.2.9.
//
// Nota fiel al PDF: en régimen Declaración Jurada solo existen las obras
// específicas 1 y 3 (una ampliación pequeña puede tramitarse solo con DJ; una
// modificación sin alterar estructura, una regularización o un proyecto de
// radicación siempre requieren permiso, nunca solo DJ).

const G1_OBRA: Record<string, string> = {
  ampliacion_hasta_100m2: "Ampliación Hasta 100m2",
  modificacion_sin_alterar_estructura: "Modificación sin Alterar su Estructura",
  ampliacion_vivienda_social_y_otras: "Ampliación Vivienda Social y Otras",
  regularizacion_edificacion_antigua: "Regularización Edificación Antigua",
  proyectos_radicacion_6_2_9: "Proyectos Radicación Art. 6.2.9.",
}

const GRUPO_1: FilaTramite[] = [
  // Permiso — Solicitudes de Permiso / Permisos
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "ampliacion_hasta_100m2", obraEspecificaLabel: G1_OBRA.ampliacion_hasta_100m2, nombreSolicitante: "Solicitud de Permiso de Obra Menor: Ampliación Hasta 100m2", nombreDom: "Permiso de Obra Menor: Ampliación Hasta 100m2" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "modificacion_sin_alterar_estructura", obraEspecificaLabel: G1_OBRA.modificacion_sin_alterar_estructura, nombreSolicitante: "Solicitud de Permiso de Obra Menor: Modificación sin Alterar su Estructura", nombreDom: "Permiso de Obra Menor: Modificación sin Alterar su Estructura" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "ampliacion_vivienda_social_y_otras", obraEspecificaLabel: G1_OBRA.ampliacion_vivienda_social_y_otras, nombreSolicitante: "Solicitud de Permiso de Obra Menor: Ampliación Vivienda Social y Otras", nombreDom: "Permiso de Obra Menor: Ampliación Vivienda Social y Otras" },
  // domInferido: la celda DOM del PDF sale en blanco para este cruce (recorte de fila); se
  // completa por el mismo patrón "Solicitud de Permiso de Obra Menor: X" → "Permiso de Obra Menor: X"
  // que se cumple sin excepción en las otras 4 filas de esta misma actuación.
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "regularizacion_edificacion_antigua", obraEspecificaLabel: G1_OBRA.regularizacion_edificacion_antigua, nombreSolicitante: "Solicitud de Permiso de Obra Menor: Regularización Edificación Antigua", nombreDom: "Permiso de Obra Menor: Regularización Edificación Antigua", domInferido: true },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "proyectos_radicacion_6_2_9", obraEspecificaLabel: G1_OBRA.proyectos_radicacion_6_2_9, nombreSolicitante: "Solicitud de Permiso de Obra Menor: Proyectos Radicación Art. 6.2.9.", nombreDom: "Permiso de Obra Menor: Proyectos Radicación Art. 6.2.9." },

  // Permiso — Modificación de Proyecto (solo existe para 1, 3 y 5 en el PDF)
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "modificacion_proyecto", obraEspecificaId: "ampliacion_hasta_100m2", obraEspecificaLabel: G1_OBRA.ampliacion_hasta_100m2, nombreSolicitante: "Solicitud de Modificación de Proyecto de Obra Menor: Ampliación Hasta 100m2", nombreDom: "Resolución de Modificación de Proyecto de Obra Menor: Ampliación Hasta 100m2" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "modificacion_proyecto", obraEspecificaId: "ampliacion_vivienda_social_y_otras", obraEspecificaLabel: G1_OBRA.ampliacion_vivienda_social_y_otras, nombreSolicitante: "Solicitud de Modificación de Proyecto de Obra Menor: Ampliación Vivienda Social y Otras", nombreDom: "Resolución de Modificación de Proyecto de Obra Menor: Ampliación Vivienda Social y Otras" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "modificacion_proyecto", obraEspecificaId: "proyectos_radicacion_6_2_9", obraEspecificaLabel: G1_OBRA.proyectos_radicacion_6_2_9, nombreSolicitante: "Solicitud de Modificación de Proyecto Obra Menor: Proyectos Radicación Art. 6.2.9.", nombreDom: "Resolución de Modificación de Proyecto Obra Menor: Proyectos Radicación Art. 6.2.9." },

  // Permiso — Recepción Definitiva (no existe fila propia para "Regularización Edificación
  // Antigua" en la solicitud del PDF: se cierra con el certificado de regularización directo)
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "recepcion_definitiva", obraEspecificaId: "ampliacion_hasta_100m2", obraEspecificaLabel: G1_OBRA.ampliacion_hasta_100m2, nombreSolicitante: "Solicitud de Recepción Definitiva de Obra Menor: Ampliación Hasta 100m2", nombreDom: "Certificado de Recepción Definitiva de Obra Menor: Ampliación Hasta 100m2" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "recepcion_definitiva", obraEspecificaId: "modificacion_sin_alterar_estructura", obraEspecificaLabel: G1_OBRA.modificacion_sin_alterar_estructura, nombreSolicitante: "Solicitud de Recepción Definitiva de Obra Menor: Modificación sin Alterar su Estructura", nombreDom: "Certificado de Recepción Definitiva de Obra Menor: Modificación sin Alterar su Estructura" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "recepcion_definitiva", obraEspecificaId: "ampliacion_vivienda_social_y_otras", obraEspecificaLabel: G1_OBRA.ampliacion_vivienda_social_y_otras, nombreSolicitante: "Solicitud de Recepción Definitiva de Obra Menor: Ampliación Vivienda Social y Otras", nombreDom: "Certificado de Recepción Definitiva de Obra Menor: Ampliación Vivienda Social y Otras" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "recepcion_definitiva", obraEspecificaId: "regularizacion_edificacion_antigua", obraEspecificaLabel: G1_OBRA.regularizacion_edificacion_antigua, nombreSolicitante: "(la Solicitud de Permiso hace de solicitud de cierre — no hay solicitud de recepción separada)", nombreDom: "Certificado de Regularización de Obra Menor: Regularización Edificación Antigua" },
  { grupo: 1, regimen: "permiso_autorizacion", actuacion: "recepcion_definitiva", obraEspecificaId: "proyectos_radicacion_6_2_9", obraEspecificaLabel: G1_OBRA.proyectos_radicacion_6_2_9, nombreSolicitante: "Solicitud de Recepción Definitiva de: Proyectos Radicación Art. 6.2.9.", nombreDom: "Certificado de Recepción Definitiva de Obra Menor: Proyectos Radicación Art. 6.2.9." },

  // Declaración Jurada — solo obra específica 1 y 3 (única vía sin permiso)
  { grupo: 1, regimen: "declaracion_jurada", actuacion: "inicio_obra", obraEspecificaId: "ampliacion_hasta_100m2", obraEspecificaLabel: G1_OBRA.ampliacion_hasta_100m2, nombreSolicitante: "Declaración Jurada de Inicio de Obra Menor: Ampliación Hasta 100m2", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Inicio de Obra Menor" },
  { grupo: 1, regimen: "declaracion_jurada", actuacion: "inicio_obra", obraEspecificaId: "ampliacion_vivienda_social_y_otras", obraEspecificaLabel: G1_OBRA.ampliacion_vivienda_social_y_otras, nombreSolicitante: "Declaración Jurada de Inicio de Obra Menor: Ampliación Vivienda Social y Otras", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Inicio de Obra Menor" },
  { grupo: 1, regimen: "declaracion_jurada", actuacion: "modificacion_proyecto", obraEspecificaId: "ampliacion_hasta_100m2", obraEspecificaLabel: G1_OBRA.ampliacion_hasta_100m2, nombreSolicitante: "Declaración Jurada de Modificación de Proyecto de Obra Menor: Ampliación Hasta 100m2", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Modificación de Proyecto" },
  { grupo: 1, regimen: "declaracion_jurada", actuacion: "modificacion_proyecto", obraEspecificaId: "ampliacion_vivienda_social_y_otras", obraEspecificaLabel: G1_OBRA.ampliacion_vivienda_social_y_otras, nombreSolicitante: "Declaración Jurada de Modificación de Proyecto de Obra Menor: Ampliación Vivienda Social y Otras", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Modificación de Proyecto" },
  { grupo: 1, regimen: "declaracion_jurada", actuacion: "termino_ejecucion", obraEspecificaId: "ampliacion_hasta_100m2", obraEspecificaLabel: G1_OBRA.ampliacion_hasta_100m2, nombreSolicitante: "Declaración Jurada de Término de Ejecución de Obra Menor: Ampliación Hasta 100m2", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Término de Ejecución de Obra Menor" },
  { grupo: 1, regimen: "declaracion_jurada", actuacion: "termino_ejecucion", obraEspecificaId: "ampliacion_vivienda_social_y_otras", obraEspecificaLabel: G1_OBRA.ampliacion_vivienda_social_y_otras, nombreSolicitante: "Declaración Jurada de Término de Ejecución de Obra Menor: Ampliación Vivienda Social y Otras", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Término de Ejecución de Obra Menor" },
]

// =============================================================================
// GRUPO 2 — OBRAS DE EDIFICACIÓN
// =============================================================================
// Obra específica: 1 Obra Nueva · 2 Ampliación mayor a 100m² · 3 Alteración ·
// 4 Reconstrucción · 5 Reparación. Tabla completa (sin huecos) en las 4
// actuaciones de régimen Permiso. El PDF NO muestra columna de Declaración
// Jurada del lado solicitante para este grupo: en obras de edificación la
// declaración jurada solo acompaña como trámite administrativo (inicio /
// modificación / término) DESPUÉS de obtenido el permiso — no es una vía
// alternativa al permiso, a diferencia del Grupo 1.

const G2_OBRA: Record<string, string> = {
  obra_nueva: "Obra Nueva",
  ampliacion_mayor_100m2: "Ampliación mayor a 100m2",
  alteracion: "Alteración",
  reconstruccion: "Reconstrucción",
  reparacion: "Reparación",
}

function filasG2(actuacion: ActuacionId, prefijoSolicitante: string, prefijoDom: string, incluirReparacion: boolean): FilaTramite[] {
  const base: [string, string][] = [
    ["obra_nueva", G2_OBRA.obra_nueva],
    ["ampliacion_mayor_100m2", G2_OBRA.ampliacion_mayor_100m2],
    ["alteracion", G2_OBRA.alteracion],
    ["reconstruccion", G2_OBRA.reconstruccion],
  ]
  const filas = incluirReparacion ? [...base, ["reparacion", G2_OBRA.reparacion] as [string, string]] : base
  return filas.map(([id, label]) => ({
    grupo: 2,
    regimen: "permiso_autorizacion",
    actuacion,
    obraEspecificaId: id,
    obraEspecificaLabel: label,
    nombreSolicitante: `${prefijoSolicitante}: ${label}`,
    nombreDom: `${prefijoDom}: ${label}`,
  }))
}

const GRUPO_2: FilaTramite[] = [
  // Anteproyecto: el PDF no incluye "Reparación" (una reparación no pasa por anteproyecto)
  ...filasG2("anteproyecto", "Solicitud de Aprobación de Anteproyecto de Obras de Edificación", "Resolución de Aprobación de Anteproyecto de Obras de Edificación", false),
  ...filasG2("permiso", "Solicitud de Permiso de Edificación", "Permiso de Edificación", true),
  ...filasG2("modificacion_proyecto", "Solicitud de Modificación de Proyecto de Edificación", "Resolución de Aprobación de Modificación de Proyecto de Edificación", true),
  ...filasG2("recepcion_definitiva", "Solicitud de Recepción Definitiva de Obras de Edificación", "Certificado de Recepción Definitiva de Obras de Edificación", true),
]

// =============================================================================
// GRUPO 3 — OBRAS DE URBANIZACIÓN
// =============================================================================

const G3_OBRA: Record<string, string> = {
  loteo: "Loteo, Loteo con const. simultánea, Loteo DFL N°2 con cons. simultánea y de sus obras de urbanización",
  division_utilidad_publica: "División de predio afecto a declaratoria de utilidad pública y de sus obras de urbanización",
  predios_copropiedad: "Urbanización de Predios Afectos a Utilidad Pública acogidos a Copropiedad Inmobiliaria",
  voluntaria_espacio_publico: "Urbanización Voluntaria en el espacio público existente",
  cesion_voluntaria_interior: "Urbanización y Cesión Voluntaria al interior de un predio",
}

function filasG3(actuacion: ActuacionId, prefijoSolicitante: string, prefijoDom: string): FilaTramite[] {
  return Object.entries(G3_OBRA).map(([id, label]) => ({
    grupo: 3,
    regimen: "permiso_autorizacion",
    actuacion,
    obraEspecificaId: id,
    obraEspecificaLabel: label,
    nombreSolicitante: `${prefijoSolicitante} de: ${label}`,
    nombreDom: `${prefijoDom} de: ${label}`,
  }))
}

const GRUPO_3: FilaTramite[] = [
  ...filasG3("anteproyecto", "Solicitud de aprobación de Anteproyecto", "Resolución de aprobación"),
  ...filasG3("permiso", "Solicitud de Permiso", "Permiso"),
  ...filasG3("modificacion_proyecto", "Solicitud de Modificación de Proyecto", "Resolución de aprobación de Modificación de Proyecto"),
  ...filasG3("recepcion_definitiva", "Solicitud de Recepción Definitiva de Obras de Urbanización", "Certificado de Recepción Definitiva de Obras de Urbanización"),
  // Garantías: el PDF solo muestra 2 filas (loteo y predios afectos a utilidad pública /
  // copropiedad), no las 5 obras específicas completas.
  { grupo: 3, regimen: "permiso_autorizacion", actuacion: "garantias", obraEspecificaId: "loteo", obraEspecificaLabel: G3_OBRA.loteo, nombreSolicitante: "Solicitud de Garantías de Obras de Urbanización de: Loteo, Loteo con const. simultánea, Loteo DFL N°2 const. simultánea", nombreDom: "Certificado de Obras de Urbanización Garantizadas: Loteo, Loteo con const. simultánea, Loteo DFL N°2 const. simultánea" },
  { grupo: 3, regimen: "permiso_autorizacion", actuacion: "garantias", obraEspecificaId: "predios_copropiedad", obraEspecificaLabel: G3_OBRA.predios_copropiedad, nombreSolicitante: "Solicitud de Garantías de Obras de Urbanización de: División Predial con Afectación a Utilidad Pública y de Urbanización o Predios Afectos a Utilidad Pública acogidos a Copropiedad Inmobiliaria", nombreDom: "Certificado de Obras de Urbanización Garantizadas: División Predial con Afectación a Utilidad Pública y de Urbanización o Predios Afectos a Utilidad Pública acogidos a Copropiedad Inmobiliaria" },
]

// =============================================================================
// GRUPO 4 — SUBDIVISIÓN Y FUSIÓN PREDIAL
// =============================================================================
// Sin distinción de régimen ni obra específica en el PDF: solo 3 actuaciones
// planas (subdivisión / fusión / ambas simultáneas).

const GRUPO_4: FilaTramite[] = [
  { grupo: 4, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "subdivision", obraEspecificaLabel: "Subdivisión", nombreSolicitante: "Solicitud de aprobación de subdivisión", nombreDom: "Resolución de aprobación de subdivisión" },
  { grupo: 4, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "fusion", obraEspecificaLabel: "Fusión", nombreSolicitante: "Solicitud de aprobación de fusión", nombreDom: "Resolución de aprobación de fusión" },
  { grupo: 4, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "subdivision_y_fusion", obraEspecificaLabel: "Subdivisión y fusión simultánea", nombreSolicitante: "Solicitud de aprobación de subdivisión y fusión simultánea", nombreDom: "Resolución de aprobación de subdivisión y fusión simultánea" },
]

// =============================================================================
// GRUPO 5 — OTRAS OBRAS
// =============================================================================
// Estructura distinta a los grupos 1-3: no hay una grilla completa de obra
// específica × actuación, sino categorías puntuales (demolición, obras
// auxiliares, edificaciones con destino complementario al área verde, piscina
// privada a 1,5m o menos del deslinde).

const GRUPO_5: FilaTramite[] = [
  { grupo: 5, regimen: "permiso_autorizacion", actuacion: "permiso", obraEspecificaId: "demolicion", obraEspecificaLabel: "Demolición", nombreSolicitante: "Solicitud de Permiso de Demolición", nombreDom: "Permiso de Demolición" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "inicio_obra", obraEspecificaId: "obras_auxiliares", obraEspecificaLabel: "Obras Auxiliares", nombreSolicitante: "Declaración Jurada de Obras Auxiliares", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Obras Auxiliares" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "inicio_obra", obraEspecificaId: "demolicion", obraEspecificaLabel: "Demolición", nombreSolicitante: "Declaración Jurada de Demolición", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Inicio de Obras" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "inicio_obra", obraEspecificaId: "edificaciones_area_verde", obraEspecificaLabel: "Edificaciones con destino complementario al Área Verde", nombreSolicitante: "Declaración Jurada de Inicio de Obras Edificaciones con destino complementario al Área Verde", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Inicio de Obras" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "inicio_obra", obraEspecificaId: "piscina_privada_deslinde", obraEspecificaLabel: "Piscina Privada a 1,5m o menos del deslinde vecino", nombreSolicitante: "Declaración Jurada de Inicio de Obras Piscina Privada a 1,5m o menos del deslinde vecino", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Inicio de Obras" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "modificacion_proyecto", obraEspecificaId: "edificaciones_area_verde", obraEspecificaLabel: "Edificaciones con destino complementario al Área Verde", nombreSolicitante: "Declaración Jurada de Modificación de Proyecto Edificaciones con destino complementario al Área Verde", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Modificación de Proyecto" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "modificacion_proyecto", obraEspecificaId: "piscina_privada_deslinde", obraEspecificaLabel: "Piscina Privada a 1,5m o menos del deslinde vecino", nombreSolicitante: "Declaración Jurada de Modificación de Proyecto Piscina Privada a 1,5m o menos del deslinde vecino", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Modificación de Proyecto" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "termino_ejecucion", obraEspecificaId: "edificaciones_area_verde", obraEspecificaLabel: "Edificaciones con destino complementario al Área Verde", nombreSolicitante: "Declaración Jurada de Término de Ejecución Edificaciones con destino complementario al Área Verde", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Término de Ejecución" },
  { grupo: 5, regimen: "declaracion_jurada", actuacion: "termino_ejecucion", obraEspecificaId: "piscina_privada_deslinde", obraEspecificaLabel: "Piscina Privada a 1,5m o menos del deslinde vecino", nombreSolicitante: "Declaración Jurada de Término de Ejecución Piscina Privada a 1,5m o menos del deslinde vecino", nombreDom: "Comprobante de Ingreso/Archivo de Declaración Jurada de Término de Ejecución" },
]

export const TRAMITES_MAPA: FilaTramite[] = [...GRUPO_1, ...GRUPO_2, ...GRUPO_3, ...GRUPO_4, ...GRUPO_5]

// ── Consultas ────────────────────────────────────────────────────────────────

export function tramitesDeGrupo(grupo: GrupoId): FilaTramite[] {
  return TRAMITES_MAPA.filter((t) => t.grupo === grupo)
}

export function obrasEspecificasDeGrupo(grupo: GrupoId): { id: string; label: string }[] {
  const vistos = new Map<string, string>()
  for (const t of tramitesDeGrupo(grupo)) {
    if (!vistos.has(t.obraEspecificaId)) vistos.set(t.obraEspecificaId, t.obraEspecificaLabel)
  }
  return [...vistos.entries()].map(([id, label]) => ({ id, label }))
}

// ── Consultas en cascada (para un selector manual Grupo → Régimen →
// Actuación → Obra específica, p. ej. el explorador de /herramientas). Cada
// nivel solo devuelve las opciones que realmente existen para el nivel
// anterior — nunca una combinación que no esté en el Mapa de Formularios.

export function regimenesDeGrupo(grupo: GrupoId): Regimen[] {
  const vistos = new Set<Regimen>()
  for (const t of tramitesDeGrupo(grupo)) vistos.add(t.regimen)
  return [...vistos]
}

export function actuacionesDe(grupo: GrupoId, regimen: Regimen): ActuacionId[] {
  const vistos = new Set<ActuacionId>()
  for (const t of tramitesDeGrupo(grupo)) {
    if (t.regimen === regimen) vistos.add(t.actuacion)
  }
  return [...vistos]
}

export function obrasEspecificasDe(grupo: GrupoId, regimen: Regimen, actuacion: ActuacionId): { id: string; label: string }[] {
  const vistos = new Map<string, string>()
  for (const t of tramitesDeGrupo(grupo)) {
    if (t.regimen === regimen && t.actuacion === actuacion && !vistos.has(t.obraEspecificaId)) {
      vistos.set(t.obraEspecificaId, t.obraEspecificaLabel)
    }
  }
  return [...vistos.entries()].map(([id, label]) => ({ id, label }))
}

export function buscarTramite(
  grupo: GrupoId,
  regimen: Regimen,
  actuacion: ActuacionId,
  obraEspecificaId: string,
): FilaTramite | undefined {
  return TRAMITES_MAPA.find(
    (t) => t.grupo === grupo && t.regimen === regimen && t.actuacion === actuacion && t.obraEspecificaId === obraEspecificaId,
  )
}

// =============================================================================
// Clasificador — conecta las respuestas del flujo guiado de vía
// (`lib/via-tramitacion.ts`) con la familia de formulario oficial.
//
// Espeja rama por rama la lógica de `recomendarVia()`: mismas preguntas,
// mismo orden de prioridad. Cuando la combinación de respuestas no tiene una
// fila unívoca en el Mapa de Formularios (p. ej. cambio de destino puro, o
// una ampliación sin dato de superficie para decidir Grupo 1 vs Grupo 2), NO
// se adivina: se devuelve `noDeterminado` con la razón.
// =============================================================================

export interface ClasificacionInput {
  respuestas: RespuestasVia
  /** m² que agrega la ampliación, si `aumentaSuperficie` es true. Sin este
   *  dato no se puede distinguir Obra Menor (≤100m²) de Obra de Edificación
   *  (>100m²). */
  superficieAmpliacionM2?: number
}

export type ResultadoClasificacion =
  | { determinado: true; tramite: FilaTramite; notas: string[] }
  | { determinado: false; razon: string }

function conTramite(tramite: FilaTramite | undefined, notas: string[] = []): ResultadoClasificacion {
  if (!tramite) {
    return { determinado: false, razon: "La combinación no tiene fila en el Mapa de Formularios cargado (revisar transcripción)." }
  }
  return { determinado: true, tramite, notas }
}

export function clasificarFamiliaFormulario(input: ClasificacionInput): ResultadoClasificacion {
  const { respuestas: r, superficieAmpliacionM2 } = input

  if (r.yaConstruido) {
    return conTramite(buscarTramite(1, "permiso_autorizacion", "permiso", "regularizacion_edificacion_antigua"), [
      "Regularización a escala de obra menor (Art. 5.8.1 OGUC). Si la obra excede esa escala, la vía de regularización mayor (Ley 20.898) no está cubierta por este mapa.",
    ])
  }

  if (r.cambiaDestino && !r.alteraEstructura && !r.aumentaSuperficie) {
    return {
      determinado: false,
      razon:
        "El cambio de destino puro (sin obra) no tiene fila propia en el Mapa de Formularios Minvu: no es un permiso de edificación ni de obra menor distinto, se ampara en el Art. 116 LGUC y circulares DDU (ver asesor de vía).",
    }
  }

  if (!r.alteraEstructura && !r.aumentaSuperficie && !r.cambiaDestino) {
    return conTramite(buscarTramite(1, "permiso_autorizacion", "permiso", "modificacion_sin_alterar_estructura"))
  }

  if (r.alteraEstructura) {
    return conTramite(
      buscarTramite(2, "permiso_autorizacion", "permiso", "alteracion"),
      r.cambiaDestino ? ["También cambia el destino: revisa además la circular DDU aplicable al nuevo uso."] : [],
    )
  }

  if (r.aumentaSuperficie) {
    if (superficieAmpliacionM2 == null) {
      return {
        determinado: false,
        razon: "Aumenta la superficie, pero falta el m² de la ampliación para decidir entre Obra Menor (Grupo 1, ≤100m²) y Obra de Edificación (Grupo 2, >100m²).",
      }
    }
    const tramite =
      superficieAmpliacionM2 <= 100
        ? buscarTramite(1, "permiso_autorizacion", "permiso", "ampliacion_hasta_100m2")
        : buscarTramite(2, "permiso_autorizacion", "permiso", "ampliacion_mayor_100m2")
    return conTramite(
      tramite,
      r.cambiaDestino ? ["También cambia el destino: revisa además la circular DDU aplicable al nuevo uso."] : [],
    )
  }

  return { determinado: false, razon: "No fue posible determinar la familia de formulario con las respuestas actuales." }
}
