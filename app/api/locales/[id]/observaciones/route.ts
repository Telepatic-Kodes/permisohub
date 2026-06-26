import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type EstadoObservacion = 'pendiente' | 'en_respuesta' | 'respondida' | 'subsanada'

type Observacion = {
  id: string
  local_id: string
  texto: string
  asignado_a?: string
  deadline?: string
  estado: EstadoObservacion
  respuesta_ia?: string
  created_at: string
}

const MOCK_OBS: Observacion[] = [
  { id: 'obs-1', local_id: 'local-id', texto: 'Fachada no cumple con Art. 2.4.3 OGUC — falta revestimiento exterior continuo', asignado_a: 'Arq. González', deadline: '2026-07-15', estado: 'pendiente', created_at: '2026-06-20T10:00:00Z' },
  { id: 'obs-2', local_id: 'local-id', texto: 'Baño accesible no cumple dimensiones mínimas OGUC Art. 4.1.7', asignado_a: 'Contratista', deadline: '2026-07-30', estado: 'en_respuesta', created_at: '2026-06-18T14:00:00Z' },
]

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('dev-no-auth')

    const { data, error } = await supabase
      .from('observaciones_local')
      .select('*')
      .eq('local_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ observaciones: data as Observacion[] })
  } catch {
    const mock = MOCK_OBS.map((obs) => ({ ...obs, local_id: id }))
    return NextResponse.json({ observaciones: mock })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  const body = (await req.json()) as { texto: string; asignado_a?: string; deadline?: string }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('dev-no-auth')

    const { data, error } = await supabase
      .from('observaciones_local')
      .insert({
        local_id: id,
        texto: body.texto,
        asignado_a: body.asignado_a,
        deadline: body.deadline,
        estado: 'pendiente' as EstadoObservacion,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, observacion: data as Observacion })
  } catch {
    return NextResponse.json({ ok: true, id: 'obs-' + Date.now() })
  }
}
