import { createClient } from '@/lib/supabase/server'
import { calcularEstadoBoleta } from '@/lib/boletas'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const localId   = searchParams.get('local_id')
  const cadenaId  = searchParams.get('cadena_id')
  const tipo      = searchParams.get('tipo')
  const periodo   = searchParams.get('periodo')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    let query = supabase
      .from('boletas_servicios')
      .select(`
        *,
        local:locales(
          id, numero, uso,
          centro:centros_comerciales(id, nombre)
        )
      `)
      .order('periodo', { ascending: false })
      .order('created_at', { ascending: false })

    if (localId)  query = query.eq('local_id', localId)
    if (tipo)     query = query.eq('tipo_servicio', tipo)
    if (periodo)  query = query.eq('periodo', periodo)

    if (cadenaId) {
      const { data: localeIds } = await supabase
        .from('locales')
        .select('id, centros_comerciales!inner(cadena_id)')
        .eq('centros_comerciales.cadena_id', cadenaId)

      const ids = (localeIds ?? []).map((l) => l.id)
      if (ids.length === 0) return Response.json({ data: [] })
      query = query.in('local_id', ids)
    }

    const { data, error } = await query
    if (error) throw error

    return Response.json({ data: data ?? [] })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}

interface NuevoBoletaBody {
  local_id: string
  tipo_servicio: string
  proveedor: string
  numero_cuenta?: string
  periodo: string
  url?: string
  fecha_emision?: string
  fecha_vencimiento?: string
  monto_clp?: number
  tramite_tipo?: string
  notas?: string
}

export async function POST(request: Request) {
  const body = await request.json() as NuevoBoletaBody

  if (!body.local_id || !body.tipo_servicio || !body.proveedor || !body.periodo) {
    return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const estado = calcularEstadoBoleta(body.fecha_vencimiento ?? null)

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data: boleta, error } = await supabase
      .from('boletas_servicios')
      .upsert({
        local_id:          body.local_id,
        tipo_servicio:     body.tipo_servicio,
        proveedor:         body.proveedor,
        numero_cuenta:     body.numero_cuenta ?? null,
        periodo:           body.periodo,
        url:               body.url ?? null,
        fecha_emision:     body.fecha_emision ?? null,
        fecha_vencimiento: body.fecha_vencimiento ?? null,
        monto_clp:         body.monto_clp ?? null,
        estado,
        tramite_tipo:      body.tramite_tipo ?? null,
        notas:             body.notas ?? null,
      }, {
        onConflict: 'local_id,tipo_servicio,periodo',
        ignoreDuplicates: false,
      })
      .select('*')
      .single()

    if (error) {
      return apiError('Error interno', 500, error)
    }

    return Response.json({ ok: true, id: boleta.id, boleta })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
