// Circulares DDU — División de Desarrollo Urbano (DDU) del MINVU
// Base de conocimiento curada para el copiloto normativo de PermisoHub.
//
// ⚠️ POLÍTICA DE PRECISIÓN (producto legal) — LEER ANTES DE EDITAR:
// Las circulares DDU son oficios interpretativos que emite la División de
// Desarrollo Urbano del MINVU para fijar el sentido y alcance de la OGUC/LGUC.
// Existen cientos, con numeración correlativa que se actualiza en el tiempo.
//
// NO se inventan números de circular. Toda entrada con `verificado: true` tiene
// su número + materia confirmados contra el índice oficial de Circulares DDU
// del MINVU (o el PDF oficial de la circular) y una `fuente` que resuelve a
// minvu.gob.cl. Si se agrega una entrada sin poder verificarla, debe llevar
// `verificado: false`, numero '[VERIFICAR N° OFICIAL]' y fuente '' — el runtime
// (flagUnverifiedCita en lib/normativa-retrieval.ts) la marcará "por verificar".
//
// Índice maestro usado en la verificación de jul 2026 (DDU 7–506):
// https://www.minvu.gob.cl/wp-content/uploads/2019/06/Indice-Cir-Grales-hasta-la-506.pdf

export type CategoriaCircular =
  | 'interpretacion'
  | 'edificacion'
  | 'planificacion'
  | 'procedimiento'

export interface CircularDDU {
  id: string
  numero: string // ej: "DDU-ESP 091-07" — número oficial cuando verificado === true
  titulo: string
  texto: string
  keywords: string[]
  categoria: CategoriaCircular
  // URL oficial del PDF/página MINVU (fuente de verdad). '' si no hay.
  fuente: string
  // true = número + materia confirmados contra la fuente oficial MINVU.
  // false = scaffolding temático con número placeholder (no citar como oficial).
  verificado: boolean
}

export const CIRCULARES_DDU: CircularDDU[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // VERIFICADAS contra la fuente oficial MINVU (número + materia confirmados en
  // el índice de circulares DDU). El TEXTO completo está en el PDF de `fuente`;
  // aquí se guarda la materia oficial (MAT.) y los artículos que referencia.
  // Fuente índice: minvu.gob.cl → Circulares DDU → Modificaciones de Proyectos.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ddu-esp-091-07',
    numero: 'DDU-ESP 091-07',
    titulo:
      'Modificación de proyecto aprobado y cambio de profesional responsable, para obras menores',
    texto: `Materia oficial (MAT.): "Aplicación artículos 5.1.17, 5.1.20 OGUC — Modificación de proyecto aprobado y cambio de profesional responsable, para obras menores".

Relevancia: fija el procedimiento para modificar un permiso ya aprobado y para el cambio de arquitecto responsable en el contexto de OBRAS MENORES (Art. 5.1.2 y ss.). Directamente aplicable cuando un expediente pasó por varios arquitectos y se busca resolver por la vía de obra menor.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['modificación de proyecto', 'obras menores', 'cambio de profesional', 'arquitecto responsable', '5.1.17', '5.1.20', 'permiso aprobado', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-091-07.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-021-07',
    numero: 'DDU-ESP 021-07',
    titulo: 'Aplicación Art. 5.1.17 y 5.1.18 OGUC (modificación de proyecto)',
    texto: `Materia oficial (MAT.): "Aplicación artículos 5.1.17 y 5.1.18 de la OGUC" en relación a modificaciones de proyecto.

Relevancia: precisa cómo se tramita una modificación de proyecto y qué antecedentes exige, base para distinguir una modificación de una obra nueva/alteración mayor.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['modificación de proyecto', '5.1.17', '5.1.18', 'permiso', 'tramitación', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-021-07.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-021-10',
    numero: 'DDU-ESP 021-10',
    titulo:
      'Normas aplicables a un permiso en relación a un anteproyecto y a la modificación de proyecto',
    texto: `Materia oficial (MAT.): "Alcance de normas aplicables a un permiso en relación a un anteproyecto y a la modificación de proyecto".

Relevancia: define qué normativa rige (la del anteproyecto vs. la vigente) al pedir un permiso o una modificación — clave para expedientes antiguos que se retoman años después.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['anteproyecto', 'modificación de proyecto', 'norma aplicable', 'vigencia', 'permiso', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-021-10.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-035-09',
    numero: 'DDU-ESP 035-09',
    titulo: 'Modificación de proyecto sobre obra aprobada como "obra gruesa habitable"',
    texto: `Materia oficial (MAT.): "Aplicación de los artículos 5.1.17, 5.2.2 y 5.2.8 de la OGUC, en relación a los procedimientos para aprobar una modificación de proyecto cuando una obra ha sido aprobada como 'obra gruesa habitable'".

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['modificación de proyecto', 'obra gruesa habitable', '5.1.17', '5.2.2', '5.2.8', 'recepción', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-035-09.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-024-07',
    numero: 'DDU-ESP 024-07',
    titulo: 'Cobro de derechos municipales en modificaciones de proyectos',
    texto: `Materia oficial (MAT.): "Cobro de derechos municipales en modificaciones de proyectos".

Relevancia: cómo se calculan y cobran los derechos municipales al ingresar una modificación — relevante para estimar costo de la vía elegida.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['derechos municipales', 'modificación de proyecto', 'costo', 'cobro', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-024-07.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-084-07',
    numero: 'DDU-ESP 084-07',
    titulo: 'Normativa aplicable a los cambios de destino de una vivienda',
    texto: `Materia oficial (MAT.): "PERMISOS, APROBACIONES Y RECEPCIONES; EDIFICACIÓN; CAMBIO DE DESTINO. Normativa aplicable a los cambios de destino de una vivienda".

Relevancia: fija la normativa y el procedimiento para cambiar el destino de una vivienda (p. ej. a local comercial) — directamente aplicable al caso de una casa habilitada como comercio, para encaminarlo por cambio de destino en vez de un permiso de alteración.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['cambio de destino', 'vivienda', 'local comercial', 'destino', 'permiso', 'recepción', 'comercio', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-084-07.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-037-09',
    numero: 'DDU-ESP 037-09',
    titulo:
      'Cambios de destino con postergación de permisos vigente (Art. 117 LGUC)',
    texto: `Materia oficial (MAT.): "Procedencia de autorizar cambios de destino estando vigente una postergación de permisos conforme al artículo 117 de la LGUC".

Relevancia: aclara si procede un cambio de destino cuando la comuna tiene una postergación de permisos vigente — a verificar antes de comprometer la vía de cambio de destino en un sector con congelamiento.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['cambio de destino', 'postergación de permisos', 'artículo 117', 'LGUC', 'congelamiento', 'permiso', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/ddu-esp-037-09.pdf',
    verificado: true,
  },
  // ─────────────────────────────────────────────────────────────────────────
  // VERIFICADAS contra el índice oficial de Circulares Generales DDU del MINVU
  // (https://www.minvu.gob.cl/wp-content/uploads/2019/06/Indice-Cir-Grales-hasta-la-506.pdf)
  // y/o el PDF oficial de cada circular. Reemplazan al scaffolding temático
  // anterior (jul 2026): modificación de proyecto, rasantes/envolvente, carga
  // de ocupación y norma aplicable por fecha de ingreso.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ddu-328',
    numero: 'DDU 328',
    titulo: 'Modificación de proyectos: aplicación del inciso segundo del Art. 5.1.18 OGUC',
    texto: `Circular Ord. N° 0535 (26.12.2016). Materia oficial (MAT.): "Aplicación inciso segundo artículo 5.1.18. de la Ordenanza General de Urbanismo y Construcciones" — modificaciones de proyecto: condiciones bajo las cuales procede y cálculo del aumento de superficie edificada.

Relevancia: precisa cuándo una variante introducida a un proyecto con permiso vigente puede tramitarse como modificación de proyecto (Arts. 5.1.17 y 5.1.18 OGUC) en vez de exigir un nuevo permiso, y cómo se computa el aumento de superficie.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['modificación de proyecto', 'variante', 'permiso de modificación', '5.1.17', '5.1.18', 'aumento de superficie', 'interpretación', 'DDU'],
    categoria: 'interpretacion',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-328.pdf',
    verificado: true,
  },
  {
    id: 'ddu-319',
    numero: 'DDU 319',
    titulo: 'Variaciones menores entre permiso y recepción definitiva (Art. 5.2.8 OGUC)',
    texto: `Circular Ord. N° 0356 (17.08.2016). Materia oficial (MAT.): aplicación del artículo 5.2.8 de la OGUC — resolución aprobatoria de variaciones menores en forma simultánea a la recepción definitiva.

Relevancia: es la vía para regularizar ajustes menores detectados entre el permiso y la recepción definitiva sin tramitar un permiso de modificación completo; complementa los Arts. 5.1.17 y 5.1.18 OGUC.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['variaciones menores', 'recepción definitiva', '5.2.8', 'modificación de proyecto', 'ajuste menor', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-319.pdf',
    verificado: true,
  },
  {
    id: 'ddu-109',
    numero: 'DDU 109',
    titulo: 'Aplicación de rasantes (Art. 2.6.3 OGUC)',
    texto: `Circular Ord. N° 264 (12.07.2002). Materia oficial (MAT.): "Artículo 2.6.3. APLICACIÓN RASANTES."

Relevancia: fija cómo se levantan las rasantes — desde el nivel de suelo natural, en todos los puntos de los deslindes con predios vecinos y en el punto medio entre líneas oficiales del espacio público — incluyendo casos de áreas verdes, anchos mayores a 100 m y deslindes sin línea oficial opuesta (con figuras explicativas).

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['rasante', 'envolvente', '2.6.3', 'deslinde', 'nivel de suelo natural', 'altura', 'línea oficial', 'DDU'],
    categoria: 'edificacion',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/Cir109.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-080-07',
    numero: 'DDU-ESP 080-07',
    titulo: 'Rasantes y sombras: aplicación de los Arts. 2.6.3 y 2.6.11 OGUC',
    texto: `Materia oficial (MAT.): "Normas urbanísticas, rasantes (sombras). Aplicación Arts. 2.6.3 y 2.6.11 de la OGUC".

Relevancia: complementa la DDU 109 con el método de sombras proyectadas y la envolvente teórica del Art. 2.6.11 — el corpus DDU de rasantes gira en torno a los Arts. 2.6.3 y 2.6.11 a 2.6.16 OGUC.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['rasante', 'sombra', 'envolvente teórica', '2.6.3', '2.6.11', 'volumen teórico', 'DDU'],
    categoria: 'edificacion',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-080-07.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-013-08',
    numero: 'DDU-ESP 013-08',
    titulo: 'Carga de ocupación (tabla Art. 4.2.4 OGUC)',
    texto: `Circular Ord. N° 0456 (03.06.2008). Materia oficial (MAT.): "Carga de ocupación en locales con destino educacional."

Relevancia: define la carga de ocupación como la relación máxima de personas por m² según la tabla del Art. 4.2.4 OGUC, base para dimensionar vías de evacuación (Título 4), y resuelve el conflicto de aplicación entre los Arts. 4.2.4 y 4.5.6. El criterio de cálculo es extrapolable a otros destinos vía la misma tabla.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['carga de ocupación', 'evacuación', '4.2.4', 'destino', 'seguridad', 'personas por m²', 'DDU'],
    categoria: 'edificacion',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-013-08.pdf',
    verificado: true,
  },
  {
    id: 'ddu-esp-060-09',
    numero: 'DDU-ESP 060-09',
    titulo: 'Escaleras según carga de ocupación (Art. 4.2.10 OGUC)',
    texto: `Materia oficial (MAT.): "Cantidad y ancho mínimo de escaleras según carga de ocupación de superficie servida" (Art. 4.2.10 OGUC).

Relevancia: traduce la carga de ocupación en exigencias concretas de evacuación (número y ancho de escaleras); complementada por la DDU-ESP 033-10.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['escaleras', 'carga de ocupación', '4.2.10', 'evacuación', 'ancho mínimo', 'DDU'],
    categoria: 'edificacion',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-ESP-060-09.pdf',
    verificado: true,
  },
  {
    id: 'ddu-484',
    numero: 'DDU 484',
    titulo: 'Fecha de ingreso del expediente y norma aplicable (Arts. 1.1.3 y 1.4.2 OGUC)',
    texto: `Circular Ord. N° 252 (07.07.2023). Materia oficial (MAT.): "Fecha de ingreso de un expediente cuando se realiza por medios electrónicos, Artículos 1.1.3 y 1.4.2. de la Ordenanza General de Urbanismo y Construcciones."

Relevancia: precisa qué se entiende por "fecha de ingreso" para efectos del Art. 1.1.3 OGUC (las solicitudes se evalúan con las normas vigentes a esa fecha), incluida la presentación por medios electrónicos ante la DOM — clave para las reglas de transición cuando cambia la OGUC.

Texto completo en la fuente oficial MINVU (PDF).`,
    keywords: ['norma aplicable', 'fecha de ingreso', '1.1.3', '1.4.2', 'medios electrónicos', 'vigencia', 'transición', 'DDU'],
    categoria: 'procedimiento',
    fuente: 'https://www.minvu.gob.cl/wp-content/uploads/2019/06/DDU-484.pdf',
    verificado: true,
  },
]

// Recuperación por keyword matching (mismo patrón que oguc-knowledge)
// getCircularesRelevantes/getContextoCirculares se eliminaron el 05-08: eran
// un segundo camino para inyectar circulares DDU en los prompts, con ranking
// propio y su propia lógica de `verificado`, mientras getContextoNormativo()
// (lib/normativa-retrieval.ts) ya fusiona OGUC + LGUC + DDU con un ranking
// único y lo usan las rutas de IA. Dos formas de hacer lo mismo con criterios
// distintos es peor que una: la data (CIRCULARES_DDU) sigue exportada y en uso.
