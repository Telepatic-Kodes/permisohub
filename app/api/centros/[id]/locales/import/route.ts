import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ImportRow {
  numero: string
  nombre_negocio?: string
  uso?: string
  area_m2?: number
  tenant_nombre?: string
  tenant_email?: string
}

interface ImportBody {
  rows: ImportRow[]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as ImportBody

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return Response.json({ error: 'rows requerido y no puede estar vacío' }, { status: 400 })
  }

  const VALID_USOS = ['retail', 'food', 'servicio', 'entretenimiento', 'otro']

  const rows = body.rows.map(r => ({
    centro_id: id,
    numero: String(r.numero ?? '').trim(),
    nombre_negocio: r.nombre_negocio ? String(r.nombre_negocio).trim() || null : null,
    uso: VALID_USOS.includes(r.uso ?? '') ? r.uso : 'otro',
    area_m2: r.area_m2 ? Number(r.area_m2) || null : null,
    tenant_nombre: r.tenant_nombre ? String(r.tenant_nombre).trim() || null : null,
    tenant_email: r.tenant_email ? String(r.tenant_email).trim() || null : null,
  })).filter(r => r.numero.length > 0)

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('locales')
      .upsert(rows, { onConflict: 'centro_id,numero', ignoreDuplicates: false })
      .select()

    if (error) throw error

    return Response.json({ ok: true, created: data?.length ?? rows.length, skipped: 0, errors: [] })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, created: rows.length, skipped: 0, errors: [], simulated: true })
    }
    return Response.json({ error: 'Error al importar locales' }, { status: 500 })
  }
}
