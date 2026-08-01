import { createClient } from '@/lib/supabase/server'
import { obtenerResumenInstrumentosIptPorComunaId } from '@/lib/instrumentos-ipt-server'

export const dynamic = 'force-dynamic'

// Consumido por /municipios (client component) para mostrar un badge de
// cobertura IPT por comuna sin resolver 345 comunas una por una en el
// cliente. Requiere sesión (mismo criterio que el resto de rutas internas
// de datos ya sincronizados) pero no rate-limit especial — es una lectura
// agregada sobre datos ya persistidos, no dispara ningún fetch externo.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const resumen = await obtenerResumenInstrumentosIptPorComunaId()
  return Response.json({ ok: true, resumen })
}
