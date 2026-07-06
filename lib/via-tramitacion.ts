// ---------------------------------------------------------------------------
// Decisor determinista de vía de tramitación (Δ3-core).
//
// Enruta un caso a la vía DOM correcta (obra menor / cambio de destino /
// modificación-alteración / regularización) a partir de unas pocas preguntas,
// con su artículo citado. NO usa IA: la lógica de ruteo es reglas explícitas y
// auditables (el LLM del asesor de vía profundiza con los ajustes del proyecto).
//
// Es ORIENTATIVO: da la vía más probable y su fundamento; la DOM de cada comuna
// puede exigir matices. Solo cita artículos verificados contra la base curada.
// ---------------------------------------------------------------------------

import { getArticuloById, urlDeCitable, type FuenteNormativa } from '@/lib/normativa-retrieval'

export interface RespuestasVia {
  yaConstruido: boolean // la obra ya está ejecutada (regularización)
  cambiaDestino: boolean // cambia el destino/uso del inmueble
  alteraEstructura: boolean // interviene muros soportantes / estructura
  aumentaSuperficie: boolean // aumenta la superficie edificada
  excedePRC: boolean // supera algún límite del PRC (constructibilidad/ocupación/altura)
}

export interface CitaVia {
  fuente: FuenteNormativa
  id: string
  etiqueta: string
  url: string
}

export interface ViaRecomendada {
  via: string
  liviana: boolean // true = la vía más liviana (menor costo/tiempo)
  costoTiempo: string
  razon: string
  cita: CitaVia | null
  alertas: string[]
}

// Preguntas en orden de presentación. `pesada` marca las que empujan a una vía
// más costosa (para pintar el toggle con color de estado en la UI).
export const PREGUNTAS_VIA: {
  clave: keyof RespuestasVia
  label: string
  ayuda: string
}[] = [
  { clave: 'yaConstruido', label: '¿La obra ya está construida?', ayuda: 'Si ya se ejecutó, la vía es regularización, no un permiso ordinario.' },
  { clave: 'alteraEstructura', label: '¿Interviene la estructura (muros soportantes, losas)?', ayuda: 'Trabajos estructurales empujan a permiso de alteración.' },
  { clave: 'aumentaSuperficie', label: '¿Aumenta la superficie edificada?', ayuda: 'Un aumento de superficie es una modificación de proyecto.' },
  { clave: 'cambiaDestino', label: '¿Cambia el destino/uso del inmueble?', ayuda: 'Ej.: de vivienda a local comercial.' },
  { clave: 'excedePRC', label: '¿Supera algún límite del PRC (constructibilidad, ocupación o altura)?', ayuda: 'Se prellena desde el cuadro de cálculo si ya lo cargaste.' },
]

function citaDe(fuente: FuenteNormativa, id: string): CitaVia | null {
  const a = getArticuloById(fuente, id)
  if (!a || !a.verificado) return null
  return { fuente, id: a.id, etiqueta: a.etiqueta, url: urlDeCitable(a) }
}

/**
 * Regla de ruteo determinista. Prioriza la vía más liviana que sea coherente
 * con las respuestas. El exceso de PRC no cambia la vía pero se advierte: no hay
 * vía liviana que "salve" un incumplimiento de superficie/altura.
 */
export function recomendarVia(r: RespuestasVia): ViaRecomendada {
  const alertas: string[] = []
  if (r.excedePRC) {
    alertas.push(
      'El proyecto excede límites del PRC (constructibilidad, ocupación o altura). Ninguna vía liviana salva un incumplimiento normativo: primero ajusta el proyecto para que el cuadro cumpla.',
    )
  }

  if (r.yaConstruido) {
    return {
      via: 'Regularización de obra ejecutada',
      liviana: false,
      costoTiempo: 'Variable · según antigüedad y normativa vigente',
      razon: 'La obra ya está construida: no procede un permiso ordinario, sino una regularización.',
      cita: null,
      alertas: [
        ...alertas,
        'Verifica la ley de regularización vigente aplicable (p. ej. Ley 20.898 y sus plazos): no está en la base curada, confírmala.',
      ],
    }
  }

  if (r.cambiaDestino && !r.alteraEstructura && !r.aumentaSuperficie) {
    return {
      via: 'Cambio de destino',
      liviana: true,
      costoTiempo: '60-90 días · costo medio',
      razon: 'Cambia el uso/destino sin alterar la estructura ni aumentar la superficie.',
      cita: citaDe('DDU', 'ddu-esp-084-07'),
      alertas,
    }
  }

  if (!r.alteraEstructura && !r.aumentaSuperficie && !r.cambiaDestino) {
    return {
      via: 'Obra menor',
      liviana: true,
      costoTiempo: '30-60 días · costo bajo',
      razon: 'No altera la estructura, no aumenta superficie ni cambia el destino: califica como obra menor, la vía más liviana.',
      cita: citaDe('OGUC', '5.1.2'),
      alertas,
    }
  }

  const motivos = [
    r.alteraEstructura ? 'interviene la estructura' : null,
    r.aumentaSuperficie ? 'aumenta la superficie edificada' : null,
    r.cambiaDestino ? 'cambia el destino junto con obras' : null,
  ].filter(Boolean)
  return {
    via: 'Modificación de proyecto / Permiso de alteración',
    liviana: false,
    costoTiempo: '90-120 días · costo alto (exige especialistas: cálculo, sanitario, constructor)',
    razon: `El proyecto ${motivos.join(' y ')}: requiere modificación de proyecto o permiso de alteración.`,
    cita: citaDe('OGUC', '5.1.17'),
    alertas,
  }
}
