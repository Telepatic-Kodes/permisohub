import { createClient } from '@/lib/supabase/server'
import {
  MOCK_PROYECTOS,
  MOCK_ETAPAS,
  MOCK_COMUNICACIONES,
  MOCK_DOCUMENTOS,
} from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()

    const [proyectoRes, etapasRes, comunicacionesRes, documentosRes] =
      await Promise.all([
        supabase
          .from('proyectos')
          .select('*, cliente:clientes(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('etapas')
          .select('*')
          .eq('proyecto_id', id)
          .order('orden'),
        supabase
          .from('comunicaciones')
          .select('*')
          .eq('proyecto_id', id)
          .order('fecha', { ascending: false }),
        supabase
          .from('documentos')
          .select('*')
          .eq('proyecto_id', id)
          .order('created_at', { ascending: false }),
      ])

    if (proyectoRes.error) throw proyectoRes.error

    return Response.json({
      proyecto: proyectoRes.data,
      etapas: etapasRes.data ?? [],
      comunicaciones: comunicacionesRes.data ?? [],
      documentos: documentosRes.data ?? [],
      source: 'db',
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const proyecto =
        MOCK_PROYECTOS.find((p) => p.id === id) ?? MOCK_PROYECTOS[0]
      return Response.json({
        proyecto,
        etapas: MOCK_ETAPAS.filter((e) => e.proyecto_id === id),
        comunicaciones: MOCK_COMUNICACIONES.filter(
          (c) => c.proyecto_id === id,
        ),
        documentos: MOCK_DOCUMENTOS.filter((d) => d.proyecto_id === id),
        source: 'mock',
      })
    }
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }
}

interface PatchProyectoBody {
  nombre?: string
  estado?: string
  municipio?: string
  tipo?: string
  direccion?: string
  numero_expediente?: string
  fecha_inicio?: string
  fecha_estimada?: string
  notas?: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json() as PatchProyectoBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const updates: Record<string, unknown> = {}
    const fields = ['nombre', 'estado', 'municipio', 'tipo', 'direccion', 'numero_expediente', 'fecha_inicio', 'fecha_estimada', 'notas'] as const
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f]
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ ok: true })
    }

    const { error } = await supabase
      .from('proyectos')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error && process.env.NODE_ENV === 'production') {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, simulated: true })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
