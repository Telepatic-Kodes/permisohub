import { describe, expect, it } from 'vitest'
import { destinoSiiCoincideConTipo } from '@/lib/propiedades-portafolio-server'

describe('destinoSiiCoincideConTipo', () => {
  it('coincide cuando el destino declara el mismo tipo', () => {
    expect(destinoSiiCoincideConTipo('OFICINA', 'oficina')).toBe(true)
    expect(destinoSiiCoincideConTipo('LOCAL COMERCIAL', 'local_comercial')).toBe(true)
    expect(destinoSiiCoincideConTipo('BODEGAJE', 'bodega')).toBe(true)
    expect(destinoSiiCoincideConTipo('GALPON INDUSTRIAL', 'industrial')).toBe(true)
  })

  it('no coincide cuando el destino declara claramente otro tipo conocido', () => {
    expect(destinoSiiCoincideConTipo('OFICINA', 'bodega')).toBe(false)
    expect(destinoSiiCoincideConTipo('BODEGA', 'oficina')).toBe(false)
  })

  it('devuelve null (no fabrica un mismatch) cuando el destino es ambiguo', () => {
    expect(destinoSiiCoincideConTipo('SITIO NO EDIFICADO', 'oficina')).toBeNull()
    expect(destinoSiiCoincideConTipo('HABITACION PARTICULAR', 'local_comercial')).toBeNull()
  })

  it('devuelve null (no fabrica un match) cuando el destino calza con el tipo declarado Y con otro a la vez', () => {
    // "BODEGA Y LOCAL COMERCIAL" calza con bodega Y con local_comercial —
    // afirmar "coincide" acá ocultaría un mismatch real posible.
    expect(destinoSiiCoincideConTipo('BODEGA Y LOCAL COMERCIAL', 'local_comercial')).toBeNull()
    expect(destinoSiiCoincideConTipo('BODEGA Y LOCAL COMERCIAL', 'bodega')).toBeNull()
  })

  it('no coincide cuando el destino calza con dos tipos y NINGUNO es el declarado', () => {
    expect(destinoSiiCoincideConTipo('BODEGA Y LOCAL COMERCIAL', 'oficina')).toBe(false)
  })
})
