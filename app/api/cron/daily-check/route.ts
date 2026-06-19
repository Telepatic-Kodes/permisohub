import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { validateCronSecret } from '@/lib/scraper'
import {
  sendDeadlineAlert,
  sendObservacionAlert,
} from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]
  const in7Days = new Date(today)
  in7Days.setDate(in7Days.getDate() + 7)
  const in7DaysISO = in7Days.toISOString().split('T')[0]
  const ago5Days = new Date(today)
  ago5Days.setDate(ago5Days.getDate() - 5)
  const ago30Days = new Date(today)
  ago30Days.setDate(ago30Days.getDate() - 30)

  const results = {
    deadlineAlerts: 0,
    observacionAlerts: 0,
    staleAlerts: 0,
    errors: [] as string[],
  }

  // 1. Deadline alerts: fecha_estimada within next 7 days
  const { data: deadlineProjects, error: deadlineError } = await supabase
    .from('proyectos')
    .select('*, clientes(*)')
    .gte('fecha_estimada', todayISO)
    .lte('fecha_estimada', in7DaysISO)
    .not('estado', 'in', '("aprobado","rechazado")')

  if (deadlineError) {
    results.errors.push(`deadline query: ${deadlineError.message}`)
  } else if (deadlineProjects) {
    for (const p of deadlineProjects) {
      const diasRestantes = Math.ceil(
        (new Date(p.fecha_estimada).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      const clientEmail = p.clientes?.email
      if (!clientEmail) continue
      const result = await sendDeadlineAlert({
        to: clientEmail,
        clienteNombre: p.clientes?.nombre ?? 'Cliente',
        proyectoNombre: p.nombre,
        municipio: p.municipio ?? '',
        diasRestantes,
        fechaEstimada: p.fecha_estimada,
      })
      if (result.success) results.deadlineAlerts++
      else results.errors.push(`deadline email for ${p.id}: ${result.error}`)
    }
  }

  // 2. Observacion inactivity: con_observaciones with no recent action
  const { data: obsProjects, error: obsError } = await supabase
    .from('proyectos')
    .select('*, clientes(*), comunicaciones(*)')
    .eq('estado', 'con_observaciones')
    .lt('updated_at', ago5Days.toISOString())

  if (obsError) {
    results.errors.push(`observaciones query: ${obsError.message}`)
  } else if (obsProjects) {
    for (const p of obsProjects) {
      const clientEmail = p.clientes?.email
      if (!clientEmail) continue
      const result = await sendObservacionAlert({
        to: clientEmail,
        clienteNombre: p.clientes?.nombre ?? 'Cliente',
        proyectoNombre: p.nombre,
        municipio: p.municipio ?? '',
        expediente: p.numero_expediente ?? 'Sin número',
        descripcionObservacion: 'El expediente tiene observaciones pendientes de respuesta hace más de 5 días.',
        plazoRespuesta: 'A la brevedad',
      })
      if (result.success) results.observacionAlerts++
      else results.errors.push(`obs email for ${p.id}: ${result.error}`)
    }
  }

  // 3. Stale projects: same estado for >30 days (check updated_at)
  // Log stale count for now — can add notification later
  const { count: staleCount } = await supabase
    .from('proyectos')
    .select('*', { count: 'exact', head: true })
    .not('estado', 'in', '("aprobado","rechazado","borrador")')
    .lt('updated_at', ago30Days.toISOString())

  results.staleAlerts = staleCount ?? 0

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
