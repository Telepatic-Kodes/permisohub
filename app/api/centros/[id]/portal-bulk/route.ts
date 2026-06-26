import { createClient } from '@/lib/supabase/server'
import { MOCK_LOCALES } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

interface BulkBody {
  localIds?: string[]
}

interface LocalRow {
  id: string
  numero: string
  nombre_negocio: string | null
  tenant_email: string | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as BulkBody
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Fetch locales for this centro (filtered by localIds if provided)
    let query = supabase
      .from('locales')
      .select('id, numero, nombre_negocio, tenant_email')
      .eq('centro_id', id)
      .order('numero')

    if (body.localIds && body.localIds.length > 0) {
      query = query.in('id', body.localIds)
    }

    const { data: locales, error: localesError } = await query
    if (localesError) throw localesError

    const rows = (locales ?? []) as LocalRow[]

    // Generate tokens for each local
    const invites = await Promise.all(
      rows.map(async (local) => {
        const token = crypto.randomUUID()
        await supabase.from('workspace_invites').insert({
          token,
          workspace_id: user.id,
          email: local.tenant_email ?? null,
          rol: 'viewer',
          metadata: { local_id: local.id },
        })
        return {
          local_id: local.id,
          numero: local.numero,
          negocio: local.nombre_negocio ?? '—',
          email: local.tenant_email ?? null,
          token,
          url: `${baseUrl}/portal/${token}`,
        }
      })
    )

    return Response.json({ ok: true, invites, total: invites.length })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      // Dev mock: generate fake tokens for mock locales
      const mockLocales = MOCK_LOCALES.filter(l => l.centro_id === id)
      const invites = mockLocales.map(local => {
        const token = crypto.randomUUID()
        return {
          local_id: local.id,
          numero: local.numero,
          negocio: local.nombre_negocio ?? '—',
          email: local.tenant_email ?? null,
          token,
          url: `${baseUrl}/portal/${token}`,
        }
      })
      return Response.json({ ok: true, invites, total: invites.length, simulated: true })
    }
    return Response.json({ error: 'Error al generar portales' }, { status: 500 })
  }
}
