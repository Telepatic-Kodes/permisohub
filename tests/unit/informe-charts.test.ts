import { describe, expect, it } from 'vitest'

import { extraerScoreLiquidez, extraerComparables, extraerRiesgosPorNivel } from '@/lib/informe-charts'

// Fixtures con el formato EXACTO que mandan lib/tasacion-prompts.ts y
// lib/due-diligence-propiedad-prompts.ts — verifica el parser de forma
// aislada, sin depender de que el LLM complete las 10 secciones en una
// corrida real (se observó en vivo que a veces corta antes de llegar a
// Score de Liquidez — el parser debe degradar a null, no fallar).

const SCORE_LIQUIDEZ_MD = `
## 🎯 Resumen Ejecutivo

algo de texto

## 📊 Score de Liquidez

| Dimensión | Score (1–5) | Detalle |
|-----------|-------------|---------|
| Demanda de zona | 4/5 | activo |
| Tamaño del lote | 3/5 | ideal para construcción |
| Claridad del dominio | 5/5 | individual limpio |
| Condiciones de mercado | 4/5 | activo |
| Acceso a financiamiento | 3/5 | bancos financian normalmente |
| **Score total** | **19/25** | MEDIA (12–19) |

Tiempo estimado de venta: 8 semanas.
`

const COMPARABLES_MD = `
## 📊 Comparables de Mercado

| # | Dirección / Referencia | m² | UF/m² publicado | UF/m² ajustado | Precio total (UF) | Fuente |
|---|------------------------|-----|-----------------|----------------|-------------------|--------|
| 1 | Quinchamalí, El Monte | 1700 | 10,78 | 10,78 | 18.337 | [enlaceinmobiliario.cl](https://enlaceinmobiliario.cl) |
| 2 | Terreno con vista panorámica | 1208 | 13,5 | 13,5 | 16.300 | [Engel & Völkers](https://engelvoelkers.com) |
| 3 | Cerca del metro Manquehue | 1000 | 30 | 30 | 30.000 | [Chilepropiedades.cl](https://cf.chilepropiedades.cl) |

Nota: comparables directos.
`

const RIESGOS_MD = `
## ⚠️ Riesgos Identificados
Lista priorizada. Por cada riesgo:

**[ALTO]** Litigio activo
- Descripción concreta
- Impacto en la operación
- Cómo mitigarlo

**[MEDIO]** Deuda TGR pendiente
- Descripción
- Impacto
- Mitigación

**[MEDIO]** Documentación incompleta
- Descripción
- Impacto
- Mitigación

**[BAJO]** Zonificación no verificada
- Descripción
- Impacto
- Mitigación
`

describe('extraerScoreLiquidez', () => {
  it('parsea las 5 dimensiones y excluye la fila de Score total', () => {
    const resultado = extraerScoreLiquidez(SCORE_LIQUIDEZ_MD)
    expect(resultado).toEqual([
      { dimension: 'Demanda de zona', score: 4 },
      { dimension: 'Tamaño del lote', score: 3 },
      { dimension: 'Claridad del dominio', score: 5 },
      { dimension: 'Condiciones de mercado', score: 4 },
      { dimension: 'Acceso a financiamiento', score: 3 },
    ])
  })

  it('degrada a null si la sección no existe (el modelo cortó antes de llegar, visto en vivo)', () => {
    expect(extraerScoreLiquidez('## 🎯 Resumen Ejecutivo\n\nsolo esto')).toBeNull()
  })

  it('acepta score con coma decimal (4,5/5), no solo punto', () => {
    const conComa = `
## 📊 Score de Liquidez

| Dimensión | Score (1–5) | Detalle |
|-----------|-------------|---------|
| Demanda de zona | 4,5/5 | activo |
`
    expect(extraerScoreLiquidez(conComa)).toEqual([{ dimension: 'Demanda de zona', score: 4.5 }])
  })
})

describe('extraerComparables', () => {
  it('parsea los 3 comparables rankeando por UF/m² ajustado', () => {
    const resultado = extraerComparables(COMPARABLES_MD)
    expect(resultado).toEqual([
      { label: 'Quinchamalí, El Monte', ufM2Ajustado: 10.78 },
      { label: 'Terreno con vista panorámica', ufM2Ajustado: 13.5 },
      { label: 'Cerca del metro Manquehue', ufM2Ajustado: 30 },
    ])
  })

  it('degrada a null si la sección no existe', () => {
    expect(extraerComparables('## Otra sección\n\nsin tabla')).toBeNull()
  })

  it('resuelve la columna por encabezado — no se confunde si el modelo omite la columna "#"', () => {
    const sinNumeracion = `
## 📊 Comparables de Mercado

| Dirección / Referencia | m² | UF/m² publicado | UF/m² ajustado | Precio total (UF) | Fuente |
|------------------------|-----|-----------------|----------------|-------------------|--------|
| Quinchamalí, El Monte | 1700 | 10,78 | 10,78 | 18.337 | fuente |
`
    expect(extraerComparables(sinNumeracion)).toEqual([{ label: 'Quinchamalí, El Monte', ufM2Ajustado: 10.78 }])
  })

  it('parsea separador de miles chileno correctamente (1.250 = mil doscientos cincuenta, no 1.25)', () => {
    const conMiles = `
## 📊 Comparables de Mercado

| # | Dirección / Referencia | m² | UF/m² publicado | UF/m² ajustado | Precio total (UF) | Fuente |
|---|------------------------|-----|-----------------|----------------|-------------------|--------|
| 1 | Depto premium Vitacura | 200 | 1.250 | 1.250 | 250.000 | fuente |
`
    expect(extraerComparables(conMiles)).toEqual([{ label: 'Depto premium Vitacura', ufM2Ajustado: 1250 }])
  })
})

describe('extraerRiesgosPorNivel', () => {
  it('cuenta riesgos por nivel', () => {
    expect(extraerRiesgosPorNivel(RIESGOS_MD)).toEqual({ alto: 1, medio: 2, bajo: 1 })
  })

  it('degrada a null si no hay riesgos con nivel marcado', () => {
    expect(extraerRiesgosPorNivel('## ⚠️ Riesgos Identificados\n\nSin riesgos.')).toBeNull()
  })

  it('no cuenta menciones de nivel dentro de un bullet de descripción, solo el encabezado del riesgo', () => {
    const conMencionInline = `
## ⚠️ Riesgos Identificados

**[ALTO]** Litigio activo
- Descripción concreta
- Impacto en la operación: podría escalar a [MEDIO] si no se resuelve pronto
- Cómo mitigarlo
`
    expect(extraerRiesgosPorNivel(conMencionInline)).toEqual({ alto: 1, medio: 0, bajo: 0 })
  })
})
