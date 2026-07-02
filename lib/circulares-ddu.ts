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
  numero: string // ej: "DDU 400" — [VERIFICAR N° OFICIAL] mientras no se confirme
  titulo: string
  texto: string
  keywords: string[]
  categoria: CategoriaCircular
}

export const CIRCULARES_DDU: CircularDDU[] = [
  {
    id: 'ddu-modificacion-proyecto',
    numero: '[VERIFICAR N° OFICIAL]',
    titulo: 'Alcance de "Modificación de Proyecto"',
    texto: `Tema de interpretación de amplio conocimiento: la DDU ha precisado, mediante circular, el alcance del concepto de "Modificación de Proyecto" y cuándo una variante introducida entre el permiso y la recepción definitiva requiere un permiso de modificación, distinguiéndola de los ajustes menores que no lo requieren.

Relación normativa: se vincula con la definición de "Modificación de proyecto" de la OGUC (vigente desde 25.04.2026 por D.S. N°10, D.O. 23.02.2026) y con el Art. 5.1.15 OGUC.

[VERIFICAR TEXTO OFICIAL] y [VERIFICAR N° OFICIAL] — Confirmar el número, fecha y texto de la circular DDU aplicable en el buscador oficial del MINVU antes de citarla.`,
    keywords: ['modificación de proyecto', 'variante', 'permiso de modificación', 'interpretación', 'DDU', 'ajuste menor'],
    categoria: 'interpretacion',
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
    .map((c) => `**Circular ${c.numero} — ${c.titulo}**\n${c.texto}`)
    .join('\n\n---\n\n')
}
