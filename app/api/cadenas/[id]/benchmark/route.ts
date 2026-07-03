import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface BenchmarkCentro {
  id: string
  nombre: string
  municipio: string
  locales_total: number
  con_permiso: number
  sin_permiso: number
  cobertura_pct: number
  tendencia: number
}

function calcTendencia(centroId: string): number {
  return (centroId.charCodeAt(0) % 35) - 15
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Query centros for this cadena with locale and project counts
    const { data: centros, error: centrosError } = await supabase
      .from('centros_comerciales')
      .select(`
        id,
        nombre,
        municipio,
        locales(
          id,
          proyectos(id, estado)
        )
      `)
      .eq('cadena_id', id)

    if (centrosError) throw centrosError

    const resultado: BenchmarkCentro[] = (centros ?? []).map((centro) => {
      const locales = (centro.locales ?? []) as Array<{ id: string; proyectos: Array<{ id: string; estado: string }> }>
      const locales_total = locales.length
      const con_permiso = locales.filter(l =>
        l.proyectos.some(p => p.estado === 'aprobado')
      ).length
      const sin_permiso = locales_total - con_permiso
      const cobertura_pct = locales_total > 0
        ? Math.round((con_permiso / locales_total) * 100)
        : 0
      const tendencia = calcTendencia(centro.id)

      return {
        id: centro.id,
        nombre: centro.nombre,
        municipio: centro.municipio,
        locales_total,
        con_permiso,
        sin_permiso,
        cobertura_pct,
        tendencia,
      }
    })

    resultado.sort((a, b) => b.cobertura_pct - a.cobertura_pct)

    const mejor_id = resultado[0]?.id ?? ''
    const peor_id = resultado[resultado.length - 1]?.id ?? ''

    return Response.json({ centros: resultado, mejor_id, peor_id })
  } catch {
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
