import { describe, expect, it } from 'vitest'
import { STRIP_POWER_CENTERS_CHILE, obtenerCompetidoresSeedList } from '@/lib/strip-power-centers-chile'

describe('STRIP_POWER_CENTERS_CHILE', () => {
  it('toda fila con direccion !== null tiene lat/lng !== null (guard contra geocoding silenciosamente faltante)', () => {
    for (const c of STRIP_POWER_CENTERS_CHILE) {
      if (c.direccion !== null) {
        expect(c.lat, `${c.nombre}: direccion no-null pero lat es null`).not.toBeNull()
        expect(c.lng, `${c.nombre}: direccion no-null pero lng es null`).not.toBeNull()
      }
    }
  })

  it('toda fila con lat/lng !== null tiene coordenadas dentro del rango geográfico de Chile', () => {
    for (const c of STRIP_POWER_CENTERS_CHILE) {
      if (c.lat != null && c.lng != null) {
        expect(c.lat).toBeGreaterThan(-56)
        expect(c.lat).toBeLessThan(-18)
        expect(c.lng).toBeGreaterThan(-76)
        expect(c.lng).toBeLessThan(-66)
      }
    }
  })

  it('incluye al menos un strip_center y un power_center', () => {
    expect(STRIP_POWER_CENTERS_CHILE.some((c) => c.formato === 'strip_center')).toBe(true)
    expect(STRIP_POWER_CENTERS_CHILE.some((c) => c.formato === 'power_center')).toBe(true)
  })
})

describe('obtenerCompetidoresSeedList', () => {
  // Origen sintético cerca de Punta Blanca Maipú (Los Pajaritos), lat -33.470433 / lng -70.734977
  const origenMaipu = { lat: -33.470433, lng: -70.734977 }

  it('filtra correctamente por formato — power_center nunca devuelve filas strip_center', () => {
    const resultado = obtenerCompetidoresSeedList('power_center', origenMaipu, 50_000)
    expect(resultado.every((c) => c.formato === 'power_center')).toBe(true)
  })

  it('filtra correctamente por radio — un radio de 0m desde un punto exacto no devuelve competidores lejanos', () => {
    const radioAmplio = obtenerCompetidoresSeedList('strip_center', origenMaipu, 50_000)
    const radioAngosto = obtenerCompetidoresSeedList('strip_center', origenMaipu, 100)
    expect(radioAmplio.length).toBeGreaterThan(radioAngosto.length)
    // El propio Punta Blanca Maipú (Los Pajaritos) está a 0m del origen sintético — debe aparecer incluso con radio angosto
    expect(radioAngosto.some((c) => c.nombre === 'Punta Blanca Maipú (Los Pajaritos)')).toBe(true)
  })

  it('excluye filas sin lat/lng (direccion no confirmada) del resultado', () => {
    const resultado = obtenerCompetidoresSeedList('strip_center', origenMaipu, 1_000_000)
    expect(resultado.every((c) => c.lat != null && c.lng != null)).toBe(true)
    // Cimenta Strip Center Puente Alto tiene lat/lng: null en la fuente — nunca debe aparecer
    expect(resultado.some((c) => c.nombre === 'Cimenta Strip Center Puente Alto')).toBe(false)
  })

  it('ninguna fila del resultado tiene confianza "alta" — el cap de la lista curada está funcionando', () => {
    const resultado = obtenerCompetidoresSeedList('strip_center', origenMaipu, 1_000_000)
    expect(resultado.length).toBeGreaterThan(0)
    expect(resultado.every((c) => c.confianza !== 'alta')).toBe(true)
  })
})
