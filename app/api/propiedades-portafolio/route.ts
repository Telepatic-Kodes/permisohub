export const dynamic = 'force-dynamic'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { asegurarWorkspace, getWorkspaceActual } from '@/lib/workspace'
import {
  obtenerPropiedadesPortafolio,
  compararPortafolioConMercado,
  obtenerObligacionesPortafolio,
  destinoSiiCoincideConTipo,
  calcularCapRatePropiedad,
} from '@/lib/propiedades-portafolio-server'
import { obtenerSenalesExpansionPorComuna, type SenalExpansionComuna } from '@/lib/cadenas-sucursales-server'
import { obtenerTendenciasConstruccionPorComuna, type TendenciaConstruccionComuna } from '@/lib/ine-permisos-server'
import { calcularEstadoReajuste } from '@/lib/reajuste-renta'

const NuevaPropiedadSchema = z.object({
  direccion: z.string().min(1),
  comuna: z.string().min(1),
  tipoPropiedad: z.enum(['local_comercial', 'oficina', 'bodega', 'industrial']),
  superficieM2: z.number().positive().optional(),
  operacion: z.enum(['arriendo', 'venta']),
  precioActualUf: z.number().positive().optional(),
  rolSii: z.string().optional(),
  notas: z.string().optional(),
  fechaVencimientoContrato: z.string().optional(),
  tieneAscensor: z.boolean().optional(),
  tieneGas: z.boolean().optional(),
  reajusteAplica: z.boolean().optional(),
  reajustePeriodicidadMeses: z.number().int().positive().optional(),
  reajusteFechaUltimo: z.string().optional(),
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
    const [senalesExpansion, tendenciasConstruccion, comparaciones, obligaciones] = await Promise.all([
      obtenerSenalesExpansionPorComuna(comunas).catch(() => new Map<string, SenalExpansionComuna>()),
      obtenerTendenciasConstruccionPorComuna(comunas).catch(() => new Map<string, TendenciaConstruccionComuna>()),
      compararPortafolioConMercado(propiedades),
      obtenerObligacionesPortafolio(propiedades),
    ])

    const conComparacion = propiedades.map((p) => ({
      propiedad: p,
      comparacion: comparaciones.get(p.id)!,
      senalExpansion: senalesExpansion.get(p.comuna) ?? null,
      tendenciaConstruccion: tendenciasConstruccion.get(p.comuna) ?? null,
      obligaciones: obligaciones.get(p.id) ?? [],
      coincideTipoSii: p.siiDestino ? destinoSiiCoincideConTipo(p.siiDestino, p.tipoPropiedad) : null,
      capRate: calcularCapRatePropiedad(p),
      estadoReajuste: calcularEstadoReajuste({
        reajusteAplica: p.reajusteAplica,
        periodicidadMeses: p.reajustePeriodicidadMeses,
        fechaUltimo: p.reajusteFechaUltimo,
      }),
    }))

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
        fecha_vencimiento_contrato: body.fechaVencimientoContrato ?? null,
        tiene_ascensor: body.tieneAscensor ?? false,
        tiene_gas: body.tieneGas ?? false,
        reajuste_aplica: body.reajusteAplica ?? false,
        reajuste_periodicidad_meses: body.reajustePeriodicidadMeses ?? null,
        reajuste_fecha_ultimo: body.reajusteFechaUltimo ?? null,
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
