import { describe, it, expect } from 'vitest'
import { fixMojibakeArcGIS } from '@/lib/zonificacion-format'

// Casos construidos con String.fromCodePoint en vez de tipear los caracteres
// corruptos a mano — la corrupción real (verificada en vivo contra el
// FeatureServer de Las Condes) incluye codepoints que se pierden o se
// mezclan al copiar/pegar texto normal, lo que produjo falsos negativos
// reales durante el diagnóstico de este bug (ver checkpoint 11-08).

describe('fixMojibakeArcGIS', () => {
  it('repara corrupción simple (Ã³ → ó)', () => {
    const corrupto = 'Edificaci' + String.fromCodePoint(0xc3, 0xb3) + 'n'
    expect(fixMojibakeArcGIS(corrupto)).toBe('Edificación')
  })

  it('repara el residuo de doble-corrupción verificado en Las Condes (N°2)', () => {
    const corrupto = 'N' + String.fromCodePoint(0xc3, 0xa2, 0xc2, 0xb0) + '2'
    expect(fixMojibakeArcGIS(corrupto)).toBe('N°2')
  })

  it('repara el mismo residuo con otro número (N°3)', () => {
    const corrupto = 'N' + String.fromCodePoint(0xc3, 0xa2, 0xc2, 0xb0) + '3'
    expect(fixMojibakeArcGIS(corrupto)).toBe('N°3')
  })

  it('repara corrupción simple con carácter de control invisible (Ã + U+0081 → Á)', () => {
    const corrupto = 'AV Zona de ' + String.fromCodePoint(0xc3, 0x81) + 'reas Verdes'
    expect(fixMojibakeArcGIS(corrupto)).toBe('AV Zona de Áreas Verdes')
  })

  it('no toca texto ya limpio', () => {
    const limpio = 'Zona de Uso de Vivienda N°1'
    expect(fixMojibakeArcGIS(limpio)).toBe(limpio)
  })

  it('no toca "â" cuando no precede a "°" (evita sobre-corrección)', () => {
    const texto = 'Café con leche y azúcar'
    expect(fixMojibakeArcGIS(texto)).toBe(texto)
  })

  it('devuelve el string sin cambios si no es mojibake reversible', () => {
    // Un solo "Ã" sin continuación válida — el decode debe fallar y
    // devolver el original tal cual, nunca lanzar ni corromper más.
    const noReversible = 'Texto con ' + String.fromCodePoint(0xc3) + ' suelto'
    expect(fixMojibakeArcGIS(noReversible)).toBe(noReversible)
  })

  it('maneja null y undefined', () => {
    expect(fixMojibakeArcGIS(null)).toBeNull()
    expect(fixMojibakeArcGIS(undefined)).toBeNull()
  })
})
