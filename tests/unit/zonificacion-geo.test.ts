import { describe, expect, it } from 'vitest'

import { esriRingsToGeoJSON } from '@/lib/zonificacion-geo'

describe('esriRingsToGeoJSON', () => {
  it('converts a valid single-ring polygon', () => {
    const input = { rings: [[[-70.5, -33.4], [-70.4, -33.4], [-70.4, -33.3], [-70.5, -33.4]]] }
    expect(esriRingsToGeoJSON(input)).toEqual({ type: 'Polygon', coordinates: input.rings })
  })
  it('returns null for missing/malformed geometry', () => {
    expect(esriRingsToGeoJSON(null)).toBeNull()
    expect(esriRingsToGeoJSON(undefined)).toBeNull()
    expect(esriRingsToGeoJSON({})).toBeNull()
    expect(esriRingsToGeoJSON({ rings: [] })).toBeNull()
    expect(esriRingsToGeoJSON({ rings: 'not-an-array' })).toBeNull()
  })
})
