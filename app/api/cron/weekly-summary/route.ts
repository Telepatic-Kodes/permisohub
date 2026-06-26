import { validateCronSecret } from '@/lib/scraper'
import { createServiceClient } from '@/lib/supabase/service'
import { sendResumenSemanal } from '@/lib/email'

export const dynamic = 'force-dynamic'

// Note: set ADMIN_EMAIL=estefania@epgestion.cl in the deployment environment
// (e.g. Vercel env vars / .env.local). Falls back to that address if unset.

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all active projects
  const { data: proyectos, error } = await supabase
    .from('proyectos')
    .select('*, clientes(*)')
    .not('estado', 'in', '("rechazado","borrador")')
    .order('fecha_estimada', { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Send to Estefanía (internal summary)
  const ESTEFANIA_EMAIL = process.env.ADMIN_EMAIL ?? 'estefania@epgestion.cl'

  const proyectosResumen = (proyectos ?? []).map((p) => ({
    nombre: p.nombre,
    municipio: p.municipio ?? '',
    estado: p.estado,
    etapa: p.etapa_actual ?? '',
    fechaEstimada: p.fecha_estimada,
    tieneAlerta: p.estado === 'con_observaciones',
  }))

  const result = await sendResumenSemanal({
    to: ESTEFANIA_EMAIL,
    clienteNombre: 'Estefanía Parada',
    proyectos: proyectosResumen,
  })

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    proyectosSent: proyectosResumen.length,
    emailResult: result,
  })
}
