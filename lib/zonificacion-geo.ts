// Convierte geometría Esri JSON (esriGeometryPolygon: {rings:[[[x,y],...]]})
// a un Polygon GeoJSON. Alcance deliberadamente angosto: un solo tipo de
// geometría, sin donuts/holes/curvas — lo único que las 4 capas PRC
// registradas en lib/zonificacion-comunas.ts retornan hoy. Ver "Don't
// Hand-Roll", 11-RESEARCH.md.
export interface EsriPolygonGeometry {
  rings: number[][][]
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export function esriRingsToGeoJSON(geometry: unknown): GeoJSONPolygon | null {
  if (
    !geometry ||
    typeof geometry !== 'object' ||
    !('rings' in geometry) ||
    !Array.isArray((geometry as EsriPolygonGeometry).rings) ||
    (geometry as EsriPolygonGeometry).rings.length === 0
  ) {
    return null
  }
  return { type: 'Polygon', coordinates: (geometry as EsriPolygonGeometry).rings }
}
