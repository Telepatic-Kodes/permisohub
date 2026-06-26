import { createClient } from '@/lib/supabase/server'
import { sendEstadoChangeAlert } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ proyectoId: string }> }
) {
  const { proyectoId } = await params

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`general:${user.id}`)
  if (rateLimit) return rateLimit

  // Get project — RLS + explicit user_id filter for defense-in-depth
  const { data: proyecto, error: fetchError } = await supabase
    .from('proyectos')
    .select('*, clientes(*)')
    .eq('id', proyectoId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !proyecto) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Skip if no expedient number
  if (!proyecto.numero_expediente) {
    return Response.json({
      ok: true,
      message: 'No expediente number — manual tracking only',
      changed: false,
    })
  }

  // Call DOM en Línea scraper
  const scraperResponse = await fetch(
    new URL('/api/scraper/dom-en-linea', request.url).toString(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expedienteNumero: proyecto.numero_expediente,
        municipio: proyecto.municipio,
      }),
    }
  )

  const scraperData = (await scraperResponse.json()) as {
    ok: boolean
    estado?: string
    etapa?: string
    observaciones?: string
    simulated?: boolean
    error?: string
  }

  if (!scraperData.ok) {
    return Response.json(
      { error: scraperData.error ?? 'Scraper failed' },
      { status: 500 }
    )
  }

  const estadoAnterior = proyecto.estado
  const estadoNuevo = scraperData.estado ?? estadoAnterior
  const changed = estadoNuevo !== estadoAnterior

  if (changed) {
    // Update project in DB
    await supabase
      .from('proyectos')
      .update({
        estado: estadoNuevo,
        etapa_actual: scraperData.etapa ?? proyecto.etapa_actual,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proyectoId)

    // Log as comunicacion
    await supabase.from('comunicaciones').insert({
      proyecto_id: proyectoId,
      tipo: 'notificacion',
      fecha: new Date().toISOString().split('T')[0],
      asunto: `Estado actualizado automáticamente: ${estadoAnterior} → ${estadoNuevo}`,
      descripcion: scraperData.observaciones
        ? `Observaciones: ${scraperData.observaciones}`
        : 'Actualización obtenida de DOM en Línea',
      contacto: 'Sistema PermisoHub',
    })

    // Send alert if client has email
    const clientEmail = proyecto.clientes?.email
    if (clientEmail) {
      await sendEstadoChangeAlert({
        to: clientEmail,
        clienteNombre: proyecto.clientes?.nombre ?? 'Cliente',
        proyectoNombre: proyecto.nombre,
        estadoAnterior,
        estadoNuevo,
        descripcion: scraperData.observaciones ?? undefined,
      })
    }
  }

  return Response.json({
    ok: true,
    proyectoId,
    expedienteNumero: proyecto.numero_expediente,
    estadoAnterior,
    estadoNuevo,
    changed,
    simulated: scraperData.simulated ?? false,
    observaciones: scraperData.observaciones ?? null,
    fetchedAt: new Date().toISOString(),
  })
}
