export interface SIIData {
  rol: string
  avaluo_fiscal_clp: number
  superficie_terreno_m2: number
  superficie_construida_m2: number
  destino: string
  direccion_normalizada: string
  lat?: number
  lng?: number
}

export interface SIILookupResponse {
  ok: boolean
  data?: SIIData
  error?: string
}

export async function lookupSIIByAddress(
  direccion: string,
  comuna: string,
): Promise<SIILookupResponse> {
  const params = new URLSearchParams({ direccion, comuna })
  const res = await fetch(`/api/sii/lookup?${params.toString()}`)
  return res.json() as Promise<SIILookupResponse>
}

export async function lookupSIIByRol(rol: string): Promise<SIILookupResponse> {
  const params = new URLSearchParams({ rol })
  const res = await fetch(`/api/sii/lookup?${params.toString()}`)
  return res.json() as Promise<SIILookupResponse>
}

export function formatRolSII(rol: string): string {
  // Normalize to XXXX-YYYY display format
  return rol.replace(/[^0-9-]/g, "")
}

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
