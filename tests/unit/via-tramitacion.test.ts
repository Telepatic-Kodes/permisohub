import { describe, expect, it } from 'vitest'

import {
  citaDeNodo,
  NODOS_VIA,
  pasoSiguiente,
  recomendarVia,
  type RespuestasVia,
} from '@/lib/via-tramitacion'

const NO: RespuestasVia = {
  yaConstruido: false,
  cambiaDestino: false,
  alteraEstructura: false,
  aumentaSuperficie: false,
  excedePRC: false,
}

describe('recomendarVia — ruteo determinista', () => {
  it('sin cambios → obra menor (vía liviana) citando Art. 5.1.2 OGUC', () => {
    const r = recomendarVia(NO)
    expect(r.via).toBe('Obra menor')
    expect(r.liviana).toBe(true)
    expect(r.cita?.etiqueta).toBe('Art. 5.1.2 OGUC')
    expect(r.cita?.url).toBeTruthy()
    expect(r.alertas).toHaveLength(0)
  })

  it('solo cambio de destino → cambio de destino (liviana) citando DDU-ESP 084-07', () => {
    const r = recomendarVia({ ...NO, cambiaDestino: true })
    expect(r.via).toBe('Cambio de destino')
    expect(r.liviana).toBe(true)
    expect(r.cita?.etiqueta).toBe('DDU-ESP 084-07')
    expect(r.cita?.url).toMatch(/minvu\.gob\.cl/)
  })

  it('altera estructura → modificación/alteración (vía pesada) citando Art. 5.1.17 OGUC', () => {
    const r = recomendarVia({ ...NO, alteraEstructura: true })
    expect(r.via).toMatch(/Modificación de proyecto/)
    expect(r.liviana).toBe(false)
    expect(r.cita?.etiqueta).toBe('Art. 5.1.17 OGUC')
    expect(r.razon).toMatch(/estructura/)
  })

  it('aumenta superficie → vía pesada (no liviana)', () => {
    const r = recomendarVia({ ...NO, aumentaSuperficie: true })
    expect(r.liviana).toBe(false)
    expect(r.razon).toMatch(/superficie/)
  })

  it('cambio de destino + altera estructura → vía pesada (la obra domina)', () => {
    const r = recomendarVia({ ...NO, cambiaDestino: true, alteraEstructura: true })
    expect(r.via).toMatch(/Modificación de proyecto/)
    expect(r.liviana).toBe(false)
  })

  it('ya construido → regularización citando Art. 5.8.1 OGUC, con alerta de ley aplicable', () => {
    const r = recomendarVia({ ...NO, yaConstruido: true, aumentaSuperficie: true })
    expect(r.via).toMatch(/Regularización/)
    expect(r.liviana).toBe(false)
    expect(r.cita?.etiqueta).toBe('Art. 5.8.1 OGUC')
    expect(r.cita?.url).toBeTruthy()
    // La alerta de Ley 20.898 sigue: no está en la base curada.
    expect(r.alertas.some((a) => /regularizaci/i.test(a))).toBe(true)
  })

  it('excede PRC → agrega alerta pero NO cambia la vía', () => {
    const base = recomendarVia(NO)
    const conExceso = recomendarVia({ ...NO, excedePRC: true })
    expect(conExceso.via).toBe(base.via) // sigue siendo obra menor
    expect(conExceso.alertas.some((a) => /PRC/.test(a))).toBe(true)
    expect(base.alertas).toHaveLength(0)
  })

  it('es determinista: mismo input → mismo output', () => {
    const a = recomendarVia({ ...NO, cambiaDestino: true })
    const b = recomendarVia({ ...NO, cambiaDestino: true })
    expect(a).toEqual(b)
  })
})

describe('pasoSiguiente — árbol guiado', () => {
  it('sin respuestas → primera pregunta (yaConstruido, índice 0)', () => {
    const p = pasoSiguiente({})
    expect(p.tipo).toBe('pregunta')
    if (p.tipo === 'pregunta') {
      expect(p.nodo.clave).toBe('yaConstruido')
      expect(p.indice).toBe(0)
      expect(p.total).toBe(NODOS_VIA.length)
    }
  })

  it('short-circuit: yaConstruido=true → resultado inmediato (Regularización), sin preguntar el resto', () => {
    const p = pasoSiguiente({ yaConstruido: true })
    expect(p.tipo).toBe('resultado')
    if (p.tipo === 'resultado') {
      expect(p.via.via).toMatch(/Regularización/)
      // No se preguntó estructura/superficie/destino/PRC.
      expect(p.respuestas.alteraEstructura).toBe(false)
    }
  })

  it('avanza nodo a nodo en orden hasta el resultado', () => {
    // Responder todo en "No" salvo lo mínimo: recorre los 5 nodos y termina.
    let respuestas: Partial<RespuestasVia> = {}
    const vistos: string[] = []
    for (let i = 0; i < NODOS_VIA.length + 1; i++) {
      const p = pasoSiguiente(respuestas)
      if (p.tipo === 'resultado') {
        expect(p.via.via).toBe('Obra menor')
        break
      }
      vistos.push(p.nodo.clave)
      respuestas = { ...respuestas, [p.nodo.clave]: false }
    }
    expect(vistos).toEqual(NODOS_VIA.map((n) => n.clave))
  })

  it('el resultado terminal coincide con recomendarVia para las mismas respuestas', () => {
    const respuestas: RespuestasVia = { ...NO, alteraEstructura: true }
    const p = pasoSiguiente(respuestas)
    expect(p.tipo).toBe('resultado')
    if (p.tipo === 'resultado') {
      expect(p.via).toEqual(recomendarVia(respuestas))
    }
  })

  it('es determinista: mismas respuestas parciales → mismo paso', () => {
    expect(pasoSiguiente({ yaConstruido: false })).toEqual(pasoSiguiente({ yaConstruido: false }))
  })
})

describe('citaDeNodo — fundamento por nodo', () => {
  it('cada nodo con fundamento resuelve una cita verificada; excedePRC no tiene', () => {
    const byClave = new Map(NODOS_VIA.map((n) => [n.clave, n]))
    expect(citaDeNodo(byClave.get('yaConstruido')!)?.etiqueta).toBe('Art. 5.8.1 OGUC')
    expect(citaDeNodo(byClave.get('cambiaDestino')!)?.etiqueta).toBe('DDU-ESP 084-07')
    expect(citaDeNodo(byClave.get('alteraEstructura')!)?.etiqueta).toBe('Art. 5.1.17 OGUC')
    // excedePRC: sin artículo curado único → sin cita (honesto, no se inventa).
    expect(citaDeNodo(byClave.get('excedePRC')!)).toBeNull()
  })
})
