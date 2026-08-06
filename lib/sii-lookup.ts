export interface SIIData {
  rol: string
  avaluo_fiscal_clp: number | null
  avaluo_fiscal_uf: number | null
  destino: string
  direccion_normalizada: string
  comuna: string
  lat: number | null
  lng: number | null
}

// ELIMINADO 06-08: superficie_terreno_m2 y superficie_construida_m2.
//
// El endpoint nuevo del SII no las expone (14 predios, 6 destinos, todos en 0 —
// la investigación completa está en la cabecera de lib/sii-lookup-server.ts).
// Se sacaron del tipo en vez de dejarlas en `number | null` porque un campo que
// estructuralmente nunca llega no es un dato faltante: es una promesa falsa. Con
// `| null` las tres vistas que las leían habrían seguido compilando y mostrando
// huecos para siempre; sacándolas, el compilador señaló exactamente los cuatro
// lugares que había que limpiar.
//
// Las columnas superficie_terreno_m2 / superficie_construida_m2 de la BD siguen
// existiendo y se llenan a mano — el SII ya no es una fuente para ellas.

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
