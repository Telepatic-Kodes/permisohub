import { UF_FALLBACK_CLP } from '@/lib/uf'
import { createServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Port de lib/indicators.ts (repo origen PROPRA·BI) — fase 2 de la fusión.
// A diferencia de app/api/utils/uf/route.ts (que solo trackea UF), esto
// cubre UF/IPC/TPM/dólar — reusa UF_FALLBACK_CLP de lib/uf.ts pero vive en
// un archivo nuevo para no tocar la ruta/contrato de /api/utils/uf, que ya
// tiene ~5 llamadores dependiendo de su forma exacta.
//
// A diferencia del origen, NO se trackea desempleo — se pedía a
// mindicador.cl pero nunca se persistía ni usaba en ningún lado tampoco ahí;
// portarlo acá sería reintroducir a menor escala el mismo problema de "dato
// que nadie lee" que esta fase existe para corregir.
// ---------------------------------------------------------------------------

export interface MacroData {
  uf: number
  ufFecha: string | null
  ufFuente: 'live' | 'fallback'
  ipc: number | null
  tpm: number | null
  dolar: number | null
}

interface MindicadorResponse {
  serie: { valor: number; fecha: string }[]
}

async function fetchIndicador(nombre: string): Promise<{ valor: number; fecha: string | null } | null> {
  try {
    const res = await fetch(`https://mindicador.cl/api/${nombre}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as MindicadorResponse
    const entry = data.serie?.[0]
    if (entry == null) return null
    return { valor: entry.valor, fecha: entry.fecha ?? null }
  } catch {
    return null
  }
}

export async function fetchMacroData(): Promise<MacroData> {
  const [ufRes, ipcRes, dolarRes, tpmRes] = await Promise.allSettled([
    fetchIndicador('uf'),
    fetchIndicador('ipc'),
    fetchIndicador('dolar'),
    fetchIndicador('tpm'),
  ])

  const ufEntry = ufRes.status === 'fulfilled' ? ufRes.value : null
  const ufVal = ufEntry?.valor ?? null

  if (ufVal === null) {
    console.warn(`[indicadores-macro] mindicador.cl no disponible — usando fallback UF ${UF_FALLBACK_CLP}`)
  }

  return {
    uf: ufVal ?? UF_FALLBACK_CLP,
    ufFecha: ufEntry?.fecha ?? null,
    ufFuente: ufVal !== null ? 'live' : 'fallback',
    ipc: ipcRes.status === 'fulfilled' ? (ipcRes.value?.valor ?? null) : null,
    tpm: tpmRes.status === 'fulfilled' ? (tpmRes.value?.valor ?? null) : null,
    dolar: dolarRes.status === 'fulfilled' ? (dolarRes.value?.valor ?? null) : null,
  }
}

/**
 * Upsert del snapshot del día en indicadores_macro_historial — idempotente
 * por fecha_captura (UNIQUE), a diferencia de market_snapshots en el origen
 * (sin constraint, duplicaba filas en cada corrida).
 */
export async function persistirSnapshotMacro(data: MacroData): Promise<void> {
  const supabase = createServiceClient()
  const fechaCaptura = new Date().toISOString().slice(0, 10)

  const { error } = await supabase.from('indicadores_macro_historial').upsert(
    {
      fecha_captura: fechaCaptura,
      uf: data.uf,
      uf_fecha: data.ufFecha,
      uf_fuente: data.ufFuente,
      ipc: data.ipc,
      tpm: data.tpm,
      dolar: data.dolar,
      capturado_el: new Date().toISOString(),
    },
    { onConflict: 'fecha_captura', ignoreDuplicates: false },
  )

  if (error) throw new Error(`upsert de indicadores_macro_historial falló: ${error.message}`)
}
