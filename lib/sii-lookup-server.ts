// Server-only. Único punto de llamada a /api/sii/lookup para rutas de IA
// (tasación, due-diligence-propiedad) — evita que cada ruta reimplemente el
// mismo fetch-con-forwarding-de-cookie. NO reemplaza lib/sii-lookup.ts (ese
// es el wrapper client-safe usado por SIIEnricher).

export interface SIILookupServerData {
  rol: string
  direccion_normalizada: string
  comuna: string
  destino: string
  avaluo_fiscal_clp: number | null
  avaluo_fiscal_uf: number | null
  superficie_terreno_m2: number | null
  superficie_construida_m2: number | null
}

// Best-effort/no lanza — si el SII no responde o el rol no existe, quien
// llama debe seguir sin cruce fiscal (mismo criterio que buscarDatosSII en
// app/api/tasacion/route.ts, del cual se extrajo esta función).
export async function buscarDatosSIIPorRol(
  rol: string,
  cookieHeader: string | null,
): Promise<SIILookupServerData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    // La ruta interna ya acota el fetch al SII (fetchWithTimeout, 15s), pero
    // nada acotaba este salto propio — un self-request colgado se comía el
    // maxDuration completo de Tasación/Due Diligence (120s) antes de que
    // saliera un solo token del stream.
    const res = await fetch(`${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(rol)}`, {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { ok?: boolean; rol?: string; data?: Omit<SIILookupServerData, 'rol'> }
    if (!json.ok || !json.data) return null
    return { ...json.data, rol: json.rol ?? rol }
  } catch (err) {
    console.warn('[sii-lookup-server] SII lookup falló (best-effort, continúa sin cruce fiscal):', err instanceof Error ? err.message : err)
    return null
  }
}
