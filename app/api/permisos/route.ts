import { createClient } from '@/lib/supabase/server'
import { MOCK_PROYECTOS } from '@/lib/mock-data'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Proyecto, TipoPermiso, VigenciaPermiso } from '@/types'

export const dynamic = 'force-dynamic'

// Tipos de permiso que representan un permiso/trámite otorgado con vigencia
const TIPOS_PERMISO: TipoPermiso[] = [
  'permiso_edificacion',
  'recepcion_final',
  'obra_menor_con_permiso',
  'obra_menor_sin_permiso',
  'ampliacion',
  'cambio_destino',
  'anteproyecto',
  'supervision_apertura',
]

const MS_POR_DIA = 1000 * 60 * 60 * 24

export type ProyectoConVigencia = Proyecto & {
  vigencia: VigenciaPermiso
  dias_restantes: number | null
}

// Fecha "hoy" normalizada a medianoche (timezone del servidor)
function hoyMedianoche(): Date {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
}

function parseFecha(fecha: string): Date | null {
  const d = new Date(`${fecha}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function calcVigencia(fecha?: string): VigenciaPermiso {
  if (!fecha) return 'sin_fecha'
  const vence = parseFecha(fecha)
  if (!vence) return 'sin_fecha'

  const hoy = hoyMedianoche()
  if (hoy.getTime() > vence.getTime()) return 'vencido'

  const diffDias = Math.round((vence.getTime() - hoy.getTime()) / MS_POR_DIA)
  if (diffDias <= 30) return 'por_vencer'
  return 'vigente'
}

function calcDiasRestantes(fecha?: string): number | null {
  if (!fecha) return null
  const vence = parseFecha(fecha)
  if (!vence) return null
  const hoy = hoyMedianoche()
  return Math.round((vence.getTime() - hoy.getTime()) / MS_POR_DIA)
}

function withVigencia(proyecto: Proyecto): ProyectoConVigencia {
  return {
    ...proyecto,
    vigencia: calcVigencia(proyecto.fecha_vencimiento_permiso),
    dias_restantes: calcDiasRestantes(proyecto.fecha_vencimiento_permiso),
  }
}

function buildResumen(permisos: ProyectoConVigencia[]) {
  return {
    total: permisos.length,
    vigentes: permisos.filter((p) => p.vigencia === 'vigente').length,
    por_vencer: permisos.filter((p) => p.vigencia === 'por_vencer').length,
    vencidos: permisos.filter((p) => p.vigencia === 'vencido').length,
    sin_fecha: permisos.filter((p) => p.vigencia === 'sin_fecha').length,
  }
}

function isTipoPermiso(tipo: TipoPermiso): boolean {
  return TIPOS_PERMISO.includes(tipo)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const vigencia = searchParams.get('vigencia') as VigenciaPermiso | null
  const municipio = searchParams.get('municipio')
  const clienteId = searchParams.get('clienteId')

  function applyFilters(permisos: ProyectoConVigencia[]): ProyectoConVigencia[] {
    return permisos.filter((p) => {
      if (vigencia && p.vigencia !== vigencia) return false
      if (municipio && p.municipio !== municipio) return false
      if (clienteId && p.cliente_id !== clienteId) return false
      return true
    })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    let query = supabase
      .from('proyectos')
      .select('*, cliente:clientes(*)')
      .in('tipo', TIPOS_PERMISO)
      .order('created_at', { ascending: false })

    if (clienteId) query = query.eq('cliente_id', clienteId)
    if (municipio) query = query.eq('municipio', municipio)

    const { data, error } = await query

    if (error) throw error

    const conVigencia = (data ?? []).map((p: Proyecto) => withVigencia(p))
    const permisos = applyFilters(conVigencia)

    return Response.json({
      ok: true,
      permisos,
      resumen: buildResumen(permisos),
      source: 'db',
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const conVigencia = MOCK_PROYECTOS.filter((p) => isTipoPermiso(p.tipo)).map(
        (p) => withVigencia(p),
      )
      const permisos = applyFilters(conVigencia)

      return Response.json({
        ok: true,
        permisos,
        resumen: buildResumen(permisos),
        source: 'mock',
      })
    }
    return Response.json({ error: 'Error al obtener permisos' }, { status: 500 })
  }
}
