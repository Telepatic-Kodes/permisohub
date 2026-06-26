import { createClient } from '@/lib/supabase/server'
import { MOCK_PROYECTOS } from '@/lib/mock-data'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Proyecto } from '@/types'

export const dynamic = 'force-dynamic'

interface RenovarBody {
  nuevo_año: number
}

function nuevoId(): string {
  return 'p-renov-' + Math.random().toString(36).slice(2, 8)
}

function clonarRenovacion(original: Proyecto, nuevoAño: number): Proyecto {
  return {
    ...original,
    id: nuevoId(),
    año_ejercicio: nuevoAño,
    numero_patente: undefined,
    fecha_otorgamiento: undefined,
    fecha_vencimiento_permiso: `${nuevoAño}-12-31`,
    valor_derechos: undefined,
    fecha_pago_derechos: undefined,
    patente_anterior_id: original.id,
    estado: 'borrador',
    nombre: original.nombre.replace(/\d{4}/, String(nuevoAño)),
    created_at: new Date().toISOString().slice(0, 10),
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  let body: RenovarBody
  try {
    body = (await request.json()) as RenovarBody
  } catch {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  if (typeof body.nuevo_año !== 'number' || Number.isNaN(body.nuevo_año)) {
    return Response.json({ ok: false, error: 'Campo requerido: nuevo_año' }, { status: 400 })
  }

  if (process.env.NODE_ENV !== 'production') {
    const original = MOCK_PROYECTOS.find((p) => p.id === id)
    if (!original) {
      return Response.json({ ok: false, error: 'Patente no encontrada' }, { status: 404 })
    }
    const patente = clonarRenovacion(original, body.nuevo_año)
    return Response.json({ ok: true, patente })
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data, error: fetchError } = await supabase
      .from('proyectos')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !data) {
      return Response.json({ ok: false, error: 'Patente no encontrada' }, { status: 404 })
    }

    const clonado = clonarRenovacion(data as Proyecto, body.nuevo_año)

    const { error: insertError } = await supabase.from('proyectos').insert(clonado)

    if (insertError) {
      return Response.json({ ok: false, error: insertError.message }, { status: 500 })
    }

    return Response.json({ ok: true, patente: clonado })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const original = MOCK_PROYECTOS.find((p) => p.id === id)
      if (!original) {
        return Response.json({ ok: false, error: 'Patente no encontrada' }, { status: 404 })
      }
      const patente = clonarRenovacion(original, body.nuevo_año)
      return Response.json({ ok: true, patente })
    }
    return Response.json({ ok: false, error: 'Error interno' }, { status: 500 })
  }
}
