import { createClient } from '@/lib/supabase/server'
import { calcularEstadoBoleta, calcularCumplimientoPct } from '@/lib/boletas'
import type { EstadoBoleta, ResumenCumplimientoBoletas } from '@/types'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cadenaId } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Obtener locales de la cadena con sus centros
    const { data: locales, error: localesError } = await supabase
      .from('locales')
      .select(`
        id, numero, uso,
        centro:centros_comerciales!inner(id, nombre, cadena_id)
      `)
      .eq('centros_comerciales.cadena_id', cadenaId)

    if (localesError) throw localesError
    if (!locales || locales.length === 0) {
      return Response.json({ data: [] })
    }

    const localIds = locales.map((l) => l.id)

    // Obtener todas las boletas de esos locales (último período por servicio)
    const { data: boletas, error: boletasError } = await supabase
      .from('boletas_servicios')
      .select('local_id, tipo_servicio, estado, fecha_vencimiento, periodo')
      .in('local_id', localIds)
      .order('periodo', { ascending: false })

    if (boletasError) throw boletasError

    // Agrupar: para cada local tomar la boleta más reciente por tipo de servicio
    const boletaMap = new Map<string, Map<string, { estado: EstadoBoleta; fecha_vencimiento?: string }>>()

    for (const b of boletas ?? []) {
      if (!boletaMap.has(b.local_id)) {
        boletaMap.set(b.local_id, new Map())
      }
      const servicioMap = boletaMap.get(b.local_id)!
      if (!servicioMap.has(b.tipo_servicio)) {
        const estado = calcularEstadoBoleta(b.fecha_vencimiento)
        servicioMap.set(b.tipo_servicio, { estado, fecha_vencimiento: b.fecha_vencimiento })
      }
    }

    const resultado: ResumenCumplimientoBoletas[] = locales.map((local) => {
      const servicios = boletaMap.get(local.id) ?? new Map()
      const agua:         EstadoBoleta = servicios.get('agua')?.estado         ?? 'pendiente'
      const electricidad: EstadoBoleta = servicios.get('electricidad')?.estado ?? 'pendiente'
      const gas:          EstadoBoleta = servicios.get('gas')?.estado           ?? 'pendiente'

      return {
        local_id:        local.id,
        local_numero:    local.numero,
        centro_nombre:   (local.centro as unknown as { nombre: string })?.nombre ?? '',
        agua,
        electricidad,
        gas,
        cumplimiento_pct: calcularCumplimientoPct(agua, electricidad, gas),
      }
    })

    return Response.json({ data: resultado })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ data: MOCK_RESUMEN })
    }
    return apiError('Error interno', 500, err)
  }
}

const MOCK_RESUMEN: ResumenCumplimientoBoletas[] = [
  { local_id: 'l1', local_numero: 'L-101', centro_nombre: 'Mall Central', agua: 'vigente', electricidad: 'por_vencer', gas: 'pendiente', cumplimiento_pct: 33 },
  { local_id: 'l2', local_numero: 'L-202', centro_nombre: 'Mall Central', agua: 'vencida', electricidad: 'vigente',    gas: 'vigente',   cumplimiento_pct: 67 },
  { local_id: 'l3', local_numero: 'L-303', centro_nombre: 'Sucursal Norte', agua: 'vigente', electricidad: 'vigente', gas: 'vigente',   cumplimiento_pct: 100 },
  { local_id: 'l4', local_numero: 'L-404', centro_nombre: 'Sucursal Norte', agua: 'pendiente', electricidad: 'pendiente', gas: 'pendiente', cumplimiento_pct: 0 },
]
