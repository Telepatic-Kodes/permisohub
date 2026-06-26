import { createClient } from '@/lib/supabase/server'
import { MOCK_CENTROS, MOCK_LOCALES, MOCK_PROYECTOS } from '@/lib/mock-data'

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

const COBERTURA_DEMO: Record<string, number> = {
  cc1: 68,
  cc2: 25,
  cc3: 82,
  cc4: 45,
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
      if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

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
    if (process.env.NODE_ENV !== 'production') {
      // Dev fallback using mock data
      const centrosFiltrados = MOCK_CENTROS.filter(cc => cc.cadena_id === id)

      const resultado: BenchmarkCentro[] = centrosFiltrados.map((centro) => {
        const localesDelCentro = MOCK_LOCALES.filter(l => l.centro_id === centro.id)
        const locales_total = localesDelCentro.length

        const cobertura_pct = COBERTURA_DEMO[centro.id] ?? 50

        const con_permiso = Math.round((cobertura_pct / 100) * locales_total)
        const sin_permiso = locales_total - con_permiso

        // Also check MOCK_PROYECTOS for consistency
        const localesConPermiso = localesDelCentro.filter(l =>
          MOCK_PROYECTOS.some(p => p.local_id === l.id && p.estado === 'aprobado')
        ).length

        const finalConPermiso = localesDelCentro.length > 0 ? localesConPermiso || con_permiso : 0
        const finalSinPermiso = locales_total - finalConPermiso
        const finalCobertura = cobertura_pct

        const tendencia = calcTendencia(centro.id)

        return {
          id: centro.id,
          nombre: centro.nombre,
          municipio: centro.municipio,
          locales_total,
          con_permiso: finalConPermiso,
          sin_permiso: finalSinPermiso,
          cobertura_pct: finalCobertura,
          tendencia,
        }
      })

      resultado.sort((a, b) => b.cobertura_pct - a.cobertura_pct)

      const mejor_id = resultado[0]?.id ?? ''
      const peor_id = resultado[resultado.length - 1]?.id ?? ''

      return Response.json({ centros: resultado, mejor_id, peor_id, source: 'mock' })
    }

    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
