export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'
import { consultarSII } from '@/lib/propiedades-portafolio-server'
import type { TipoPropiedadComercial } from '@/lib/scrapers/mercado-locales-common'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data: propiedad, error: fetchError } = await supabase
      .from('propiedades_portafolio')
      .select('rol_sii, comuna, tipo_propiedad')
      .eq('id', id)
      .single()

    if (fetchError || !propiedad) return Response.json({ error: 'Propiedad no encontrada' }, { status: 404 })
    if (!propiedad.rol_sii) return Response.json({ error: 'Esta propiedad no tiene Rol SII declarado' }, { status: 400 })

    const resultado = await consultarSII(propiedad.rol_sii, propiedad.comuna, propiedad.tipo_propiedad as TipoPropiedadComercial, request.headers.get('cookie'))
    if (!resultado) {
      return Response.json({ error: 'No se pudo consultar el SII para este rol — intenta de nuevo más tarde' }, { status: 502 })
    }

    const consultadoEl = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('propiedades_portafolio')
      .update({ sii_destino: resultado.destino, sii_avaluo_fiscal_uf: resultado.avaluoFiscalUf, sii_consultado_el: consultadoEl })
      .eq('id', id)

    if (updateError) return apiError('Error al guardar el resultado del SII', 500, updateError)

    return Response.json({ ok: true, ...resultado, consultadoEl })
  } catch (err) {
    return apiError('Error interno', 500, err)
  }
}
