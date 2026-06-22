import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface NuevoProyectoBody {
  nombre: string
  cliente_id: string
  municipio: string
  tipo: string
  direccion: string
  numero_expediente?: string
  fecha_inicio: string
  fecha_estimada?: string
  notas?: string
}

export async function POST(request: Request) {
  const body = await request.json() as NuevoProyectoBody

  const required = ['nombre', 'cliente_id', 'municipio', 'tipo', 'direccion', 'fecha_inicio'] as const
  for (const field of required) {
    if (!body[field]) {
      return Response.json({ error: `Campo requerido: ${field}` }, { status: 400 })
    }
  }

  try {
    const supabase = await createClient()

    const { data: proyecto, error } = await supabase
      .from('proyectos')
      .insert({
        nombre: body.nombre,
        cliente_id: body.cliente_id,
        municipio: body.municipio,
        tipo: body.tipo,
        direccion: body.direccion,
        numero_expediente: body.numero_expediente ?? null,
        fecha_inicio: body.fecha_inicio,
        fecha_estimada: body.fecha_estimada ?? null,
        notas: body.notas ?? null,
        estado: 'borrador',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      // In dev without DB migrations, fall back to a mock ID so the form flow works
      if (process.env.NODE_ENV !== 'production') {
        const mockId = `p${Date.now()}`
        return Response.json({ ok: true, id: mockId, simulated: true, warning: error.message })
      }
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, id: proyecto.id })
  } catch (err) {
    // In dev without DB, return a mock success so the UI flow is testable
    if (process.env.NODE_ENV !== 'production') {
      const mockId = `p${Date.now()}`
      return Response.json({ ok: true, id: mockId, simulated: true })
    }
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
