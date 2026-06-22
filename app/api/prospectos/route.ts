import { createClient } from '@/lib/supabase/server'
import { MOCK_PROSPECTOS } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('prospectos')
      .select('*, actividades:actividades_crm(*)')
      .order('created_at', { ascending: false })

    if (error) throw error

    return Response.json({ data: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ data: MOCK_PROSPECTOS, source: 'mock' })
    }
    return Response.json({ error: 'Error al obtener prospectos' }, { status: 500 })
  }
}

interface NuevoProspectoBody {
  empresa: string
  contacto_nombre: string
  cargo?: string
  email?: string
  telefono?: string
  linkedin_url?: string
  fuente?: string
  etapa?: string
  valor_estimado?: number
  municipios_interes?: string[]
  notas?: string
  proximo_contacto?: string
}

export async function POST(request: Request) {
  const body = await request.json() as NuevoProspectoBody

  if (!body.empresa?.trim() || !body.contacto_nombre?.trim()) {
    return Response.json(
      { error: 'empresa y contacto_nombre son requeridos' },
      { status: 400 },
    )
  }

  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: prospecto, error } = await supabase
      .from('prospectos')
      .insert({
        user_id: user.id,
        empresa: body.empresa.trim(),
        contacto_nombre: body.contacto_nombre.trim(),
        cargo: body.cargo ?? null,
        email: body.email ?? null,
        telefono: body.telefono ?? null,
        linkedin_url: body.linkedin_url ?? null,
        fuente: body.fuente ?? 'web',
        etapa: body.etapa ?? 'nuevo_contacto',
        valor_estimado: body.valor_estimado ?? null,
        municipios_interes: body.municipios_interes ?? [],
        notas: body.notas ?? null,
        proximo_contacto: body.proximo_contacto ?? null,
      })
      .select('*')
      .single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        return Response.json({
          ok: true,
          id: `pr${Date.now()}`,
          simulated: true,
          warning: error.message,
        })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: prospecto.id, prospecto })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return Response.json({ ok: true, id: `pr${Date.now()}`, simulated: true })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
