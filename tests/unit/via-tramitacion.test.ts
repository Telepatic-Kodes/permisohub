import { describe, expect, it } from 'vitest'

import { recomendarVia, type RespuestasVia } from '@/lib/via-tramitacion'

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
    expect(r.cita?.verificado ?? true).toBe(true)
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

  it('ya construido → regularización, sin cita verificada, con alerta de ley aplicable', () => {
    const r = recomendarVia({ ...NO, yaConstruido: true, aumentaSuperficie: true })
    expect(r.via).toMatch(/Regularización/)
    expect(r.liviana).toBe(false)
    expect(r.cita).toBeNull()
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
