import { createServiceClient } from '@/lib/supabase/service'
import type { ZonaLookupResponse } from '@/lib/zonificacion'

/**
 * Server-only. Triggers the zonificación lookup for a proyecto's current
 * direccion+municipio and persists the result onto proyectos.zona_* with an
 * explicit zona_status in EVERY branch, including failure.
 *
 * The codebase has an existing precedent for this exact shape of bug: the
 * SII after() fallback in app/api/proyectos/route.ts uses a bare, silent
 * catch block that makes "not yet checked" indistinguishable from "checked
 * and failed" (PITFALLS.md Pitfall 6). Do not repeat that here
 * — zonificación is decision-relevant (feeds due-diligence/via-tramitación in
 * a later phase), so every code path below writes zona_status explicitly and
 * logs on failure, even though the outer trigger stays fire-and-forget
 * (wrapped in after()) for response-time UX.
 */
export async function persistZonificacionParaProyecto(
  proyectoId: string,
  direccion: string,
  municipio: string,
  options?: { force?: boolean },
): Promise<void> {
  const admin = createServiceClient()
  const nowIso = new Date().toISOString()

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
    const params = new URLSearchParams({
      direccion,
      comuna: municipio,
      ...(options?.force ? { force: 'true' } : {}),
    })
    const res = await fetch(`${baseUrl}/api/zonificacion/lookup?${params.toString()}`)
    const json = (await res.json()) as ZonaLookupResponse

    if (json.status === 'encontrado' && json.data) {
      await admin.from('proyectos').update({
        zona_status: 'encontrado',
        zona_origen: 'automatico',
        zona_cache_id: json.data.cacheId || null,
        zona_codigo: json.data.zona,
        zona_sector: json.data.sector,
        zona_nombre: json.data.nombreZona,
        zona_uperm: json.data.uperm,
        zona_uproh: json.data.uproh,
        zona_usos_disponibles: json.data.usosDisponibles,
        zona_fuente_url: json.data.fuenteUrl,
        zona_consultada_el: json.data.consultadoEl,
      }).eq('id', proyectoId)
      return
    }

    if (json.status === 'sin_cobertura') {
      await admin.from('proyectos').update({
        zona_status: 'sin_cobertura',
        zona_consultada_el: nowIso,
      }).eq('id', proyectoId)
      return
    }

    // status === 'error' — geocoding failed, ArcGIS failed, shape mismatch,
    // or "no zone at this exact point". Still an explicit, logged write.
    console.warn(`[zonificacion] Lookup en estado 'error' para proyecto ${proyectoId}: ${json.error ?? 'sin detalle'}`)
    await admin.from('proyectos').update({
      zona_status: 'error',
      zona_consultada_el: nowIso,
    }).eq('id', proyectoId)
  } catch (err) {
    console.error(`[zonificacion] Excepción no capturada al enriquecer proyecto ${proyectoId}:`, err instanceof Error ? err.message : err)
    await admin.from('proyectos').update({
      zona_status: 'error',
      zona_consultada_el: nowIso,
    }).eq('id', proyectoId)
  }
}
