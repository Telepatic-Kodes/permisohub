import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

type EstadoPermiso = 'vigente' | 'vencido' | 'sin_permiso' | 'en_tramite'

type LocalCompliance = {
  id: string
  numero: string
  nombre_negocio: string
  centro_nombre: string
  municipio: string
  uso: string
  area_m2: number
  estado_permiso: EstadoPermiso
  numero_permiso: string | null
  fecha_vencimiento: string | null
  especialidades_obtenidas: number
  especialidades_total: number
  observaciones_abiertas: number
  dom_digital_url: string | null
}

type CentroCompliance = {
  id: string
  nombre: string
  municipio: string
  total_locales: number
  con_permiso: number
  sin_permiso: number
  cobertura_pct: number
  locales: LocalCompliance[]
}

type ComplianceData = {
  cadena: {
    id: string
    nombre: string
    rut: string
    contacto_nombre: string
  }
  fecha_reporte: string
  generado_por: string
  resumen: {
    total_locales: number
    con_permiso_vigente: number
    sin_permiso: number
    cobertura_global_pct: number
    locales_en_riesgo: number
    observaciones_abiertas_total: number
  }
  centros: CentroCompliance[]
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let data: ComplianceData | null = null

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data: cadenaRow, error: cadenaError } = await supabase
      .from('cadenas')
      .select('id, nombre, rut, contacto_nombre')
      .eq('id', id)
      .single()

    if (cadenaError) throw cadenaError

    const { data: centrosRows, error: centrosError } = await supabase
      .from('centros_comerciales')
      .select('id, nombre, municipio, locales(id, numero, nombre_negocio, uso, area_m2, proyectos(id, estado, numero_expediente))')
      .eq('cadena_id', id)

    if (centrosError) throw centrosError

    type LocalRow = {
      id: string
      numero: string
      nombre_negocio: string | null
      uso: string | null
      area_m2: number | null
      proyectos: { id: string; estado: string; numero_expediente: string | null }[]
    }

    type CentroRow = {
      id: string
      nombre: string
      municipio: string
      locales: LocalRow[]
    }

    const centrosData = (centrosRows ?? []) as CentroRow[]

    const centrosCompliance: CentroCompliance[] = centrosData.map(cc => {
      const localesCompliance: LocalCompliance[] = cc.locales.map(l => {
        const proyecto = l.proyectos[0]
        const estado: EstadoPermiso = proyecto
          ? (proyecto.estado === 'aprobado' ? 'vigente' : proyecto.estado === 'en_revision' || proyecto.estado === 'ingresado' ? 'en_tramite' : 'vencido')
          : 'sin_permiso'

        return {
          id: l.id,
          numero: l.numero,
          nombre_negocio: l.nombre_negocio ?? '—',
          centro_nombre: cc.nombre,
          municipio: cc.municipio,
          uso: l.uso ?? 'otro',
          area_m2: l.area_m2 ?? 0,
          estado_permiso: estado,
          numero_permiso: proyecto?.numero_expediente ?? null,
          fecha_vencimiento: null,
          especialidades_obtenidas: 0,
          especialidades_total: 3,
          observaciones_abiertas: proyecto?.estado === 'con_observaciones' ? 1 : 0,
          dom_digital_url: null,
        }
      })

      const conPermiso = localesCompliance.filter(l => l.estado_permiso === 'vigente').length
      const sinPermiso = localesCompliance.filter(l => l.estado_permiso === 'sin_permiso').length
      const total = localesCompliance.length

      return {
        id: cc.id,
        nombre: cc.nombre,
        municipio: cc.municipio,
        total_locales: total,
        con_permiso: conPermiso,
        sin_permiso: sinPermiso,
        cobertura_pct: total > 0 ? Math.round((conPermiso / total) * 100) : 0,
        locales: localesCompliance,
      }
    })

    const totalLocales = centrosCompliance.reduce((s, cc) => s + cc.total_locales, 0)
    const conPermisoVigente = centrosCompliance.reduce((s, cc) => s + cc.con_permiso, 0)
    const sinPermisoCount = centrosCompliance.reduce((s, cc) => s + cc.sin_permiso, 0)
    const localesEnRiesgo = centrosCompliance.reduce((s, cc) =>
      s + cc.locales.filter(l => l.estado_permiso === 'vencido' || l.estado_permiso === 'sin_permiso').length, 0)
    const obsTotal = centrosCompliance.reduce((s, cc) =>
      s + cc.locales.reduce((ls, l) => ls + l.observaciones_abiertas, 0), 0)

    data = {
      cadena: {
        id: cadenaRow.id as string,
        nombre: cadenaRow.nombre as string,
        rut: (cadenaRow.rut as string | null) ?? '—',
        contacto_nombre: (cadenaRow.contacto_nombre as string | null) ?? '—',
      },
      fecha_reporte: new Date().toISOString(),
      generado_por: 'PermisoHub v2.0',
      resumen: {
        total_locales: totalLocales,
        con_permiso_vigente: conPermisoVigente,
        sin_permiso: sinPermisoCount,
        cobertura_global_pct: totalLocales > 0 ? Math.round((conPermisoVigente / totalLocales) * 100) : 0,
        locales_en_riesgo: localesEnRiesgo,
        observaciones_abiertas_total: obsTotal,
      },
      centros: centrosCompliance,
    }
  } catch {
    return Response.json({ error: 'Error al generar compliance' }, { status: 500 })
  }

  if (!data) return Response.json({ error: 'Cadena no encontrada' }, { status: 404 })

  return Response.json({ ok: true, data })
}
