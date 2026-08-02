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
})
