import { describe, expect, it } from 'vitest'

import {
  flagUnverifiedArticulo,
  flagUnverifiedCita,
  flagUnverifiedDDU,
  getArticuloById,
  getContextoNormativo,
  urlDeCitable,
  FUENTE_FALLBACK_URL,
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

describe('getArticuloById', () => {
  it('resuelve artículos OGUC de la base (verificado, con etiqueta)', () => {
    const a = getArticuloById('OGUC', '5.1.2')
    expect(a).not.toBeNull()
    expect(a?.verificado).toBe(true)
    expect(a?.etiqueta).toBe('Art. 5.1.2 OGUC')
    expect(a?.texto.length).toBeGreaterThan(0)
  })

  it('normaliza el id (espacios / mayúsculas, "116 bis")', () => {
    expect(getArticuloById('OGUC', ' 5.1.2 ')?.id).toBe('5.1.2')
    expect(getArticuloById('LGUC', '116 BIS')?.verificado).toBe(true)
  })

  it('DDU resuelve por id o por número, con url MINVU real', () => {
    const porId = getArticuloById('DDU', 'ddu-328')
    const porNumero = getArticuloById('DDU', '328')
    expect(porId?.verificado).toBe(true)
    expect(porId?.url).toMatch(/minvu\.gob\.cl/)
    expect(porNumero?.id).toBe(porId?.id)
  })

  it('devuelve null para ids fuera de la base (nunca se presenta como fundado)', () => {
    expect(getArticuloById('OGUC', '9.9.9')).toBeNull()
    expect(getArticuloById('DDU', '99999')).toBeNull()
  })

  it('urlDeCitable cae al fallback de fuente cuando el artículo no tiene url propia', () => {
    const a = getArticuloById('OGUC', '5.1.2')
    expect(a).not.toBeNull()
    if (a) {
      // OGUC no tiene url por artículo → usa el fallback de fuente.
      expect(a.url).toBeUndefined()
      expect(urlDeCitable(a)).toBe(FUENTE_FALLBACK_URL.OGUC)
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
