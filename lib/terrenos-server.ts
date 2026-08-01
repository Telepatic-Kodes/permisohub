import { createServiceClient } from '@/lib/supabase/service'
import type { ZonaLookupResponse } from '@/lib/zonificacion'
import { obtenerLatLngDetalle as obtenerLatLngDetallePortalinmobiliario } from '@/lib/scrapers/portalinmobiliario'
import { obtenerLatLngDetalle as obtenerLatLngDetalleDoomos } from '@/lib/scrapers/doomos'
import { obtenerLatLngDetalle as obtenerLatLngDetalleYapo } from '@/lib/scrapers/yapo'
import { upsertTerrenosDesdeListado, type TerrenoListadoRaw, type FuenteTerreno } from '@/lib/scrapers/terrenos-common'
import { verificarCompatibilidadUso } from '@/lib/zonificacion-compat'
import { fixMojibakeArcGIS } from '@/lib/zonificacion-format'
import { USO_COMERCIAL_PROMPT } from '@/lib/terrenos-comercial'
import { obtenerSenalesUbicacion, OverpassUnavailableError } from '@/lib/terrenos-ubicacion'

// Extractor de lat/lng preciso desde la página de DETALLE de un aviso, por
// fuente — ver el punto 2 de la prioridad documentada en enriquecerTerreno.
// PortalTerreno no está acá porque ya entrega lat/lng en su propio JSON de
// listado (persistido directo en la fila, prioridad 1) — no necesita esto.
const OBTENER_LATLNG_DETALLE: Partial<Record<FuenteTerreno, (url: string) => Promise<{ lat: number; lng: number } | null>>> = {
  portalinmobiliario: obtenerLatLngDetallePortalinmobiliario,
  doomos: obtenerLatLngDetalleDoomos,
  yapo: obtenerLatLngDetalleYapo,
}

/**
 * Server-only. Enriquece un terreno con zonificación (PRC) + SII, reusando
 * las mismas rutas internas que ya sirven a Proyecto — nunca reimplementar
 * geocoding/ArcGIS/SII aquí (Pitfall 2: un único adaptador por fuente externa).
 *
 * Mismo principio que persistZonificacionParaProyecto (lib/zonificacion-server.ts):
 * zona_status se escribe explícitamente en TODA rama, incluida la de error —
 * "pendiente" nunca debe quedar indistinguible de "consultado y sin resultado".
 */
export async function enriquecerTerreno(terrenoId: string, options?: { force?: boolean }): Promise<void> {
  const admin = createServiceClient()
  const nowIso = new Date().toISOString()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'

  const { data: terreno } = await admin
    .from('terrenos')
    .select('direccion, comuna, rol_sii, fuente, url_aviso, lat, lng, uso_comercial_status, ubicacion_status')
    .eq('id', terrenoId)
    .single()

  if (!terreno?.direccion || !terreno?.comuna) {
    console.warn(`[terrenos] Terreno ${terrenoId} sin dirección/comuna — no se puede enriquecer`)
    return
  }

  // Prioridad de lat/lng preciso (evita Nominatim cuando ya hay algo mejor):
  // 1. Ya persistido en la fila — algunas fuentes (ej. PortalTerreno) entregan
  //    lat/lng resuelto en su propio JSON al momento del scrape.
  // 2. Página de DETALLE del aviso (Portalinmobiliario, Doomos) — su texto de
  //    "dirección" en el listado suele ser el título/sector del aviso, no
  //    geocodificable por Nominatim en la mayoría de los casos (verificado en
  //    vivo, ~80% de fallos en Portalinmobiliario), pero la página de detalle
  //    incrusta un mapa con las coordenadas que el sitio ya resolvió.
  // 3. Ninguno — cae al geocoding por texto de siempre dentro del lookup.
  const obtenerDetalle = OBTENER_LATLNG_DETALLE[terreno.fuente as FuenteTerreno]
  const latLngPreciso = terreno.lat != null && terreno.lng != null
    ? { lat: terreno.lat, lng: terreno.lng }
    : obtenerDetalle && terreno.url_aviso
      ? await obtenerDetalle(terreno.url_aviso)
      : null

  // Mejor punto conocido para las señales de ubicación (independiente de que
  // la zonificación se resuelva o no — un terreno en comuna sin cobertura
  // igual puede tener lat/lng precisos y merece su señal de "cerca de
  // avenida principal"). Se actualiza más abajo si el lookup de zonificación
  // geocodifica un punto nuevo.
  let puntoUbicacion = latLngPreciso

  // 1. Zonificación (mismo flujo que persistZonificacionParaProyecto).
  try {
    const params = new URLSearchParams({
      direccion: terreno.direccion,
      comuna: terreno.comuna,
      ...(options?.force ? { force: 'true' } : {}),
      ...(latLngPreciso ? { lat: String(latLngPreciso.lat), lng: String(latLngPreciso.lng) } : {}),
    })
    const res = await fetch(`${baseUrl}/api/zonificacion/lookup?${params.toString()}`)
    const json = (await res.json()) as ZonaLookupResponse

    if (json.status === 'encontrado' && json.data) {
      puntoUbicacion = { lat: json.data.lat, lng: json.data.lng }

      await admin.from('terrenos').update({
        zona_status: 'encontrado',
        zona_cache_id: json.data.cacheId || null,
        zona_codigo: json.data.zona,
        zona_sector: json.data.sector,
        zona_nombre: json.data.nombreZona,
        zona_uperm: json.data.uperm,
        zona_uproh: json.data.uproh,
        zona_usos_disponibles: json.data.usosDisponibles,
        zona_fuente_url: json.data.fuenteUrl,
        zona_consultada_el: json.data.consultadoEl,
        lat: json.data.lat,
        lng: json.data.lng,
        updated_at: nowIso,
      }).eq('id', terrenoId)

      // Capa de filtrado por potencial comercial (conversación 31 jul 2026):
      // clasifica una sola vez por terreno — nunca re-consultar la IA en un
      // "Actualizar" posterior de zonificación, el veredicto de uso permitido
      // no cambia aunque se refresque el punto geocodificado.
      if (terreno.uso_comercial_status === 'pendiente') {
        try {
          const resultado = await verificarCompatibilidadUso(
            USO_COMERCIAL_PROMPT,
            fixMojibakeArcGIS(json.data.uperm),
            fixMojibakeArcGIS(json.data.uproh),
            json.data.usosDisponibles,
          )
          await admin.from('terrenos').update({
            uso_comercial_status: resultado.estado,
            uso_comercial_justificacion: resultado.justificacion,
            uso_comercial_consultado_el: new Date().toISOString(),
          }).eq('id', terrenoId)
        } catch (err) {
          // Best-effort: si falla, uso_comercial_status queda en 'pendiente'
          // — se reintenta en el próximo enriquecimiento, nunca se inventa
          // un veredicto por una excepción de red/IA.
          console.warn(`[terrenos] No se pudo clasificar uso comercial de ${terrenoId}:`, err instanceof Error ? err.message : err)
        }
      }
    } else if (json.status === 'sin_cobertura') {
      await admin.from('terrenos').update({
        zona_status: 'sin_cobertura',
        zona_consultada_el: nowIso,
        updated_at: nowIso,
      }).eq('id', terrenoId)
    } else {
      console.warn(`[terrenos] Lookup de zonificación en estado 'error' para terreno ${terrenoId}: ${json.error ?? 'sin detalle'}`)
      await admin.from('terrenos').update({
        zona_status: 'error',
        zona_consultada_el: nowIso,
        updated_at: nowIso,
      }).eq('id', terrenoId)
    }
  } catch (err) {
    console.error(`[terrenos] Excepción no capturada al consultar zonificación de ${terrenoId}:`, err instanceof Error ? err.message : err)
    await admin.from('terrenos').update({
      zona_status: 'error',
      zona_consultada_el: nowIso,
      updated_at: nowIso,
    }).eq('id', terrenoId)
  }

  // 1.5 Señales de ubicación (cercanía a avenida principal + anchors
  // comerciales) — capa de detección de oportunidades, conversación 1 ago
  // 2026. Corre una sola vez por terreno (igual que uso comercial) e
  // independiente del resultado de zonificación: usa puntoUbicacion, que
  // puede venir de la fuente, del truco de detalle, o del geocoding recién
  // resuelto arriba — un terreno en comuna sin cobertura igual puede tener
  // coordenadas válidas.
  if (terreno.ubicacion_status === 'pendiente' && puntoUbicacion) {
    try {
      const senales = await obtenerSenalesUbicacion(puntoUbicacion.lat, puntoUbicacion.lng)
      if (senales) {
        await admin.from('terrenos').update({
          ubicacion_status: 'resuelto',
          cerca_avenida_principal: senales.cercaAvenidaPrincipal,
          anchors_comerciales_cercanos: senales.anchorsComercialesCercanos,
          ubicacion_consultada_el: new Date().toISOString(),
        }).eq('id', terrenoId)
      } else {
        await admin.from('terrenos').update({
          ubicacion_status: 'error',
          ubicacion_consultada_el: new Date().toISOString(),
        }).eq('id', terrenoId)
      }
    } catch (err) {
      if (err instanceof OverpassUnavailableError) {
        // Overpass no disponible ahora (saturado, con la IP bloqueada, red
        // caída) — no dice nada del terreno. Se deja 'pendiente' a propósito
        // para que un enriquecimiento futuro lo reintente. Marcarlo 'error'
        // acá lo dejaría enterrado para siempre (solo se reintenta si el
        // status sigue en 'pendiente').
        console.warn(`[terrenos] Overpass no disponible para ${terrenoId} (${err.message}), se reintenta en un enriquecimiento futuro`)
      } else {
        console.warn(`[terrenos] No se pudieron obtener señales de ubicación de ${terrenoId}:`, err instanceof Error ? err.message : err)
        await admin.from('terrenos').update({
          ubicacion_status: 'error',
          ubicacion_consultada_el: new Date().toISOString(),
        }).eq('id', terrenoId)
      }
    }
  }

  // 2. SII por rol, best-effort — igual que el fallback de app/api/proyectos/route.ts.
  if (terreno.rol_sii) {
    try {
      const siiRes = await fetch(`${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(terreno.rol_sii)}`)
      if (siiRes.ok) {
        const siiData = await siiRes.json() as {
          ok?: boolean
          data?: {
            avaluo_fiscal_clp: number | null
            avaluo_fiscal_uf: number | null
            superficie_terreno_m2: number | null
            superficie_construida_m2: number | null
            destino: string
          }
        }
        if (siiData.ok && siiData.data) {
          await admin.from('terrenos').update({
            avaluo_fiscal_clp: siiData.data.avaluo_fiscal_clp,
            avaluo_fiscal_uf: siiData.data.avaluo_fiscal_uf,
            superficie_terreno_m2: siiData.data.superficie_terreno_m2,
            superficie_construida_m2: siiData.data.superficie_construida_m2,
            destino_sii: siiData.data.destino || null,
            updated_at: new Date().toISOString(),
          }).eq('id', terrenoId)
        }
      }
    } catch (err) {
      // Best-effort: SII scraping fallando no debe bloquear el resto del enriquecimiento.
      console.warn(`[terrenos] SII no disponible para terreno ${terrenoId}:`, err instanceof Error ? err.message : err)
    }
  }
}

export interface ResultadoDescubrimiento {
  encontrados: number
  guardados: number
  enriquecidos: number
  diferidos: number
  errors: string[]
}

// Enriquecer implica (en el peor caso) Nominatim (throttle 1.1s) + ArcGIS +
// SII por terreno — acotado por corrida para no arriesgar el timeout de
// function serverless (Pitfall ya documentado en este repo para el cron
// weekly-summary). Los terrenos no alcanzados quedan zona_status='pendiente'
// y se recogen en la corrida siguiente — nunca se pierden, solo se difieren.
const MAX_ENRIQUECER_POR_COMUNA = 5

/**
 * Orquestación común a cualquier cron de descubrimiento de terrenos (ver
 * app/api/scraper/portalinmobiliario y .../portalterreno): busca por comuna,
 * upsert deduplicado, y enriquece solo los que quedaron 'pendiente' (nunca
 * re-enriquece uno ya resuelto en una corrida previa), con el mismo tope por
 * comuna. Un solo lugar para esta lógica evita que cada fuente nueva la
 * reimplemente ligeramente distinto.
 */
export async function correrDescubrimientoTerrenos(
  comunas: string[],
  buscarTerrenos: (comunaId: string) => Promise<TerrenoListadoRaw[]>,
  workspaceId: string,
  fuenteLabel: string,
): Promise<ResultadoDescubrimiento> {
  const admin = createServiceClient()
  const results: ResultadoDescubrimiento = { encontrados: 0, guardados: 0, enriquecidos: 0, diferidos: 0, errors: [] }

  for (const comunaId of comunas) {
    try {
      const items = await buscarTerrenos(comunaId)
      results.encontrados += items.length
      if (items.length === 0) continue

      const { ids } = await upsertTerrenosDesdeListado(items, workspaceId)
      results.guardados += ids.length

      const { data: pendientes } = await admin
        .from('terrenos')
        .select('id')
        .in('id', ids)
        .eq('zona_status', 'pendiente')

      const aEnriquecer = (pendientes ?? []).slice(0, MAX_ENRIQUECER_POR_COMUNA)
      const diferidos = (pendientes?.length ?? 0) - aEnriquecer.length
      if (diferidos > 0) {
        console.warn(`[${fuenteLabel}] ${diferidos} terreno(s) nuevos de "${comunaId}" quedan pendientes para la próxima corrida (límite ${MAX_ENRIQUECER_POR_COMUNA}/comuna)`)
        results.diferidos += diferidos
      }

      for (const row of aEnriquecer) {
        await enriquecerTerreno(row.id)
        results.enriquecidos++
      }
    } catch (err) {
      results.errors.push(`${comunaId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return results
}
