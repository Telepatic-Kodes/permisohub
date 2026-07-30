import { describe, expect, it } from 'vitest'

import { distanciaRealM, type EscalaPlano } from '@/lib/plano-escala'

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
