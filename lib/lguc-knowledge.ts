// LGUC — Ley General de Urbanismo y Construcciones (DFL N°458 de 1975, MINVU)
// Base de conocimiento curada para el copiloto normativo de PermisoHub.
//
// POLÍTICA DE PRECISIÓN (producto legal):
// - Los textos de los artículos aquí incluidos son RESÚMENES técnicos de alto
//   nivel del contenido de cada artículo, NO transcripciones literales.
// - Donde el texto exacto, un número o un plazo tienen peso legal y no está
//   verificado contra el DFL 458 oficial, se marca con [VERIFICAR TEXTO OFICIAL].
// - No se inventan números de artículo. Se prioriza un set reducido de
//   artículos de amplio consenso sobre una cobertura extensa pero dudosa.
//
// Interface compatible con ArticuloOGUC (misma forma: id, titulo, texto,
// keywords, categoria) para reutilizar la recuperación por keywords.

export type CategoriaLGUC =
  | 'disposiciones-generales'
  | 'profesionales'
  | 'responsabilidad'
  | 'permisos'
  | 'recepciones'
  | 'sanciones'

export interface ArticuloLGUC {
  id: string
  titulo: string
  texto: string
  keywords: string[]
  categoria: CategoriaLGUC
}

export const ARTICULOS_LGUC: ArticuloLGUC[] = [
  {
    id: '1',
    titulo: 'Ámbito de aplicación de la LGUC',
    texto: `La Ley General de Urbanismo y Construcciones (DFL N°458 de 1975) contiene los principios, atribuciones, potestades, facultades, responsabilidades, derechos, sanciones y demás normas que rigen a los organismos, funcionarios, profesionales y particulares en las acciones de planificación urbana, urbanización y construcción.

Es la norma de rango legal que da sustento a toda la regulación urbanística y de edificación en Chile. La OGUC (D.S. N°47/1992) es su reglamento y desarrolla en detalle sus disposiciones.`,
    keywords: ['LGUC', 'DFL 458', 'ámbito', 'planificación urbana', 'urbanización', 'construcción', 'ley general'],
    categoria: 'disposiciones-generales',
  },
  {
    id: '2',
    titulo: 'Composición de la normativa: Ley, Ordenanza General y Normas Técnicas',
    texto: `La legislación urbanística chilena se estructura en tres niveles jerárquicos:

1. LA LEY GENERAL (LGUC, DFL N°458/1975): contiene los principios, atribuciones, potestades, facultades, responsabilidades, derechos, sanciones y demás normas que rigen la materia.

2. LA ORDENANZA GENERAL (OGUC, D.S. N°47/1992): contiene las disposiciones reglamentarias de la ley y regula el procedimiento administrativo, el proceso de planificación urbana, urbanización y construcción, y los estándares técnicos exigibles.

3. LAS NORMAS TÉCNICAS: contienen y definen las características técnicas de los proyectos, materiales y sistemas de construcción y urbanización, de acuerdo a los requisitos de obligatoriedad que establezca la Ordenanza General.

IMPLICANCIA PRÁCTICA: al citar una obligación, conviene identificar en qué nivel está regulada (ley vs. ordenanza vs. norma técnica), porque de ello depende su fuerza y su forma de modificación.`,
    keywords: ['jerarquía', 'ordenanza general', 'normas técnicas', 'ley', 'OGUC', 'reglamento', 'composición'],
    categoria: 'disposiciones-generales',
  },
  {
    id: '17',
    titulo: 'Profesionales competentes',
    texto: `La LGUC define quiénes son los profesionales competentes para actuar en los proyectos y obras regidos por esta ley, según su título y especialidad (arquitecto, ingeniero civil, ingeniero constructor, constructor civil, entre otros), y el tipo de intervención que cada uno puede firmar (proyecto de arquitectura, cálculo estructural, especialidades, ejecución de la obra).

Solo profesionales competentes, habilitados conforme a la ley, pueden asumir la calidad de proyectista, calculista, constructor o inspector técnico de obra según corresponda.

[VERIFICAR TEXTO OFICIAL] — La enumeración exacta de títulos y las atribuciones específicas de cada profesional deben confirmarse contra el texto vigente del Art. 17 de la LGUC.`,
    keywords: ['profesionales competentes', 'arquitecto', 'ingeniero civil', 'calculista', 'constructor', 'proyectista', 'habilitación'],
    categoria: 'profesionales',
  },
  {
    id: '18',
    titulo: 'Responsabilidad por fallas o defectos y plazos de prescripción',
    texto: `El propietario primer vendedor de una construcción es responsable por todos los daños y perjuicios que provengan de fallas o defectos en ella, sea durante su ejecución o después de terminada, sin perjuicio de su derecho a repetir en contra de quienes sean responsables de las fallas o defectos que hayan dado origen a los daños.

Cadena de responsabilidad:
- Los PROYECTISTAS son responsables por los errores en que hayan incurrido, si de ellos se han derivado daños o perjuicios.
- El CONSTRUCTOR es responsable por las fallas, errores o defectos en la construcción, incluyendo las obras ejecutadas por subcontratistas y el uso de materiales o insumos defectuosos.
- El propietario primer vendedor está obligado a incluir en la escritura de compraventa una nómina que contenga la individualización de los profesionales y constructores.

PLAZOS DE PRESCRIPCIÓN (se cuentan desde la recepción definitiva de la obra por parte de la Dirección de Obras Municipales):
- 10 AÑOS: por fallas o defectos que afecten a la ESTRUCTURA soportante del edificio.
- 5 AÑOS: cuando se trate de fallas o defectos de los ELEMENTOS CONSTRUCTIVOS o de las INSTALACIONES.
- 3 AÑOS: cuando afecten a elementos de TERMINACIONES o de ACABADO de las obras.

En los demás casos en que no haya un plazo especial, la acción prescribe en 5 años contados desde la fecha de la recepción definitiva.

[VERIFICAR TEXTO OFICIAL] — Confirmar la redacción precisa y los plazos exactos contra el Art. 18 vigente de la LGUC antes de usarlos en asesoría legal.`,
    keywords: ['responsabilidad', 'fallas', 'defectos', 'prescripción', 'plazo', 'primer vendedor', 'proyectista', 'constructor', '10 años', '5 años', '3 años', 'estructura', 'terminaciones'],
    categoria: 'responsabilidad',
  },
  {
    id: '116',
    titulo: 'Exigencia de permiso de la Dirección de Obras Municipales',
    texto: `La construcción, reconstrucción, reparación, alteración, ampliación y demolición de edificios y obras de urbanización de cualquier naturaleza, sean urbanas o rurales, requieren permiso de la Dirección de Obras Municipales (DOM), a petición del propietario, con las excepciones que señale la Ordenanza General.

Puntos clave:
- El permiso se otorga previo pago de los derechos municipales que correspondan.
- La Ordenanza General (OGUC) establece qué obras están exentas de permiso y qué obras menores tienen procedimientos simplificados.
- La LGUC contempla la figura del Revisor Independiente (ver Art. 116 bis) para agilizar la revisión de proyectos.

Este artículo es la base legal de todo el sistema de permisos de edificación que administra la DOM. La OGUC (Título 5) desarrolla el procedimiento, los documentos y los plazos.`,
    keywords: ['permiso', 'edificación', 'DOM', 'construcción', 'ampliación', 'demolición', 'alteración', 'reparación', 'urbanización', 'derechos municipales'],
    categoria: 'permisos',
  },
  {
    id: '116 bis',
    titulo: 'Revisor Independiente',
    texto: `La LGUC contempla la figura del Revisor Independiente: profesionales inscritos en un registro que administra el Ministerio de Vivienda y Urbanismo (MINVU), cuya función es verificar que los anteproyectos y proyectos de obras de edificación cumplan con las disposiciones legales y reglamentarias aplicables.

Efectos prácticos:
- Cuando el proyecto cuenta con Informe Favorable de un Revisor Independiente, la DOM revisa en plazos reducidos (la OGUC y la Ley 21.718 detallan los plazos).
- El Revisor Independiente es subsidiariamente responsable, junto al proyectista, respecto de la correcta aplicación de las normas pertinentes a su revisión.
- No reemplaza la responsabilidad del proyectista ni la potestad final de la DOM.

[VERIFICAR TEXTO OFICIAL] — Confirmar el alcance exacto de las funciones y el régimen de responsabilidad contra el Art. 116 bis vigente de la LGUC.`,
    keywords: ['revisor independiente', 'MINVU', 'registro', 'informe favorable', 'plazo reducido', 'responsabilidad subsidiaria', 'revisión'],
    categoria: 'profesionales',
  },
  {
    id: '144',
    titulo: 'Solicitud de recepción definitiva de la obra',
    texto: `Terminada una obra o parte de la misma que pueda habilitarse independientemente, el propietario y el arquitecto deben solicitar su recepción definitiva a la Dirección de Obras Municipales.

La DOM verifica que la obra ejecutada corresponda a los planos y especificaciones del permiso aprobado y que se cumplan las condiciones exigidas, y otorga el Certificado de Recepción Definitiva (total o parcial).

La OGUC (Título 5, Capítulo 2) desarrolla los documentos, el procedimiento de inspección y los plazos de la recepción.

[VERIFICAR TEXTO OFICIAL] — Confirmar la redacción precisa contra el Art. 144 vigente de la LGUC.`,
    keywords: ['recepción', 'definitiva', 'obra', 'terminada', 'DOM', 'certificado', 'arquitecto', 'parcial'],
    categoria: 'recepciones',
  },
  {
    id: '145',
    titulo: 'Prohibición de habitar o usar la obra sin recepción definitiva',
    texto: `Ninguna obra podrá ser habitada o destinada a uso alguno antes de su recepción definitiva, parcial o total.

Consecuencias prácticas:
- Sin Certificado de Recepción Definitiva, el inmueble no puede ser habitado ni destinado legalmente a su uso previsto, ni transferido en las condiciones que exige la ley.
- Habitar o usar una obra sin recepción constituye una infracción sancionable conforme a la LGUC y la OGUC.

Este artículo, junto al Art. 144, cierra el ciclo del permiso de edificación: permiso → ejecución → recepción → uso legal.

[VERIFICAR TEXTO OFICIAL] — Confirmar la redacción precisa y las excepciones contra el Art. 145 vigente de la LGUC.`,
    keywords: ['prohibición', 'habitar', 'uso', 'recepción definitiva', 'inmueble', 'transferencia', 'infracción'],
    categoria: 'recepciones',
  },
  {
    id: '148',
    titulo: 'Construcciones que amenazan ruina y facultad de demolición',
    texto: `La autoridad (municipalidad, a través del Alcalde y la Dirección de Obras Municipales) tiene la facultad de ordenar medidas respecto de construcciones que amenacen ruina o que representen un peligro para la seguridad de las personas, pudiendo llegar a ordenar su reparación o demolición conforme al procedimiento que fija la ley.

También procede la demolición o la orden de regularización respecto de obras ejecutadas sin ajustarse a la normativa vigente, según las reglas de la LGUC y la OGUC.

[VERIFICAR TEXTO OFICIAL] — El número de artículo, el procedimiento y las facultades exactas deben confirmarse contra el texto vigente de la LGUC; usar con cautela en asesoría.`,
    keywords: ['ruina', 'demolición', 'peligro', 'seguridad', 'municipalidad', 'alcalde', 'orden', 'reparación'],
    categoria: 'sanciones',
  },
]

// Recuperación por keyword matching (mismo patrón que getArticulosRelevantes de oguc-knowledge)
export function getArticulosLGUCRelevantes(query: string, limit = 5): ArticuloLGUC[] {
  const q = query.toLowerCase()

  const scored = ARTICULOS_LGUC.map((art) => {
    let score = 0
    for (const kw of art.keywords) {
      if (q.includes(kw.toLowerCase())) score += 3
    }
    if (q.includes(art.titulo.toLowerCase())) score += 5
    if (q.includes(art.id)) score += 10
    if (q.includes(art.categoria)) score += 2
    for (const kw of art.keywords) {
      if (kw.toLowerCase().includes(q.slice(0, 5))) score += 1
    }
    return { art, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.art)
}

export function getContextoLGUC(query: string): string {
  const articulos = getArticulosLGUCRelevantes(query)
  if (articulos.length === 0) return ''
  return articulos
    .map((a) => `**Art. ${a.id} LGUC — ${a.titulo}**\n${a.texto}`)
    .join('\n\n---\n\n')
}
