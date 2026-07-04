import { describe, expect, it } from 'vitest'

import {
  calcularCuadro,
  cuadroVacio,
  margenesCuadro,
  round,
  type CuadroInput,
} from '@/lib/cuadros-calculo'

const base: CuadroInput = {
  superficiePredio: 300,
  niveles: [{ nombre: 'Piso 1', edificada: 250, ocupadaSuelo: 200 }],
  coefConstructibilidadMax: 0.6,
  ocupacionSueloMaxPct: 50,
  alturaMaxM: 7,
  alturaProyectoM: 9,
}

describe('round', () => {
  it('redondea estable y evita -0', () => {
    expect(round(1.005)).toBe(1.01)
    expect(round(-0.0001)).toBe(0)
    expect(Object.is(round(-0.0001), -0)).toBe(false)
  })

  it('devuelve 0 para valores no finitos', () => {
    expect(round(Number.NaN)).toBe(0)
    expect(round(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('calcularCuadro', () => {
  it('caso Petshop: detecta los 3 incumplimientos', () => {
    const r = calcularCuadro(base)
    expect(r.superficieTotalEdificada).toBe(250)
    expect(r.superficieOcupadaSuelo).toBe(200)
    expect(r.constructibilidad).toBe(0.83)
    expect(r.ocupacionSueloPct).toBe(66.7)
    expect(r.incumplimientos).toHaveLength(3)
    expect(r.incompleto).toBe(false)
  })

  it('suma varios niveles y solo computa ocupación declarada', () => {
    const r = calcularCuadro({
      superficiePredio: 500,
      niveles: [
        { nombre: 'Piso 1', edificada: 184.21, ocupadaSuelo: 184.21 },
        { nombre: 'Piso 2', edificada: 100.5 },
      ],
      coefConstructibilidadMax: 1.2,
    })
    expect(r.superficieTotalEdificada).toBe(284.71)
    expect(r.superficieOcupadaSuelo).toBe(184.21)
    expect(r.constructibilidad).toBe(0.57)
    expect(r.filas.find((f) => f.concepto === 'Constructibilidad')?.veredicto).toBe('cumple')
  })

  it('tolerancia 0.5%: un exceso por redondeo no marca "excede"', () => {
    const r = calcularCuadro({
      superficiePredio: 100,
      niveles: [{ nombre: 'P1', edificada: 60.2 }],
      coefConstructibilidadMax: 0.6,
    })
    // 0.602 <= 0.6 * 1.005 = 0.603 → cumple
    expect(r.filas.find((f) => f.concepto === 'Constructibilidad')?.veredicto).toBe('cumple')
  })

  it('excesos reales sí se marcan', () => {
    const r = calcularCuadro({
      superficiePredio: 100,
      niveles: [{ nombre: 'P1', edificada: 61 }],
      coefConstructibilidadMax: 0.6,
    })
    expect(r.filas.find((f) => f.concepto === 'Constructibilidad')?.veredicto).toBe('excede')
  })

  it('sin límites declarados no inventa veredictos', () => {
    const r = calcularCuadro({
      superficiePredio: 300,
      niveles: [{ nombre: 'P1', edificada: 250 }],
    })
    expect(r.incumplimientos).toHaveLength(0)
    expect(r.filas.every((f) => f.veredicto !== 'excede')).toBe(true)
    // Sin altura declarada ni límite, la fila de altura no aparece.
    expect(r.filas.find((f) => f.concepto === 'Altura de edificación')).toBeUndefined()
  })

  it('predio 0 o edificada 0 → incompleto (no confiable)', () => {
    expect(calcularCuadro(cuadroVacio()).incompleto).toBe(true)
    expect(
      calcularCuadro({ superficiePredio: 0, niveles: [{ nombre: 'P1', edificada: 100 }] })
        .incompleto,
    ).toBe(true)
  })

  it('valores negativos o no numéricos se tratan como 0', () => {
    const r = calcularCuadro({
      superficiePredio: 100,
      niveles: [
        { nombre: 'P1', edificada: -50, ocupadaSuelo: Number.NaN },
        { nombre: 'P2', edificada: 80 },
      ],
    })
    expect(r.superficieTotalEdificada).toBe(80)
    expect(r.superficieOcupadaSuelo).toBe(0)
  })

  it('límites <= 0 se ignoran (sin_limite)', () => {
    const r = calcularCuadro({
      superficiePredio: 100,
      niveles: [{ nombre: 'P1', edificada: 90 }],
      coefConstructibilidadMax: 0,
      ocupacionSueloMaxPct: -10,
    })
    expect(r.filas.find((f) => f.concepto === 'Constructibilidad')?.veredicto).toBe('sin_limite')
    expect(r.filas.find((f) => f.concepto === 'Ocupación de suelo')?.veredicto).toBe('sin_limite')
  })
})

describe('margenesCuadro', () => {
  it('caso Petshop: metas numéricas exactas para el asesor', () => {
    const m = margenesCuadro(base)
    const edif = m.find((x) => x.concepto.includes('constructibilidad'))
    expect(edif).toMatchObject({ actual: 250, maximoPermitido: 180, exceso: 70 })
    const suelo = m.find((x) => x.concepto === 'Superficie ocupada en suelo')
    expect(suelo).toMatchObject({ actual: 200, maximoPermitido: 150, exceso: 50 })
    const altura = m.find((x) => x.concepto === 'Altura de edificación')
    expect(altura).toMatchObject({ actual: 9, maximoPermitido: 7, exceso: 2 })
  })

  it('reporta holgura (exceso negativo) cuando cumple', () => {
    const m = margenesCuadro({
      superficiePredio: 500,
      niveles: [{ nombre: 'P1', edificada: 200 }],
      coefConstructibilidadMax: 1.2,
    })
    expect(m).toHaveLength(1)
    expect(m[0].maximoPermitido).toBe(600)
    expect(m[0].exceso).toBe(-400)
  })

  it('sin límites declarados devuelve vacío (la app no inventa PRC)', () => {
    expect(
      margenesCuadro({ superficiePredio: 300, niveles: [{ nombre: 'P1', edificada: 100 }] }),
    ).toHaveLength(0)
  })
})
