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
