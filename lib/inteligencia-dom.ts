/**
 * Inteligencia DOM — observation analytics per municipality.
 *
 * Data is synthetic and based on MINVU statistics, SEREMI reports, and
 * architectural practice knowledge. In production this table will be
 * populated by real user-reported observations (data flywheel).
 */

export interface ObservacionFrequente {
  tipo: string
  porcentaje: number
  articuloOguc?: string
  descripcion: string
}

export interface AlertaMunicipio {
  nivel: 'info' | 'warning' | 'danger'
  texto: string
}

export interface SeccionalPRC {
  codigo: string
  nombre: string
  descripcion: string
  notaPatrimonio?: string
  urlPlano?: string
}

export interface PlanReguladorInfo {
  urlPRC: string
  ultimaModificacion?: string
  notaGeneral?: string
  seccionales?: SeccionalPRC[]
  zonasTipicas?: string[]
  requiereConsejMonumentos?: boolean
}

export interface InteligenciaMunicipio {
  nombre: string
  tasaObservaciones: number      // % proyectos que reciben ≥1 observación
  promedioObservaciones: number  // obs promedio por expediente con obs
  tiempoRespuestaPromedio: number // días hábiles hasta primera respuesta DOM
  tiempoAprobacionPromedio: number // días hábiles hasta aprobación final
  totalExpedientesBase: number   // base de datos (para transparencia)
  observacionesFrecuentes: ObservacionFrequente[]
  alertas: AlertaMunicipio[]
  consejos: string[]
  ultimaActualizacion: string
  planRegulador?: PlanReguladorInfo
}

const BASE: InteligenciaMunicipio[] = [
  {
    nombre: 'Santiago',
    tasaObservaciones: 68,
    promedioObservaciones: 2.4,
    tiempoRespuestaPromedio: 35,
    tiempoAprobacionPromedio: 62,
    totalExpedientesBase: 892,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Memoria descriptiva', porcentaje: 41, descripcion: 'Superficies desagregadas por uso incompletas o inconsistentes con planimetría.', articuloOguc: 'Art. 5.1.6' },
      { tipo: 'Rasantes y distanciamientos', porcentaje: 34, descripcion: 'Plano de emplazamiento sin rasantes indicadas según la topografía del terreno.', articuloOguc: 'Art. 2.6.3' },
      { tipo: 'Accesibilidad universal', porcentaje: 29, descripcion: 'Pendientes, anchos de circulación o símbolos de discapacidad incorrectos.', articuloOguc: 'Art. 4.1.7' },
      { tipo: 'Certificado DOM línea de edificación', porcentaje: 22, descripcion: 'Certificado vencido (validez 6 meses) o con datos inconsistentes.', articuloOguc: 'Art. 5.1.4' },
      { tipo: 'Plano de estructura', porcentaje: 18, descripcion: 'Firma de calculista no registrada en Minvu o cálculo sin sellos.', articuloOguc: 'Art. 5.1.6' },
    ],
    alertas: [
      { nivel: 'warning', texto: 'Alto volumen de ingresos — coordinar hora previa en DOM.' },
      { nivel: 'info', texto: 'Acepta ingreso digital vía correo coordinado.' },
    ],
    consejos: [
      'Solicitar el "pre-ingreso" para detectar observaciones antes del ingreso formal.',
      'La memoria debe incluir cuadro de superficies con uso, piso y m² para cada recinto.',
      'Indicar explícitamente en portada del expediente el artículo OGUC que respalda el tipo de proyecto.',
    ],
  },
  {
    nombre: 'Providencia',
    tasaObservaciones: 42,
    promedioObservaciones: 1.6,
    tiempoRespuestaPromedio: 22,
    tiempoAprobacionPromedio: 38,
    totalExpedientesBase: 634,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Plano de emplazamiento', porcentaje: 31, descripcion: 'Indicación de predios vecinos, deslindes y distancias incompletas.', articuloOguc: 'Art. 5.1.6' },
      { tipo: 'Resolución SII', porcentaje: 24, descripcion: 'Rol de avalúo no coincide con el dominio vigente en CBR.' },
      { tipo: 'Informe de estructura', porcentaje: 19, descripcion: 'Memoria de cálculo no acompañada en proyectos sobre 2 pisos.' },
      { tipo: 'Plan regulador', porcentaje: 15, descripcion: 'Uso de suelo solicitado no coincide con zonificación PRMS vigente.' },
      { tipo: 'Accesibilidad', porcentaje: 11, descripcion: 'Baños para discapacitados sin dimensiones reglamentarias.' },
    ],
    alertas: [
      { nivel: 'info', texto: 'Plataforma SmartCity Providencia permite seguimiento online en tiempo real.' },
      { nivel: 'info', texto: 'DOM responde dentro de 22 días hábiles promedio — mejor resultado de la RM.' },
      { nivel: 'warning', texto: 'Zonas Típicas en Providencia requieren visación del Consejo de Monumentos Nacionales antes del ingreso DOM.' },
    ],
    consejos: [
      'Adjuntar "verificación de zonificación" del DOM antes de elaborar el proyecto para evitar obs de uso de suelo.',
      'Providencia exige carátula de expediente con todos los datos del propietario y arquitecto.',
      'Para proyectos en barrios patrimoniales (Ej: Bellavista, Villa Frei), solicitar normas seccionales antes de diseñar.',
      'En Zonas de Conservación Histórica, el CMN puede exigir plano de detalle del conjunto; verificar el seccional específico del barrio.',
    ],
    planRegulador: {
      urlPRC: 'https://providencia.cl/provi/municipalidad/servicios/plan-regulador-comunal/plan-regulador-comunal-providencia',
      ultimaModificacion: '2025',
      notaGeneral: 'Providencia tiene un PRC detallado con múltiples seccionales por barrio. La zonificación base y los seccionales son documentos distintos — un predio puede estar afecto a ambos simultáneamente.',
      zonasTipicas: [
        'ZCH-01 Barrio Italia (Av. Italia / Condell)',
        'ZCH-02 Villa Frei',
        'ZCH-03 Barrio Bellavista',
        'ZCH-04 Población Salvador - Legión Militar de Chile',
      ],
      requiereConsejMonumentos: true,
      seccionales: [
        {
          codigo: 'ZCH-04',
          nombre: 'Población Salvador - Legión Militar de Chile',
          descripcion: 'Barrio residencial de valor patrimonial. Normas de intervención estrictas: altura máxima 2 pisos, materialidad coherente con el conjunto original, ventanas y muros bajo regulación.',
          notaPatrimonio: 'Requiere aprobación del Consejo de Monumentos Nacionales. El proyecto debe adjuntar plano de detalle del seccional y fotografías del estado actual.',
          urlPlano: 'https://providencia.cl/provi/site/docs/20260105/20260105112840/prcp_plano_de_detalle_n_1_zch_04_poblacion_salvador_legion_militar_de_chile__3_.pdf',
        },
        {
          codigo: 'ZCH-03',
          nombre: 'Barrio Bellavista',
          descripcion: 'Zona mixta residencial-comercial con fuerte valor patrimonial. Altura máxima regulada por el seccional. Actividades de entretención solo en primer piso hacia la calle.',
          notaPatrimonio: 'Zona Típica declarada — toda intervención exterior requiere visación CMN.',
        },
        {
          codigo: 'ZCH-01',
          nombre: 'Barrio Italia (Av. Italia / Condell)',
          descripcion: 'Eje comercial patrimonial con normas de imagen urbana específicas. Fachadas continuas, alturas reguladas, uso comercial en planta baja permitido.',
        },
        {
          codigo: 'ZCH-02',
          nombre: 'Villa Frei',
          descripcion: 'Conjunto residencial moderno de valor patrimonial. Restricciones a modificaciones de fachada y división de predios.',
        },
      ],
    },
  },
  {
    nombre: 'Las Condes',
    tasaObservaciones: 55,
    promedioObservaciones: 2.1,
    tiempoRespuestaPromedio: 28,
    tiempoAprobacionPromedio: 48,
    totalExpedientesBase: 741,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Plano de instalaciones', porcentaje: 38, descripcion: 'Instalaciones eléctricas y sanitarias deben incluirse para proyectos comerciales sobre 150 m².', articuloOguc: 'Art. 5.1.6' },
      { tipo: 'Registro Minvu arquitecto', porcentaje: 29, descripcion: 'Firma no coincide con registro Minvu actualizado o datos de colegiatura.' },
      { tipo: 'Estudio de impacto vial', porcentaje: 21, descripcion: 'EIV requerido para comercio sobre 1.000 m² o > 100 estacionamientos.' },
      { tipo: 'Superficie de estacionamientos', porcentaje: 18, descripcion: 'Relación uso/estacionamiento no cumple tabla PRMS (Art. 2.2.2 OGUC).' },
      { tipo: 'Cuadro de cabida', porcentaje: 14, descripcion: 'Cuadro no refleja todas las alturas libres y CTB.' },
    ],
    alertas: [
      { nivel: 'warning', texto: 'Exige expediente físico impreso + digital simultáneamente.' },
      { nivel: 'danger', texto: 'Proyectos > 5.000 m² requieren aprobación SEREMI adicional.' },
    ],
    consejos: [
      'Llevar expediente completo desde el primer ingreso — Las Condes no acepta ingresos por partes.',
      'La fotocopia del título del arquitecto debe ser notariada.',
    ],
    planRegulador: {
      urlPRC: 'https://www.lascondes.cl/tramites/obras-municipales/',
      ultimaModificacion: '2024',
      notaGeneral: 'El PRC de Las Condes define zonas residenciales exclusivas (ZR), mixtas (ZM) y de equipamiento. La zonificación determina la relación entre rasante, CUS y CUT. Es esencial verificar el plano de zonificación vigente antes de cualquier anteproyecto.',
      seccionales: [
        {
          codigo: 'ZR1-A',
          nombre: 'Zona Residencial Exclusiva Baja Densidad',
          descripcion: 'Subdivisión mínima 1.000 m², CUS 0.3, altura máxima 2 pisos o 8 m. Solo uso habitacional. No se permiten actividades comerciales ni equipamiento.',
        },
        {
          codigo: 'ZM-3',
          nombre: 'Zona Mixta Comercial-Residencial',
          descripcion: 'Permite comercio, oficinas y vivienda en altura. CUS hasta 3.0 con coeficiente de constructibilidad variable. Estudio de impacto vial requerido sobre 1.000 m².',
        },
        {
          codigo: 'ZE-1',
          nombre: 'Zona de Equipamiento',
          descripcion: 'Escuelas, clínicas, centros comerciales. Puede requerir aprobación SEREMI para proyectos sobre 5.000 m².',
        },
      ],
    },
  },
  {
    nombre: 'Vitacura',
    tasaObservaciones: 38,
    promedioObservaciones: 1.5,
    tiempoRespuestaPromedio: 26,
    tiempoAprobacionPromedio: 35,
    totalExpedientesBase: 312,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Plan Regulador Comunal', porcentaje: 44, descripcion: 'PRC de Vitacura tiene zonificación específica muy detallada — verificar uso antes de diseñar.', articuloOguc: 'Art. 2.1.10' },
      { tipo: 'Imagen urbana', porcentaje: 28, descripcion: 'Vitacura exige materiales de fachada acordes a la normativa de imagen urbana comunal.' },
      { tipo: 'Arborización', porcentaje: 19, descripcion: 'Plan de arborización requerido para proyectos que afecten veredas o jardineras.' },
      { tipo: 'Certificado informaciones previas', porcentaje: 16, descripcion: 'CIP debe ser solicitado con al menos 30 días de anticipación al ingreso.' },
      { tipo: 'Accesibilidad', porcentaje: 10, descripcion: 'Rampas y pavimentos podotáctiles exigidos en todas las veredas.' },
    ],
    alertas: [
      { nivel: 'info', texto: 'DOM Vitacura es uno de los más eficientes de la RM — tiempos bajo promedio.' },
    ],
    consejos: [
      'Verificar zonificación y altura máxima en el Plan Regulador antes de iniciar el anteproyecto.',
      'La imagen urbana es revisada en paralelo por la Unidad de Obras — coordinar desde el diseño.',
    ],
    planRegulador: {
      urlPRC: 'https://vitacura.cl/municipalidad/planificacion-urbana/plan-regulador-comunal/que-es-el-plan-regulador-comunal',
      ultimaModificacion: '2025',
      notaGeneral: 'El PRC de Vitacura es uno de los más detallados de la RM. Regula imagen urbana, arborización, y materialidad de fachadas además de los índices urbanísticos habituales. La Unidad de Urbanismo puede solicitar correcciones de diseño aunque los índices sean correctos.',
      seccionales: [
        {
          codigo: 'ZR-BU',
          nombre: 'Zona Residencial Baja Densidad Unifamiliar',
          descripcion: 'Viviendas unifamiliares en predios de 1.000 m² mínimo. Altura máxima 2 pisos. CUS 0.4. Antejardín obligatorio mínimo 5 m. Materialidad de fachada regulada por Ordenanza de Imagen Urbana.',
        },
        {
          codigo: 'ZCE',
          nombre: 'Zona Comercial Exclusiva (Av. Vitacura)',
          descripcion: 'Eje comercial principal. CUS hasta 2.5. Uso comercial en planta baja obligatorio. Diseño de fachada debe integrar criterios de la Guía de Imagen Urbana comunal.',
        },
      ],
    },
  },
  {
    nombre: 'Ñuñoa',
    tasaObservaciones: 58,
    promedioObservaciones: 2.0,
    tiempoRespuestaPromedio: 32,
    tiempoAprobacionPromedio: 55,
    totalExpedientesBase: 487,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Certificado informaciones previas', porcentaje: 36, descripcion: 'CIP desactualizado (más de 6 meses) o sin la información de afectaciones.' },
      { tipo: 'Memoria descriptiva', porcentaje: 31, descripcion: 'Cuadro resumen de normativa aplicada incompleto.' },
      { tipo: 'Plano de evacuación', porcentaje: 25, descripcion: 'Requerido para locales con > 50 personas simultáneas.' },
      { tipo: 'Plano de estructura', porcentaje: 19, descripcion: 'Requiere cálculo sísmico adicional para zona IIa.' },
      { tipo: 'Proyecto sanitario', porcentaje: 14, descripcion: 'Proyecto sanitario con timbre ESSAL o ESSBIO requerido.' },
    ],
    alertas: [
      { nivel: 'warning', texto: 'Atención presencial solo con hora previa — reservar con 5 días hábiles de anticipación.' },
      { nivel: 'warning', texto: 'Zonas Típicas en Villa Olímpica y barrios históricos requieren visación CMN antes del ingreso DOM.' },
    ],
    consejos: [
      'Ñuñoa tiene zonas de conservación histórica — verificar si el predio está afecto antes de iniciar.',
      'El CIP debe ser solicitado con 45 días mínimos de anticipación dado el alto volumen de solicitudes.',
    ],
    planRegulador: {
      urlPRC: 'https://www.nunoa.cl/municipalidad/plan-regulador-comunal',
      ultimaModificacion: '2024',
      notaGeneral: 'El PRC de Ñuñoa tiene varias modificaciones vigentes que definen distintas zonas de densificación y conservación. Varios barrios están en proceso de Zona Típica o ya la tienen declarada. La coexistencia de zonas de densificación y conservación hace fundamental verificar la zonificación exacta del predio.',
      zonasTipicas: [
        'Barrio Olímpico (Villa Olímpica) — Zona Típica declarada CMN',
        'Barrio Irarrázaval — en proceso de declaración',
      ],
      requiereConsejMonumentos: true,
      seccionales: [
        {
          codigo: 'ZC-1',
          nombre: 'Zona de Conservación Histórica Barrio Olímpico',
          descripcion: 'Conjunto residencial de 1936 con valor patrimonial. Toda intervención en fachadas, cubiertas o elementos originales requiere visación del CMN. Altura máxima 2 pisos. Prohibida la demolición sin autorización.',
          notaPatrimonio: 'Zona Típica vigente. Requiere informe de arqueología urbana para intervenciones que impliquen movimiento de tierra.',
        },
        {
          codigo: 'ZR-3',
          nombre: 'Zona Residencial Media Densidad',
          descripcion: 'Permite vivienda colectiva hasta 5 pisos. CUS 1.5. Antejardín mínimo 3 m. Aplica restricción de horario de obras y gestión de áridos.',
        },
      ],
    },
  },
  {
    nombre: 'Maipú',
    tasaObservaciones: 63,
    promedioObservaciones: 2.6,
    tiempoRespuestaPromedio: 42,
    tiempoAprobacionPromedio: 68,
    totalExpedientesBase: 1124,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Cuadro de superficies', porcentaje: 45, descripcion: 'Maipú exige cuadro con columnas: piso, uso, superficie útil, circulaciones, total.', articuloOguc: 'Art. 5.1.6' },
      { tipo: 'Certificado de factibilidad agua potable', porcentaje: 38, descripcion: 'Empresa sanitaria: Aguas Andinas — tramitar por separado antes del ingreso DOM.' },
      { tipo: 'Estudio de suelo', porcentaje: 22, descripcion: 'Requerido para terrenos en zonas ZH-3 o con rellenos históricos.' },
      { tipo: 'Póliza de seguro', porcentaje: 19, descripcion: 'Seguro de obra exigido para obras > 500 UF.' },
      { tipo: 'Accesibilidad', porcentaje: 17, descripcion: 'Pendiente máxima de rampas 8% en accesos principales.' },
    ],
    alertas: [
      { nivel: 'warning', texto: 'Alto volumen de ingresos — esperar confirmación del DOM en 5-7 días hábiles.' },
      { nivel: 'danger', texto: 'Maipú tiene zonas de riesgo de inundación — verificar con SIG antes de comprometerse con el proyecto.' },
    ],
    consejos: [
      'El certificado de factibilidad puede demorar 15 días hábiles — solicitar en paralelo con el proyecto.',
      'Maipú ofrece "Pre-revisión" previa al ingreso para proyectos complejos — muy recomendable.',
    ],
  },
  {
    nombre: 'San Miguel',
    tasaObservaciones: 56,
    promedioObservaciones: 2.2,
    tiempoRespuestaPromedio: 38,
    tiempoAprobacionPromedio: 60,
    totalExpedientesBase: 341,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Zonificación uso de suelo', porcentaje: 40, descripcion: 'Verificar en PRC San Miguel que el local comercial esté en zona compatible.', articuloOguc: 'Art. 2.1.10' },
      { tipo: 'Planos de instalaciones', porcentaje: 30, descripcion: 'Gas, eléctrico y sanitario deben entregarse firmados por el especialista.' },
      { tipo: 'Certificado DOM', porcentaje: 22, descripcion: 'CIP con menos de 6 meses de vigencia al momento del ingreso.' },
      { tipo: 'Memoria descriptiva', porcentaje: 17, descripcion: 'Falta justificación del cálculo de ocupación y aforo.' },
      { tipo: 'Plano de ubicación', porcentaje: 14, descripcion: 'Plano satelital o de referencia exigido para localizar el predio.' },
    ],
    alertas: [
      { nivel: 'info', texto: 'San Miguel acepta expediente digital completo vía correo electrónico para revisión previa.' },
    ],
    consejos: [
      'Verificar la zonificación en el PRC — San Miguel tiene zonas de transición donde no todos los usos están permitidos.',
    ],
  },
  {
    nombre: 'Pudahuel',
    tasaObservaciones: 71,
    promedioObservaciones: 2.9,
    tiempoRespuestaPromedio: 48,
    tiempoAprobacionPromedio: 75,
    totalExpedientesBase: 456,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Certificados de factibilidad', porcentaje: 52, descripcion: 'Factibilidad agua potable y alcantarillado (Aguas Andinas) puede demorar 15-20 días hábiles.'},
      { tipo: 'Cuadro de superficie', porcentaje: 41, descripcion: 'Inconsistencias entre planimetría y cuadro de superficies presentadas.' },
      { tipo: 'Estudio de suelo', porcentaje: 29, descripcion: 'Zonas de relleno en Pudahuel requieren estudio geotécnico certificado.' },
      { tipo: 'Plano estructura', porcentaje: 22, descripcion: 'Calculista debe tener registro Minvu vigente.' },
      { tipo: 'Plano eléctrico', porcentaje: 18, descripcion: 'Instalador eléctrico con inscripción SEC requerido en el expediente.' },
    ],
    alertas: [
      { nivel: 'danger', texto: 'Pudahuel tiene zonas inundables y rellenos históricos — el estudio de suelo es crítico.' },
      { nivel: 'warning', texto: 'Plazos más largos que el promedio RM — planificar con 20% más de tiempo.' },
    ],
    consejos: [
      'Iniciar factibilidad con Aguas Andinas 30 días antes del ingreso DOM.',
      'Solicitar CIP con especial atención a "afectaciones" — Pudahuel tiene varios pasos de infraestructura proyectada.',
    ],
  },
  {
    nombre: 'La Florida',
    tasaObservaciones: 60,
    promedioObservaciones: 2.3,
    tiempoRespuestaPromedio: 40,
    tiempoAprobacionPromedio: 64,
    totalExpedientesBase: 782,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Estacionamientos', porcentaje: 44, descripcion: 'La Florida exige verificar dotación de estacionamientos según el uso (Art. 2.2.2 OGUC y tabla PRMS).', articuloOguc: 'Art. 2.2.2' },
      { tipo: 'Áreas verdes', porcentaje: 33, descripcion: 'Proyectos habitacionales deben incluir cesión de áreas verdes según Art. 2.2.5 OGUC.' },
      { tipo: 'Accesibilidad universal', porcentaje: 28, descripcion: 'Rampas y superficie podotáctil obligatorias — verificar norma NCh 3269.' },
      { tipo: 'Memoria técnica', porcentaje: 21, descripcion: 'Descripción del sistema constructivo incompleta para obras sobre 3 pisos.' },
      { tipo: 'Instalaciones sanitarias', porcentaje: 16, descripcion: 'Proyecto sanitario aprobado por Aguas Andinas previo al ingreso DOM.' },
    ],
    alertas: [
      { nivel: 'warning', texto: 'Alta demanda residencial — tiempos extendidos en períodos oct-dic.' },
      { nivel: 'info', texto: 'DOM La Florida en Línea permite adjuntar documentos digitalmente.' },
    ],
    consejos: [
      'La dotación de estacionamientos debe calcularse para el uso más restrictivo cuando hay usos mixtos.',
      'Solicitar la "Planilla de Aportes" al inicio — la cifra varía mucho según el proyecto.',
    ],
  },
  {
    nombre: 'Rancagua',
    tasaObservaciones: 52,
    promedioObservaciones: 2.0,
    tiempoRespuestaPromedio: 36,
    tiempoAprobacionPromedio: 58,
    totalExpedientesBase: 298,
    ultimaActualizacion: '2026-05',
    observacionesFrecuentes: [
      { tipo: 'Certificado SEREMI', porcentaje: 35, descripcion: 'Proyectos de salud o educación requieren visado SEREMI Salud / Educación.' },
      { tipo: 'Memoria descriptiva', porcentaje: 28, descripcion: 'Cuadro normativo con referencia explícita al PRC de Rancagua.' },
      { tipo: 'Plano de emplazamiento', porcentaje: 22, descripcion: 'Orientación norte, escala gráfica y cuadro de deslindes completo.' },
      { tipo: 'Certificado de factibilidad', porcentaje: 18, descripcion: 'Empresa sanitaria: ESSBIO — trámite puede demorar 20 días hábiles.' },
      { tipo: 'Registro arqueológico', porcentaje: 12, descripcion: 'Algunos predios en el casco histórico requieren informe arqueológico previo.' },
    ],
    alertas: [
      { nivel: 'info', texto: 'Capital regional O\'Higgins — coordinar con SEREMI cuando el proyecto requiera visado sectorial.' },
    ],
    consejos: [
      'Verificar si el predio está en zona de protección patrimonial antes del diseño.',
      'El Consejo de Monumentos Nacionales debe ser notificado para proyectos en radio de 500 m de monumentos históricos.',
    ],
  },
]

const MAP = new Map(BASE.map((m) => [m.nombre.toLowerCase(), m]))

export function getInteligenciaMunicipio(nombre: string): InteligenciaMunicipio | null {
  return MAP.get(nombre.toLowerCase()) ?? null
}

export function getAllMunicipiosConInteligencia(): string[] {
  return BASE.map((m) => m.nombre)
}

export type { InteligenciaMunicipio as default }
