import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit as unknown as NextResponse

    const { data, error } = await supabase
      .from('observaciones_local')
      .select('*')
      .eq('local_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ observaciones: (data ?? []) as Observacion[] })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
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
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit as unknown as NextResponse

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
    return NextResponse.json({ error: 'Error al crear observación' }, { status: 500 })
  }
}
