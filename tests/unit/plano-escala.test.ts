import { describe, expect, it } from 'vitest'

import { distanciaRealM, extraerCotasDeTexto, parsearEscalaDeTexto, type EscalaPlano } from '@/lib/plano-escala'

describe('parsearEscalaDeTexto', () => {
  it('parsea una escala simple sin separador de miles', () => {
    expect(parsearEscalaDeTexto('ESCALA 1:50')).toEqual({ escala: 50, fuente: 'ESCALA 1:50' })
  })

  it('bug real: "ESC. 1:1.000" — el separador de miles no trunca a 1', () => {
    expect(parsearEscalaDeTexto('ESC. 1:1.000')).toEqual({ escala: 1000, fuente: 'ESC. 1:1.000' })
  })

  it('acepta coma como separador de miles también', () => {
    expect(parsearEscalaDeTexto('ESCALA 1:1,250')).toEqual({ escala: 1250, fuente: 'ESCALA 1:1,250' })
  })

  it('devuelve null (no fabrica una escala) si el texto no matchea', () => {
    expect(parsearEscalaDeTexto('Plano de emplazamiento')).toBeNull()
  })
})

// Plano A1 apaisado a escala 1:50 — dimensiones reales de referencia para
// verificar la conversión punto→mm→metro sin depender de pdfjs ni del DOM.
const planoEsc50: EscalaPlano = { escala: 50, anchoPt: 2384, altoPt: 1684, fuente: 'ESCALA 1:50' }

describe('distanciaRealM', () => {
  it('convierte una distancia horizontal normalizada a metros reales según la escala', () => {
    // Medio ancho de página en puntos PDF, a escala 1:50.
    const a = { x: 0, y: 0 }
    const b = { x: 0.5, y: 0 }
    const distPt = 0.5 * planoEsc50.anchoPt
    const esperado = Math.round((((distPt * (25.4 / 72)) / 1000) * 50 + Number.EPSILON) * 100) / 100
    expect(distanciaRealM(a, b, planoEsc50)).toBe(esperado)
  })

  it('devuelve 0 cuando los dos puntos coinciden', () => {
    const p = { x: 0.3, y: 0.4 }
    expect(distanciaRealM(p, p, planoEsc50)).toBe(0)
  })

  it('devuelve null si la lámina no tiene escala detectada', () => {
    const sinEscala: EscalaPlano = { escala: null, anchoPt: 2384, altoPt: 1684, fuente: null }
    expect(distanciaRealM({ x: 0, y: 0 }, { x: 1, y: 1 }, sinEscala)).toBeNull()
  })

  it('devuelve null si la escala es 0 o negativa (dato corrupto, no se adivina)', () => {
    const invalida: EscalaPlano = { escala: 0, anchoPt: 2384, altoPt: 1684, fuente: 'ESCALA 1:0' }
    expect(distanciaRealM({ x: 0, y: 0 }, { x: 1, y: 0 }, invalida)).toBeNull()
  })

  it('devuelve null si no se pasa información de plano', () => {
    expect(distanciaRealM({ x: 0, y: 0 }, { x: 1, y: 0 }, null)).toBeNull()
    expect(distanciaRealM({ x: 0, y: 0 }, { x: 1, y: 0 }, undefined)).toBeNull()
  })

  it('combina componentes x/y (distancia euclidiana) antes de escalar', () => {
    // Triángulo 3-4-5 normalizado sobre una página cuadrada de 1000pt de lado.
    const cuadrada: EscalaPlano = { escala: 100, anchoPt: 1000, altoPt: 1000, fuente: 'ESC 1:100' }
    const a = { x: 0, y: 0 }
    const b = { x: 0.3, y: 0.4 } // 300pt, 400pt → hipotenusa 500pt
    const distMm = 500 * (25.4 / 72)
    const esperado = Math.round(((distMm / 1000) * 100 + Number.EPSILON) * 100) / 100
    expect(distanciaRealM(a, b, cuadrada)).toBe(esperado)
  })
})

describe('extraerCotasDeTexto', () => {
  it('detecta una cota simple con punto decimal', () => {
    expect(extraerCotasDeTexto('3.20')).toEqual([{ valorM: 3.2, texto: '3.20' }])
  })

  it('detecta una cota con coma decimal (convención chilena)', () => {
    expect(extraerCotasDeTexto('H=2,40')).toEqual([{ valorM: 2.4, texto: 'H=2,40' }])
  })

  it('detecta varias cotas en el mismo texto', () => {
    const r = extraerCotasDeTexto('ancho 3.20 alto 2.40')
    expect(r.map((c) => c.valorM)).toEqual([3.2, 2.4])
  })

  it('ignora superficies en m² (no son una distancia)', () => {
    expect(extraerCotasDeTexto('45.50 m²')).toEqual([])
    expect(extraerCotasDeTexto('45.50m2')).toEqual([])
  })

  it('ignora fragmentos de un RUT', () => {
    expect(extraerCotasDeTexto('12.345.678-9')).toEqual([])
  })

  it('ignora fragmentos de un número de 3+ dígitos enteros (superficie total, expediente)', () => {
    expect(extraerCotasDeTexto('Total m2 edificados = 138,6 m2')).toEqual([])
    expect(extraerCotasDeTexto('892.40')).toEqual([])
  })

  it('ignora citas normativas tipo "Art. 2.6.3 OGUC" (tres segmentos, no dos)', () => {
    expect(extraerCotasDeTexto('Art. 2.6.3 OGUC')).toEqual([])
  })

  it('ignora valores fuera del rango plausible para un elemento constructivo', () => {
    expect(extraerCotasDeTexto('0.01')).toEqual([]) // demasiado pequeño
  })

  it('acepta el límite inferior e superior del rango plausible', () => {
    expect(extraerCotasDeTexto('0.05').map((c) => c.valorM)).toEqual([0.05])
    expect(extraerCotasDeTexto('50.00').map((c) => c.valorM)).toEqual([50])
  })

  it('no encuentra nada en texto sin números con el patrón esperado', () => {
    expect(extraerCotasDeTexto('PLANTA PRIMER PISO')).toEqual([])
  })
})
