import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type TipoEspecialidad = 'electrica' | 'gas' | 'agua_potable' | 'alcantarillado' | 'estructura'
type EstadoEspecialidad = 'pendiente' | 'en_tramite' | 'obtenido' | 'obtenido' | 'no_aplica'
type Especialidad = {
  id: string
  local_id: string
  tipo: TipoEspecialidad
  estado: EstadoEspecialidad
  numero_certificado?: string
  fecha_vencimiento?: string
  empresa_certificadora?: string
}

const TIPOS: TipoEspecialidad[] = ['electrica', 'gas', 'agua_potable', 'alcantarillado', 'estructura']

const ESTADOS: EstadoEspecialidad[] = ['pendiente', 'en_tramite', 'obtenido', 'obtenido', 'no_aplica']

function charCodeSum(str: string): number {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return sum
}

function buildMockEspecialidades(localId: string): Especialidad[] {
  return TIPOS.map((tipo, index) => {
    const estado = ESTADOS[charCodeSum(localId + tipo) % 5]
    return {
      id: `mock-${localId}-${tipo}`,
      local_id: localId,
      tipo,
      estado,
    }
  })
}

function buildDefaultEspecialidades(localId: string): Especialidad[] {
  return TIPOS.map((tipo, index) => ({
    id: `default-${localId}-${tipo}-${index}`,
    local_id: localId,
    tipo,
    estado: 'pendiente' as EstadoEspecialidad,
  }))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  let rows: Especialidad[] | null = null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('especialidades_local')
      .select('*')
      .eq('local_id', id)

    if (error) throw error

    rows = data as Especialidad[]
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ok: true, especialidades: buildMockEspecialidades(id) })
    }
    return NextResponse.json({ ok: false, error: 'Error fetching especialidades' }, { status: 500 })
  }

  const especialidades: Especialidad[] =
    rows && rows.length > 0 ? rows : buildDefaultEspecialidades(id)

  return NextResponse.json({ ok: true, especialidades })
}

type PutBody = {
  tipo: TipoEspecialidad
  estado: EstadoEspecialidad
  numero_certificado?: string
  fecha_vencimiento?: string
  empresa_certificadora?: string
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const body = (await req.json()) as PutBody

  try {
    const supabase = await createClient()
    const { error } = await supabase.from('especialidades_local').upsert(
      {
        local_id: id,
        tipo: body.tipo,
        estado: body.estado,
        numero_certificado: body.numero_certificado,
        fecha_vencimiento: body.fecha_vencimiento,
        empresa_certificadora: body.empresa_certificadora,
      },
      { onConflict: 'local_id,tipo' }
    )

    if (error) throw error
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'Error upserting especialidad' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
