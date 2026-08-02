export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { asegurarWorkspace, getWorkspaceActual } from '@/lib/workspace'
import { obtenerPropiedadesPortafolio, compararConMercado } from '@/lib/propiedades-portafolio-server'
import { obtenerSenalesExpansionPorComuna } from '@/lib/cadenas-sucursales-server'
import { obtenerTendenciasConstruccionPorComuna } from '@/lib/ine-permisos-server'

const NuevaPropiedadSchema = z.object({
  direccion: z.string().min(1),
  comuna: z.string().min(1),
  tipoPropiedad: z.enum(['local_comercial', 'oficina', 'bodega', 'industrial']),
  superficieM2: z.number().positive().optional(),
  operacion: z.enum(['arriendo', 'venta']),
  precioActualUf: z.number().positive().optional(),
  rolSii: z.string().optional(),
  notas: z.string().optional(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const ws = await getWorkspaceActual(supabase, user.id)
    if (!ws) return Response.json({ data: [] })

    const propiedades = await obtenerPropiedadesPortafolio(ws.id)
    const comunas = Array.from(new Set(propiedades.map((p) => p.comuna)))
    const [senalesExpansion, tendenciasConstruccion] = await Promise.all([
      obtenerSenalesExpansionPorComuna(comunas).catch(() => new Map()),
      obtenerTendenciasConstruccionPorComuna(comunas).catch(() => new Map()),
    ])

    const conComparacion = await Promise.all(
      propiedades.map(async (p) => ({
        propiedad: p,
        comparacion: await compararConMercado(p),
        senalExpansion: senalesExpansion.get(p.comuna) ?? null,
        tendenciaConstruccion: tendenciasConstruccion.get(p.comuna) ?? null,
      })),
    )

    return Response.json({ data: conComparacion })
  } catch (err) {
    return apiError('Error al obtener el portafolio', 500, err)
  }
}

export async function POST(request: Request) {
  const raw = await request.json().catch(() => ({}))
  const parsed = NuevaPropiedadSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const ws = await asegurarWorkspace(supabase, user.id)

    const { data: propiedad, error } = await supabase
      .from('propiedades_portafolio')
      .insert({
        user_id: user.id,
        workspace_id: ws.id,
        direccion: body.direccion,
        comuna: body.comuna,
        tipo_propiedad: body.tipoPropiedad,
        superficie_m2: body.superficieM2 ?? null,
        operacion: body.operacion,
        precio_actual_uf: body.precioActualUf ?? null,
        rol_sii: body.rolSii ?? null,
        notas: body.notas ?? null,
      })
      .select('id')
      .single()

    if (error) {
      return apiError('Error al agregar la propiedad', 500, error)
    }

    return Response.json({ ok: true, id: propiedad.id })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
