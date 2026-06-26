import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { MOCK_PROYECTOS } from '@/lib/mock-data'
import { NuevoProyectoSchema } from '@/lib/schemas'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    let query = supabase
      .from('proyectos')
      .select('*, cliente:clientes(*)')
      .order('created_at', { ascending: false })

    if (clienteId) query = query.eq('cliente_id', clienteId)

    const { data, error } = await query

    if (error) throw error

    return Response.json({ data: data ?? [], source: 'db' })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const list = clienteId
        ? MOCK_PROYECTOS.filter((p) => p.cliente_id === clienteId)
        : MOCK_PROYECTOS
      return Response.json({ data: list, source: 'mock' })
    }
    return Response.json({ error: 'Error al obtener proyectos' }, { status: 500 })
  }
}

interface NuevoProyectoExtra {
  direccion: string
  numero_expediente?: string
  fecha_inicio: string
  fecha_estimada?: string
  notas?: string
}

export async function POST(request: Request) {
  const raw = await request.json()
  const parsed = NuevoProyectoSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  // Merge Zod-validated core fields with the extra fields present in the raw body
  const extra = raw as NuevoProyectoExtra
  const body = { ...parsed.data, ...extra }

  const required = ['direccion', 'fecha_inicio'] as const
  for (const field of required) {
    if (!body[field]) {
      return Response.json({ error: `Campo requerido: ${field}` }, { status: 400 })
    }
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

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
      return apiError('Error al crear proyecto', 500, error)
    }

    if (body.tipo === 'patente_comercial' && proyecto?.id && body.numero_expediente) {
      const proyectoId = proyecto.id
      const rol = body.numero_expediente
      after(async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
          const siiRes = await fetch(
            `${baseUrl}/api/sii/lookup?rol=${encodeURIComponent(rol)}`,
            { method: 'GET' }
          )
          if (!siiRes.ok) return
          const siiData = await siiRes.json() as {
            ok?: boolean
            data?: {
              superficie_terreno_m2: number | null
              superficie_construida_m2: number | null
              destino: string
              direccion_normalizada?: string
            }
          }
          if (!siiData.ok || !siiData.data) return
          const supabase = createServiceClient()
          await supabase
            .from('proyectos')
            .update({
              superficie_terreno_m2: siiData.data.superficie_terreno_m2 ?? null,
              superficie_construida_m2: siiData.data.superficie_construida_m2 ?? null,
              destino_sii: siiData.data.destino ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', proyectoId)
        } catch {
          // Fire-and-forget — silent failure intentional
        }
      })
    }

    return Response.json({ ok: true, id: proyecto.id })
  } catch (err) {
    // In dev without DB, return a mock success so the UI flow is testable
    if (process.env.NODE_ENV !== 'production') {
      const mockId = `p${Date.now()}`
      return Response.json({ ok: true, id: mockId, simulated: true })
    }
    return apiError('Error interno', 500, err)
  }
}
