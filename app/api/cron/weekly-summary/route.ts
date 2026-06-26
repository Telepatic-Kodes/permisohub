import { validateCronSecret } from '@/lib/scraper'
import { createServiceClient } from '@/lib/supabase/service'
import { sendResumenSemanal } from '@/lib/email'
import { aiComplete, isAIAvailable } from '@/lib/ai'

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

  let tipSemanal = ''
  if (isAIAvailable()) {
    try {
      const resumenTexto = proyectosResumen
        .map(p =>
          `${p.nombre} (${p.municipio}): ${p.estado}${p.tieneAlerta ? ' — ALERTA' : ''}`
        )
        .join('\n')
      tipSemanal = await aiComplete(
        [
          {
            role: 'user' as const,
            content: `Eres un experto en tramitación DOM chilena. Analiza estos proyectos activos y entrega UN consejo práctico breve (2-3 oraciones) para la semana:\n\n${resumenTexto}\n\nEl consejo debe ser específico y accionable para la arquitecta.`,
          },
        ],
        { max_tokens: 200 }
      )
    } catch {
      tipSemanal = ''
    }
  }

  const result = await sendResumenSemanal({
    to: ESTEFANIA_EMAIL,
    clienteNombre: 'Estefanía Parada',
    proyectos: proyectosResumen,
    tipSemanal,
  })

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    proyectosSent: proyectosResumen.length,
    emailResult: result,
  })
}
