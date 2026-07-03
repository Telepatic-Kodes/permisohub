// Circulares DDU — División de Desarrollo Urbano (DDU) del MINVU
// Base de conocimiento curada para el copiloto normativo de PermisoHub.
//
// ⚠️ POLÍTICA DE PRECISIÓN (producto legal) — LEER ANTES DE EDITAR:
// Las circulares DDU son oficios interpretativos que emite la División de
// Desarrollo Urbano del MINVU para fijar el sentido y alcance de la OGUC/LGUC.
// Existen cientos, con numeración correlativa que se actualiza en el tiempo.
//
// NO se inventan números de circular. Como el mapeo exacto "número ↔ contenido
// ↔ fecha" NO está verificado contra la fuente oficial del MINVU, TODAS las
// entradas de este archivo:
//   - describen TEMAS de interpretación de amplio conocimiento (correctos en
//     cuanto a materia), y
//   - llevan el número marcado como "[VERIFICAR N° OFICIAL]" y el texto con
//     [VERIFICAR TEXTO OFICIAL], hasta contrastarlos con el buscador oficial de
//     circulares DDU del MINVU (www.minvu.gob.cl / DDU).
//
// Esto entrega scaffolding + contenido temático útil SIN afirmar números o
// textos que no se pueden verificar aquí. Reemplazar los marcadores por los
// datos oficiales antes de usar estas referencias en asesoría vinculante.

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
  // NO VERIFICADAS: scaffolding temático con número placeholder. Aportan materia
  // pero NO deben citarse con número oficial hasta reemplazar por datos MINVU.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'ddu-modificacion-proyecto',
    numero: '[VERIFICAR N° OFICIAL]',
    titulo: 'Alcance de "Modificación de Proyecto"',
    texto: `Tema de interpretación de amplio conocimiento: la DDU ha precisado, mediante circular, el alcance del concepto de "Modificación de Proyecto" y cuándo una variante introducida entre el permiso y la recepción definitiva requiere un permiso de modificación, distinguiéndola de los ajustes menores que no lo requieren.

Relación normativa: se vincula con la definición de "Modificación de proyecto" de la OGUC (vigente desde 25.04.2026 por D.S. N°10, D.O. 23.02.2026) y con el Art. 5.1.15 OGUC.

[VERIFICAR TEXTO OFICIAL] y [VERIFICAR N° OFICIAL] — Confirmar el número, fecha y texto de la circular DDU aplicable en el buscador oficial del MINVU antes de citarla.`,
    keywords: ['modificación de proyecto', 'variante', 'permiso de modificación', 'interpretación', 'DDU', 'ajuste menor'],
    categoria: 'interpretacion',
    fuente: '',
    verificado: false,
  },
  {
    id: 'ddu-rasantes-envolvente',
    numero: '[VERIFICAR N° OFICIAL]',
    titulo: 'Aplicación de rasantes y envolvente teórica',
    texto: `Tema de interpretación de amplio conocimiento: la DDU ha emitido circulares que precisan la forma de aplicar las rasantes y de construir la envolvente teórica de un proyecto, incluyendo la medición desde el nivel del terreno, el tratamiento de deslindes con espacio público y privado, y casos de terrenos en pendiente.

Relación normativa: complementa los Arts. 2.6.3 (rasantes y alturas) y 2.6.6 (distanciamientos) de la OGUC.

[VERIFICAR TEXTO OFICIAL] y [VERIFICAR N° OFICIAL] — Confirmar número, fecha y texto contra la fuente oficial del MINVU antes de usarla en una observación o defensa técnica.`,
    keywords: ['rasante', 'envolvente', 'sombra', 'deslinde', 'pendiente', 'altura', 'interpretación', 'DDU'],
    categoria: 'edificacion',
    fuente: '',
    verificado: false,
  },
  {
    id: 'ddu-carga-ocupacion',
    numero: '[VERIFICAR N° OFICIAL]',
    titulo: 'Cálculo de la carga de ocupación',
    texto: `Tema de interpretación de amplio conocimiento: la DDU ha precisado, mediante circular, criterios para el cálculo de la carga de ocupación de las edificaciones (número de personas por recinto según destino), dato clave para dimensionar vías de evacuación, servicios higiénicos, ascensores y exigencias de accesibilidad y seguridad contra incendio.

Relación normativa: se aplica junto a las tablas de carga de ocupación de la OGUC (Título 4, condiciones de seguridad contra incendio y de habitabilidad).

[VERIFICAR TEXTO OFICIAL] y [VERIFICAR N° OFICIAL] — Confirmar número, fecha y texto contra la fuente oficial del MINVU.`,
    keywords: ['carga de ocupación', 'evacuación', 'destino', 'seguridad', 'incendio', 'accesibilidad', 'interpretación', 'DDU'],
    categoria: 'edificacion',
    fuente: '',
    verificado: false,
  },
  {
    id: 'ddu-norma-aplicable',
    numero: '[VERIFICAR N° OFICIAL]',
    titulo: 'Norma aplicable según fecha de ingreso de la solicitud',
    texto: `Tema de interpretación de amplio conocimiento: la DDU ha reiterado, mediante circulares, el criterio de que las solicitudes de permisos se evalúan conforme a las normas vigentes a la fecha de su ingreso a la Dirección de Obras Municipales, entregando reglas de transición cuando una modificación de la OGUC entra en vigencia.

Relación normativa: desarrolla y complementa el Art. 1.1.3 OGUC (norma aplicable = vigente a la fecha de ingreso).

[VERIFICAR TEXTO OFICIAL] y [VERIFICAR N° OFICIAL] — Confirmar número, fecha y texto contra la fuente oficial del MINVU antes de citarla.`,
    keywords: ['norma aplicable', 'fecha de ingreso', 'vigencia', 'transición', 'derecho intertemporal', 'interpretación', 'DDU'],
    categoria: 'procedimiento',
    fuente: '',
    verificado: false,
  },
]

// Recuperación por keyword matching (mismo patrón que oguc-knowledge)
export function getCircularesRelevantes(query: string, limit = 3): CircularDDU[] {
  const q = query.toLowerCase()

  const scored = CIRCULARES_DDU.map((circ) => {
    let score = 0
    for (const kw of circ.keywords) {
      if (q.includes(kw.toLowerCase())) score += 3
    }
    if (q.includes(circ.titulo.toLowerCase())) score += 5
    if (q.includes(circ.categoria)) score += 2
    for (const kw of circ.keywords) {
      if (kw.toLowerCase().includes(q.slice(0, 5))) score += 1
    }
    return { circ, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.circ)
}

export function getContextoCirculares(query: string): string {
  const circulares = getCircularesRelevantes(query)
  if (circulares.length === 0) return ''
  return circulares
    .map((c) => {
      const num = c.verificado ? c.numero : `${c.numero} [n° por verificar]`
      const fuente = c.verificado && c.fuente ? `\nFuente oficial: ${c.fuente}` : ''
      return `**Circular ${num} — ${c.titulo}**\n${c.texto}${fuente}`
    })
    .join('\n\n---\n\n')
}
