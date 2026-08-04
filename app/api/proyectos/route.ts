import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NuevoProyectoSchema } from '@/lib/schemas'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { persistZonificacionParaProyecto } from '@/lib/zonificacion-server'
import { reportError } from '@/lib/observability'
import { asegurarWorkspace } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    let query = supabase
      .from('proyectos')
      .select('*, cliente:clientes(*)')
      .order('created_at', { ascending: false })

    if (clienteId) query = query.eq('cliente_id', clienteId)

    const { data, error } = await query

    if (error) throw error

    return Response.json({ data: data ?? [], source: 'db' })
  } catch (err) {
    return apiError('Error al obtener proyectos', 500, err)
  }
}

interface NuevoProyectoExtra {
  direccion: string
  numero_expediente?: string
  fecha_inicio: string
  fecha_estimada?: string
  notas?: string
}

export async function POST(request: Request) {
  const raw = await request.json()
  const parsed = NuevoProyectoSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  // Merge Zod-validated core fields with the extra fields present in the raw body
  const extra = raw as NuevoProyectoExtra
  const body = { ...parsed.data, ...extra }

  const required = ['direccion', 'fecha_inicio'] as const
  for (const field of required) {
    if (!body[field]) {
      return Response.json({ error: `Campo requerido: ${field}` }, { status: 400 })
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Sin workspace_id el proyecto nace invisible para el resto del equipo:
    // la RLS lo dejaría ver solo a su creador por la red de seguridad.
    const ws = await asegurarWorkspace(supabase, user.id)

    const { data: proyecto, error } = await supabase
      .from('proyectos')
      .insert({
        user_id: user.id,
        workspace_id: ws.id,
        nombre: body.nombre,
        cliente_id: body.cliente_id,
        municipio: body.municipio,
        tipo: body.tipo,
        direccion: body.direccion,
        numero_expediente: body.numero_expediente ?? null,
        fecha_inicio: body.fecha_inicio,
        fecha_estimada: body.fecha_estimada ?? null,
        notas: body.notas ?? null,
        estado: 'borrador',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      return apiError('Error al crear proyecto', 500, error)
    }

    // Persistir datos SII que el usuario ya cargó en el formulario (SIIEnricher).
    // Antes se descartaban: el insert no los incluía. Con destino_sii persistido,
    // el flujo guiado de vía pre-informa el destino actual del inmueble.
    // Best-effort: si las columnas aún no existen (migración pendiente), se loguea
    // pero NO se rompe la creación (el proyecto ya quedó insertado).
    if (proyecto?.id) {
      const sii = raw as Record<string, unknown>
      const siiFields: Record<string, unknown> = {}
      if (typeof sii.rol_sii === 'string') siiFields.rol_sii = sii.rol_sii
      if (typeof sii.destino_sii === 'string') siiFields.destino_sii = sii.destino_sii
      if (typeof sii.avaluo_fiscal_clp === 'number') siiFields.avaluo_fiscal_clp = sii.avaluo_fiscal_clp
      if (typeof sii.avaluo_fiscal_uf === 'number') siiFields.avaluo_fiscal_uf = sii.avaluo_fiscal_uf
      if (typeof sii.superficie_terreno_m2 === 'number') siiFields.superficie_terreno_m2 = sii.superficie_terreno_m2
      if (typeof sii.superficie_construida_m2 === 'number') siiFields.superficie_construida_m2 = sii.superficie_construida_m2
      if (typeof sii.lat === 'number') siiFields.lat = sii.lat
      if (typeof sii.lng === 'number') siiFields.lng = sii.lng
      if (Object.keys(siiFields).length > 0) {
        const { error: siiErr } = await supabase.from('proyectos').update(siiFields).eq('id', proyecto.id)
        if (siiErr) {
          reportError(siiErr, {
            scope: 'api.proyectos.sii-fields-sync',
            extra: { proyectoId: proyecto.id },
          })
        }
      }
    }

    // Fallback de scraping SII: patente sin datos del enricher pero con rol.
    if (body.tipo === 'patente_comercial' && !(raw as Record<string, unknown>).destino_sii && proyecto?.id && body.numero_expediente) {
      const proyectoId = proyecto.id
      const rol = body.numero_expediente
      after(async () => {
        // Fire-and-forget: nunca debe fallar el request que ya respondió al
        // cliente. Pero "fire-and-forget" ya no significa "silencioso" — cada
        // rama que no persiste datos SII se reporta al funnel único (C8).
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
          const siiRes = await fetch(
            `${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(rol)}`,
            { method: 'GET' }
          )
          if (!siiRes.ok) {
            reportError(new Error(`SII lookup respondió HTTP ${siiRes.status}`), {
              scope: 'api.proyectos.sii-after.lookup-not-ok',
              extra: { proyectoId, rol, status: siiRes.status },
            })
            return
          }
          const siiData = await siiRes.json() as {
            ok?: boolean
            data?: {
              superficie_terreno_m2: number | null
              superficie_construida_m2: number | null
              destino: string
              direccion_normalizada?: string
            }
          }
          if (!siiData.ok || !siiData.data) {
            reportError(new Error('SII lookup respondió ok:false o sin data'), {
              scope: 'api.proyectos.sii-after.data-not-ok',
              extra: { proyectoId, rol, siiOk: siiData.ok },
            })
            return
          }
          const supabase = createServiceClient()
          const { error: updateErr } = await supabase
            .from('proyectos')
            .update({
              superficie_terreno_m2: siiData.data.superficie_terreno_m2 ?? null,
              superficie_construida_m2: siiData.data.superficie_construida_m2 ?? null,
              destino_sii: siiData.data.destino ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', proyectoId)
          if (updateErr) {
            reportError(updateErr, {
              scope: 'api.proyectos.sii-after.update-failed',
              extra: { proyectoId, rol },
            })
          }
        } catch (err) {
          reportError(err, {
            scope: 'api.proyectos.sii-after.unhandled',
            extra: { proyectoId, rol },
          })
        }
      })
    }

    // Zonificación: dispara el lookup ArcGIS/MINVU en background para todo
    // proyecto creado con dirección + municipio. resolveComunaZonificacion()
    // dentro del lookup route decide sin_cobertura — no se pre-filtra aquí.
    if (proyecto?.id && body.direccion && body.municipio) {
      const proyectoId = proyecto.id
      const direccionZona = body.direccion
      const municipioZona = body.municipio
      after(() => persistZonificacionParaProyecto(proyectoId, direccionZona, municipioZona))
    }

    return Response.json({ ok: true, id: proyecto.id })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
