import { describe, expect, it } from 'vitest'
import { obtenerConsumoEstimado } from '@/lib/consumo-macro-zona'

// Función pura, sin red — CASEN_POBREZA_POR_COMUNA fue poblada en Task 2
// (checkpoint humano) con las 36 comunas RM que tienen oportunidades reales
// hoy en mercado_locales_listings, transcritas desde el XLSX oficial del
// Observatorio Social (Ministerio de Desarrollo Social y Familia, CASEN
// 2024 SAE). Providencia es una de esas 36 comunas (dato real: 1.19%).

describe('obtenerConsumoEstimado', () => {
  it('retorna tasaPobrezaComunal numérico, nivelGeografico y disclosure para una comuna con dato CASEN real', () => {
    const resultado = obtenerConsumoEstimado('Providencia')

    expect(resultado.tasaPobrezaComunal).not.toBeNull()
    expect(typeof resultado.tasaPobrezaComunal).toBe('number')
    expect(resultado.nivelGeografico).toBe('macro_zona_gran_santiago')
    expect(resultado.disclosure).toBeTruthy()
    expect(resultado.disclosure.toLowerCase()).toContain('macro-zona')
  })

  it('retorna tasaPobrezaComunal: null sin lanzar para una comuna que no está en la tabla CASEN', () => {
    const resultado = obtenerConsumoEstimado('Comuna Que No Existe En La Tabla')

    expect(resultado.tasaPobrezaComunal).toBeNull()
    expect(resultado.comuna).toBe('Comuna Que No Existe En La Tabla')
  })

  it('categoriasPendientes incluye las categorías EPF sin cifra confirmada y excluye las confirmadas', () => {
    const resultado = obtenerConsumoEstimado('Santiago')

    expect(resultado.categoriasPendientes).toContain('Educación')
    expect(resultado.categoriasPendientes).not.toContain('Alimentos y bebidas no alcohólicas')
  })

  it('normaliza el nombre de comuna (mayúsculas/tildes) al buscar en CASEN_POBREZA_POR_COMUNA', () => {
    const minuscula = obtenerConsumoEstimado('Providencia')
    const mayuscula = obtenerConsumoEstimado('PROVIDENCIA')

    expect(mayuscula.tasaPobrezaComunal).not.toBeNull()
    expect(mayuscula.tasaPobrezaComunal).toBe(minuscula.tasaPobrezaComunal)
  })
})
