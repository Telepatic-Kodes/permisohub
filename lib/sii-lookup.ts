export interface SIIData {
  rol: string
  avaluo_fiscal_clp: number
  avaluo_fiscal_uf: number | null
  superficie_terreno_m2: number
  superficie_construida_m2: number
  destino: string
  direccion_normalizada: string
  lat?: number
  lng?: number
}

// ELIMINADO 05-08: lookupSIIByAddress, lookupSIIByRol, SIILookupResponse.
//
// No solo estaban sin usar (check:orphans): declaraban una forma de respuesta
// que /api/sii/lookup NO devuelve. La ruta responde `{ ok, rol, data }` con el
// rol al NIVEL SUPERIOR, mientras SIILookupResponse lo ponía dentro de `data`
// y marcaba como no-anulables campos que sí lo son. Quien las hubiera
// "conectado" habría leído undefined con la bendición de TypeScript.
// components/proyecto/sii-enricher.tsx hace el fetch a mano justamente porque
// mapea la forma REAL (ver su LookupAPIResponse).
//
// Además lookupSIIByAddress(direccion, comuna) llamaba a un endpoint que solo
// resuelve por rol — ya documentado en lib/tasacion-prompts.ts:10.
//
// El camino vivo para servidor es buscarDatosSIIPorRol() en
// lib/sii-lookup-server.ts. Acá quedan solo el tipo SIIData (lo importan 4
// vistas) y formatDestinoSII (avaluo-fiscal-card).

export function formatDestinoSII(destino: string): string {
  const map: Record<string, string> = {
    "CASA HABITACION": "Casa habitación",
    "DEPARTAMENTO": "Departamento",
    "COMERCIO": "Comercio",
    "INDUSTRIA": "Industrial",
    "BODEGA": "Bodega",
    "OFICINA": "Oficina",
    "ESTACIONAMIENTO": "Estacionamiento",
    "TERRENO SIN CONSTRUIR": "Terreno sin construir",
    "LOCAL COMERCIAL": "Local comercial",
    "EDUCACION": "Educación",
    "SALUD": "Salud",
  }
  return map[destino.toUpperCase()] ?? destino
}
