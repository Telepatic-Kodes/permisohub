import { createClient } from '@/lib/supabase/server'
import type { EstadoExpediente } from '@/types'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface HistorialEntry {
  proyecto_id: string
  nombre: string
  estado: EstadoExpediente
  tipo?: string
  fecha_inicio?: string
  fecha_estimada?: string
  dias_tramite?: number
  created_at: string
}

interface HistorialResponse {
  local: {
    numero: string
    nombre_negocio?: string
    centro?: string
  }
  historial: HistorialEntry[]
}

function calcDiasTramite(fechaInicio: string, fechaEstimada: string): number {
  const start = new Date(fechaInicio).getTime()
  const end = new Date(fechaEstimada).getTime()
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
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

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Fetch local info
    const { data: localData, error: localError } = await supabase
      .from('locales')
      .select('numero, nombre_negocio, centro:centros_comerciales(nombre)')
      .eq('id', id)
      .single()

    if (localError) throw localError

    // Fetch proyectos for this local ordered by fecha_inicio asc
    const { data: proyectos, error: proyectosError } = await supabase
      .from('proyectos')
      .select('id, nombre, estado, tipo, fecha_inicio, fecha_estimada, created_at')
      .eq('local_id', id)
      .order('fecha_inicio', { ascending: true })

    if (proyectosError) throw proyectosError

    const historial: HistorialEntry[] = (proyectos ?? []).map(p => {
      const entry: HistorialEntry = {
        proyecto_id: p.id,
        nombre: p.nombre,
        estado: p.estado as EstadoExpediente,
        tipo: p.tipo ?? undefined,
        fecha_inicio: p.fecha_inicio ?? undefined,
        fecha_estimada: p.fecha_estimada ?? undefined,
        created_at: p.created_at,
      }

      if (p.estado === 'aprobado' && p.fecha_inicio && p.fecha_estimada) {
        entry.dias_tramite = calcDiasTramite(p.fecha_inicio, p.fecha_estimada)
      }

      return entry
    })

    // Supabase returns joined tables as arrays for 1-to-many or objects for 1-to-1
    const centroRaw = localData.centro as { nombre: string } | { nombre: string }[] | null
    const centroNombre = Array.isArray(centroRaw)
      ? centroRaw[0]?.nombre
      : centroRaw?.nombre

    const response: HistorialResponse = {
      local: {
        numero: localData.numero,
        nombre_negocio: localData.nombre_negocio ?? undefined,
        centro: centroNombre,
      },
      historial,
    }

    return Response.json(response)
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const mockHistorial: HistorialEntry[] = [
        {
          proyecto_id: 'proj-hist-1',
          nombre: 'Permiso de obras - Instalación local',
          estado: 'aprobado',
          fecha_inicio: '2024-03-01',
          fecha_estimada: '2024-05-15',
          dias_tramite: 75,
          created_at: '2024-03-01T00:00:00Z',
        },
        {
          proyecto_id: 'proj-hist-2',
          nombre: 'Renovación permiso municipal',
          estado: 'en_revision',
          fecha_inicio: '2025-06-10',
          fecha_estimada: '2025-09-10',
          created_at: '2025-06-10T00:00:00Z',
        },
        {
          proyecto_id: 'proj-hist-3',
          nombre: 'Actualización planos arquitectura',
          estado: 'ingresado',
          fecha_inicio: '2026-04-01',
          created_at: '2026-04-01T00:00:00Z',
        },
      ]

      const mockResponse: HistorialResponse = {
        local: {
          numero: 'L-101',
          nombre_negocio: 'Negocio',
          centro: 'Centro Comercial',
        },
        historial: mockHistorial,
      }

      return Response.json(mockResponse)
    }

    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
