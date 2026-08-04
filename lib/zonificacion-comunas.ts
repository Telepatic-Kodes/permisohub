// Registro de cobertura de zonificación (PRC) por comuna — pequeño, profundo y curado
// a mano, siguiendo el patrón de lib/municipios-stats.ts (no se agrega a lib/comunas-chile.ts).
//
// Cada entrada mapea una comuna cubierta a su FeatureServer ArcGIS ya verificado en vivo
// (URL, índice de capa y casing exacto de los campos), según
// .planning/phases/10-motor-de-zonificacion/10-RESEARCH.md ("Verified Per-Comuna Registry").
//
// Este archivo es la fuente de verdad que consulta la ruta de lookup (Plan 10-04) antes de
// hacer cualquier llamada de red, para decidir si una comuna es 'dedicada', 'agregada' o no
// tiene cobertura (null) — nunca un objeto con campos vacíos indistinguible de cobertura real.

import { COMUNAS_CHILE } from './comunas-chile'

export type TierCobertura = 'dedicada' | 'agregada'

export interface ZonificacionFieldMap {
  region: string
  comuna: string
  sector: string
  zona: string
  nombre: string
  uperm: string
  uproh: string
  // Solo declarar si el servicio expone un link POR-ZONA real y vivo. No
  // fabricar ni reusar un link genérico — ver el caso Las Condes más abajo.
  url?: string
}

export interface ComunaZonificacionConfig {
  comunaId: string // matches ComunaChile.id in lib/comunas-chile.ts
  tier: TierCobertura
  featureServerUrl: string
  layerIndex: number
  fieldMap: ZonificacionFieldMap
  usosDisponibles: boolean // false for Ñuñoa — UPERM/UPROH are structurally empty in the source, must be disclosed, never inferred from nullability alone
  // Provenance metadata surfaced to the architect (Auditoría de Fidelidad de
  // Datos, 2026-07-30, hallazgos C4/A1). None of these layers are an official
  // municipal feed — see per-comuna comments below for what each one actually is.
  fuenteNombre: string
  // ISO year-month (or date) the layer's OWN publisher declares its content
  // current through — distinct from `fuente_actualizada_el` (ArcGIS's
  // editingInfo.dataLastEditDate, a technical republish timestamp). Only set
  // when the publisher states this explicitly in the layer description; leave
  // undefined otherwise rather than guessing.
  contenidoDeclaradoHasta?: string
}

export const ZONIFICACION_COMUNAS: Record<string, ComunaZonificacionConfig> = {
  'las-condes': {
    comunaId: 'las-condes',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Las_Condes/FeatureServer',
    layerIndex: 0,
    // Sin `url`: el campo ArcGIS "url" existía antes, pero apuntaba a
    // http://www.observatoriourbano.cl/Ipt/cehu_resultado_decreto.asp?r=0&c=193&i=25
    // para las 67 zonas de Las Condes por igual (no es un link por-zona pese
    // a presentarse como "decreto de la zona") y hoy devuelve HTTP 410 Gone.
    // Removido en el fix C5 de la Auditoría de Fidelidad de Datos (2026-07-30);
    // sin `url`, la UI cae al mismo tratamiento "sin link directo disponible —
    // consulta el CIP oficial" que ya usan Providencia y Vitacura.
    fieldMap: {
      region: 'region',
      comuna: 'comuna',
      sector: 'sector',
      zona: 'zona',
      nombre: 'nombre',
      uperm: 'uperm',
      uproh: 'uproh',
    },
    usosDisponibles: true,
    // Auditoría 2026-07-30 (C4/A1): esta capa es un espejo académico del
    // Observatorio de Ciudades UC (ex Observatorio Urbano MINVU-PUC), no un
    // feed municipal oficial — trae su propio disclaimer "verifique vigencia
    // antes de reutilizar". Su `editingInfo.dataLastEditDate` real es
    // 2020-03-09 pese a que el servicio muestra una "fecha de referencia"
    // 2026 (republish técnico, no actualización de contenido). Las Condes
    // tuvo Modificación N°10 (D.O. nov-2022) y N°11 (2021-2024) posteriores.
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  providencia: {
    comunaId: 'providencia',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Providencia/FeatureServer',
    layerIndex: 0,
    fieldMap: {
      region: 'region',
      comuna: 'comuna',
      sector: 'sector',
      zona: 'zona',
      nombre: 'nombre',
      uperm: 'uperm',
      uproh: 'uproh',
    },
    usosDisponibles: true,
    // Ver comentario de procedencia en las-condes arriba (Auditoría 2026-07-30,
    // C4/A1) — mismo espejo académico OCUC/PUC, mismo dataLastEditDate 2020-03-09.
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  vitacura: {
    comunaId: 'vitacura',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Vitacura/FeatureServer',
    layerIndex: 0,
    fieldMap: {
      region: 'region',
      comuna: 'comuna',
      sector: 'sector',
      zona: 'zona',
      nombre: 'nombre',
      uperm: 'uperm',
      uproh: 'uproh',
    },
    usosDisponibles: true,
    // Ver comentario de procedencia en las-condes arriba (Auditoría 2026-07-30,
    // C4/A1) — mismo espejo académico OCUC/PUC, mismo dataLastEditDate 2020-03-09.
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  nunoa: {
    comunaId: 'nunoa',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: {
      region: 'REGION',
      comuna: 'COMUNA',
      sector: 'SECTOR',
      zona: 'ZONA',
      nombre: 'NOMBRE',
      uperm: 'UPERM',
      uproh: 'UPROH',
    },
    // Pitfall 8: UPERM/UPROH confirmados 0/200 llenos para Ñuñoa en esta capa agregada,
    // aunque la capa sí resuelve correctamente el código/nombre de zona. Debe declararse
    // explícitamente como no disponible — nunca inferirse solo de que el campo venga vacío.
    usosDisponibles: false,
    // Auditoría 2026-07-30 (C4/A1): capa agregada "PrcCuencaMaipo" publicada
    // desde una cuenta ArcGIS personal (no institucional), georreferenciación
    // independiente — no un feed municipal. Su propia descripción declara
    // contenido "actualizado hasta diciembre 2014". Ñuñoa tuvo Modificación
    // N°18 y Enmienda N°1 (vigente dic-2024) no reflejadas. Se mantiene en
    // cobertura (no se retira) a condición de la advertencia fuerte en la UI.
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },

  // ── Ampliación de cobertura vía PrcCuencaMaipo (04 ago 2026) ────────────
  // La capa agregada de Ñuñoa arriba cubre TODA la cuenca del Maipo, no solo
  // Ñuñoa — verificado en vivo con una query de valores distintos del campo
  // COMUNA (47 comunas en la capa, incluyendo zonas fuera de la RM como
  // Cartagena/Santo Domingo/Mostazal/Codegua, descartadas acá por no ser RM).
  // De las comunas RM presentes y aún sin cobertura, se probó UPERM/UPROH
  // real (no placeholder) para cada una con una query filtrada por COMUNA:
  // - Maipú, La Florida, Peñalolén, San Bernardo, Quilicura, Huechuraba, Lo
  //   Barnechea, Colina, San Ramón, Quinta Normal, La Reina, Santiago:
  //   UPERM/UPROH reales y no vacíos, agregadas abajo como
  //   'agregada'/usosDisponibles:true.
  // - La Reina y Santiago en particular: sus capas DEDICADAS propias (mismo
  //   owner que Las Condes/Providencia/etc.) no tienen los campos
  //   comuna/zona/uperm/uproh que necesita el fieldMap 'dedicada' (solo
  //   geometría + "zonas"/"dens_b_max" para La Reina, "uso_suelo" para
  //   Santiago) — se descartaron en la ampliación de 31-jul. Esta capa
  //   agregada sí las cubre a ambas.
  // - La Pintana y Peñaflor: el ÚNICO valor de ZONA en toda la comuna es
  //   "PRMS" con UPERM literal "Ver Zonificación del PRMS" — remiten al Plan
  //   Regulador Metropolitano de Santiago, no traen texto de uso real. Sin
  //   dato utilizable, quedan sin cobertura (no fabricar un mapeo a un campo
  //   que no existe).
  // Mismo disclaimer de procedencia/vigencia que Ñuñoa (misma capa, mismo
  // "actualizado hasta diciembre 2014" declarado por el publicador).
  maipu: {
    comunaId: 'maipu',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  'la-florida': {
    comunaId: 'la-florida',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  penalolen: {
    comunaId: 'penalolen',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  'san-bernardo': {
    comunaId: 'san-bernardo',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  quilicura: {
    comunaId: 'quilicura',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  huechuraba: {
    comunaId: 'huechuraba',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  'lo-barnechea': {
    comunaId: 'lo-barnechea',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  colina: {
    comunaId: 'colina',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  'san-ramon': {
    comunaId: 'san-ramon',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  'quinta-normal': {
    comunaId: 'quinta-normal',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  'la-reina': {
    comunaId: 'la-reina',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    // A diferencia de las otras 10 de este grupo, La Reina SÍ tiene una capa
    // DEDICADA propia (PRC_La_Reina, mismo owner que Las Condes/Providencia)
    // — pero esa capa no trae comuna/zona/uperm/uproh, solo geometría +
    // "zonas"/"dens_b_max" (verificado en vivo 04-08, ver exclusión de 31-jul
    // más abajo). Esta capa agregada sí resuelve uso real, así que se usa en
    // su lugar pese a existir la dedicada — la dedicada no se referencia acá.
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },
  santiago: {
    comunaId: 'santiago',
    tier: 'agregada',
    featureServerUrl:
      'https://services7.arcgis.com/UeyripQFTg6pfUe5/arcgis/rest/services/PrcCuencaMaipo/FeatureServer',
    layerIndex: 0,
    // Mismo caso que La Reina: la capa DEDICADA propia (PRC_Santiago) no
    // trae comuna/uperm/uproh, solo 'zona'/'uso_suelo'/'zona_fi' — pero esta
    // capa agregada sí resuelve uso real (16 zonas distintas verificadas en
    // vivo 04-08, UPERM/UPROH no vacíos). Comuna de alta densidad comercial,
    // la más valiosa de las agregadas en esta ronda.
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Capa agregada PRC Cuenca del Maipo (IDE Chile, georref. independiente)',
    contenidoDeclaradoHasta: '2014-12',
  },

  // ── Ampliación de cobertura (31 jul 2026) ──────────────────────────────
  // Estefanía pidió salir del "solo sector oriente". Búsqueda en el catálogo
  // ArcGIS Online del mismo owner que ya usábamos para Las Condes/Providencia/
  // Vitacura (isidro.puigOCUC — Observatorio de Ciudades UC) encontró 46 capas
  // "PRC_*" en total, 20 de ellas en la Región Metropolitana. De esas 20:
  // - 14 comparten el mismo fieldMap minúscula que Las Condes/Providencia/
  //   Vitacura (mismo owner, mismo pipeline) — agregadas abajo como 'dedicada'.
  // - Independencia usa el mismo fieldMap MAYÚSCULA que la capa agregada de
  //   Ñuñoa, pero es su propia capa dedicada a esa comuna (no agregada
  //   multi-comuna) — sí tiene uperm/uproh reales, verificado en vivo.
  // - Santiago y La Reina quedaron FUERA de ESTA capa dedicada específica:
  //   sus capas propias no siguen ninguno de los dos fieldMap (Santiago: sin
  //   campo comuna/uperm/uproh, solo 'uso_suelo'; La Reina: sin comuna/zona/
  //   uperm/uproh, solo 'zonas'/'dens_b_max') — no fabricar un mapeo que no
  //   corresponde a esos campos reales. Ambas quedaron cubiertas después
  //   (04-08) vía la capa agregada PrcCuencaMaipo, que sí resuelve su uso
  //   real (16 zonas distintas para Santiago, UPERM/UPROH no vacíos) pese a
  //   que sus capas dedicadas no pueden — ver esas entradas más arriba.
  // Verificado en vivo (2026-07-31): fields de las 15 vía FeatureServer/0?f=json
  // para confirmar casing; point-in-polygon real con uperm/uproh no vacío para
  // Puente Alto, Independencia, San Miguel y Recoleta (muestra representativa
  // de las dos variantes de fieldMap, no las 15 una por una).
  'puente-alto': {
    comunaId: 'puente-alto',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Puente_Alto/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'estacion-central': {
    comunaId: 'estacion-central',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Estación_Central/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'la-granja': {
    comunaId: 'la-granja',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_La_Granja/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'lo-espejo': {
    comunaId: 'lo-espejo',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Lo_Espejo/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'la-cisterna': {
    comunaId: 'la-cisterna',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_La_Cisterna/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  conchali: {
    comunaId: 'conchali',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Conchalí/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'san-miguel': {
    comunaId: 'san-miguel',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_San_Miguel/FeatureServer',
    layerIndex: 0,
    // Point-in-polygon en vivo (Gran Av. José Miguel Carrera 3300): zona ZU-5,
    // uperm "Equipamiento de salud." — confirmado real, no vacío.
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  macul: {
    comunaId: 'macul',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Macul/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  recoleta: {
    comunaId: 'recoleta',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Recoleta/FeatureServer',
    layerIndex: 0,
    // Point-in-polygon en vivo (Av. Recoleta 2000): zona U-E/E-A1, uperm
    // "Residencial; equipamiento." — confirmado real, no vacío.
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'cerro-navia': {
    comunaId: 'cerro-navia',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Cerro_Navia/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'lo-prado': {
    comunaId: 'lo-prado',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Lo_Prado/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'pedro-aguirre-cerda': {
    comunaId: 'pedro-aguirre-cerda',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Pedro_Aguirre_Cerda/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  renca: {
    comunaId: 'renca',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_Renca/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  'san-joaquin': {
    comunaId: 'san-joaquin',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC_San_Joaquín/FeatureServer',
    layerIndex: 0,
    fieldMap: { region: 'region', comuna: 'comuna', sector: 'sector', zona: 'zona', nombre: 'nombre', uperm: 'uperm', uproh: 'uproh' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
  independencia: {
    comunaId: 'independencia',
    tier: 'dedicada',
    featureServerUrl:
      'https://services9.arcgis.com/kKJR3Qt68ohAWuet/arcgis/rest/services/PRC__Independencia/FeatureServer',
    layerIndex: 0,
    // Única de las 15 nuevas con fieldMap MAYÚSCULA (mismo patrón que la capa
    // agregada de Ñuñoa) pese a ser una capa DEDICADA a esta comuna — no es
    // agregada, sí tiene uperm/uproh reales y no vacíos, verificado en vivo
    // (centroide de zona real): zona "C", uperm "Residencial: vivienda,
    // hospedaje; equipamiento: comercio, culto y cultura...".
    fieldMap: { region: 'REGION', comuna: 'COMUNA', sector: 'SECTOR', zona: 'ZONA', nombre: 'NOMBRE', uperm: 'UPERM', uproh: 'UPROH' },
    usosDisponibles: true,
    fuenteNombre: 'Observatorio de Ciudades UC (espejo de datos MINVU)',
  },
}

/**
 * Resolves whatever string is stored in proyectos.municipio (a display name
 * like "Las Condes", not a slug) to a zonificación registry entry.
 * Returns null when the comuna has no ArcGIS coverage — this is the
 * sin_cobertura signal, never an empty-but-truthy object (Pitfall 3).
 */
export function resolveComunaZonificacion(nombreOMunicipio: string): ComunaZonificacionConfig | null {
  const normalizado = nombreOMunicipio.trim().toLowerCase()
  const comuna = COMUNAS_CHILE.find(
    (c) => c.nombre.toLowerCase() === normalizado || c.id.toLowerCase() === normalizado,
  )
  const slug = comuna?.id ?? normalizado
  return ZONIFICACION_COMUNAS[slug] ?? null
}

/**
 * Lista de comunas con cobertura ArcGIS, para consumidores como el fallback
 * manual de Phase 11 (ZONE-05) sin tener que re-derivarla.
 */
export function getComunasConCobertura(): ComunaZonificacionConfig[] {
  return Object.values(ZONIFICACION_COMUNAS)
}

/**
 * Nombres de despliegue ("Puente Alto", no "puente-alto") de las comunas con
 * cobertura, ordenados alfabéticamente — para mensajes de UI que antes
 * hardcodeaban "Las Condes, Providencia, Vitacura y Ñuñoa" a mano y quedaban
 * desactualizados cada vez que se ampliaba la cobertura (pasó exactamente
 * eso el 31 jul 2026). Client-safe: solo lee COMUNAS_CHILE, sin service role.
 */
export function nombresComunasConCobertura(): string[] {
  return getComunasConCobertura()
    .map((c) => COMUNAS_CHILE.find((comuna) => comuna.id === c.comunaId)?.nombre ?? c.comunaId)
    .sort((a, b) => a.localeCompare(b, 'es'))
}
