import { describe, expect, it } from 'vitest'

import {
  flagUnverifiedArticulo,
  flagUnverifiedCita,
  flagUnverifiedDDU,
  getContextoNormativo,
} from '@/lib/normativa-retrieval'
import { CIRCULARES_DDU } from '@/lib/circulares-ddu'

describe('flagUnverifiedDDU', () => {
  it('deja pasar circulares verificadas de la base', () => {
    expect(flagUnverifiedDDU('DDU 328')).toBe('DDU 328')
    expect(flagUnverifiedDDU('DDU 484')).toBe('DDU 484')
    expect(flagUnverifiedDDU('DDU-ESP 084-07')).toBe('DDU-ESP 084-07')
  })

  it('marca números de DDU no verificados', () => {
    expect(flagUnverifiedDDU('DDU 253')).toBe('DDU 253 (n° por verificar)')
    expect(flagUnverifiedDDU('DDU N° 9999')).toContain('(n° por verificar)')
  })

  it('no toca citas por materia (sin número)', () => {
    const materia = 'DDU — modificación de proyecto'
    expect(flagUnverifiedDDU(materia)).toBe(materia)
  })

  it('no duplica la marca si ya dice "por verificar"', () => {
    const ya = 'DDU 253 (n° por verificar)'
    expect(flagUnverifiedDDU(ya)).toBe(ya)
  })
})

describe('flagUnverifiedArticulo', () => {
  it('deja pasar artículos de la base curada', () => {
    expect(flagUnverifiedArticulo('Art. 5.1.2 OGUC')).toBe('Art. 5.1.2 OGUC')
    // Régimen de modificación de proyecto, renumerado jul 2026.
    expect(flagUnverifiedArticulo('Art. 5.1.17 OGUC')).toBe('Art. 5.1.17 OGUC')
  })

  it('marca artículos fuera de la base', () => {
    expect(flagUnverifiedArticulo('Art. 9.9.9 OGUC')).toBe('Art. 9.9.9 OGUC (por verificar)')
    // El antiguo número incorrecto del régimen de modificaciones ya no pasa.
    expect(flagUnverifiedArticulo('Art. 5.1.15 OGUC')).toBe('Art. 5.1.15 OGUC (por verificar)')
  })

  it('no toca citas que no son "Art. X OGUC/LGUC"', () => {
    expect(flagUnverifiedArticulo('PRC de Vitacura, zona U-C')).toBe('PRC de Vitacura, zona U-C')
  })
})

describe('flagUnverifiedCita', () => {
  it('compone ambas verificaciones', () => {
    expect(flagUnverifiedCita('Art. 5.1.2 OGUC')).toBe('Art. 5.1.2 OGUC')
    expect(flagUnverifiedCita('DDU 1234')).toContain('por verificar')
  })
})

describe('base de circulares DDU', () => {
  it('toda circular verificada tiene número real y fuente minvu.gob.cl', () => {
    for (const c of CIRCULARES_DDU.filter((x) => x.verificado)) {
      expect(c.numero).not.toContain('VERIFICAR')
      expect(c.fuente).toMatch(/^https:\/\/www\.minvu\.gob\.cl\//)
    }
  })
})

describe('getContextoNormativo', () => {
  it('recupera contexto relevante para modificación de proyecto', () => {
    const ctx = getContextoNormativo('modificación de proyecto entre permiso y recepción')
    expect(ctx).toContain('OGUC')
    expect(ctx).toContain('DDU')
  })

  it('nunca devuelve vacío (fallback a OGUC general)', () => {
    expect(getContextoNormativo('zzzz qqqq xxxx').length).toBeGreaterThan(50)
  })
})
