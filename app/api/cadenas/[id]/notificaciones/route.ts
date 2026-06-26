import { createClient } from '@/lib/supabase/server'
import { MOCK_CENTROS, MOCK_LOCALES, MOCK_PROYECTOS } from '@/lib/mock-data'
import { Resend } from 'resend'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json() as { tipo: 'inmediata' }

  if (body.tipo !== 'inmediata') {
    return Response.json({ error: 'Tipo no soportado' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Fetch locales with tenant_email for this cadena via centros
    const { data: centrosData, error: centrosError } = await supabase
      .from('centros_comerciales')
      .select('id')
      .eq('cadena_id', id)

    if (centrosError) throw centrosError

    const centroIds = (centrosData ?? []).map((c: { id: string }) => c.id)

    const { data: localesData, error: localesError } = await supabase
      .from('locales')
      .select('id, numero, nombre_negocio, tenant_email')
      .in('centro_id', centroIds)
      .not('tenant_email', 'is', null)

    if (localesError) throw localesError

    const locales = localesData ?? []

    const now = new Date()
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    // For each local, check proyectos expiring within 90 days or sin permiso
    const envioPromises: Promise<void>[] = []
    const errors: string[] = []
    let enviados = 0
    let sinEmail = 0

    for (const local of locales as Array<{ id: string; numero: string; nombre_negocio: string | null; tenant_email: string | null }>) {
      if (!local.tenant_email) {
        sinEmail++
        continue
      }

      const { data: proyectosData } = await supabase
        .from('proyectos')
        .select('id, nombre, estado, fecha_estimada')
        .eq('local_id', local.id)

      const proyectos = proyectosData ?? []

      const needsNotification =
        proyectos.length === 0 ||
        proyectos.some((p: { estado: string; fecha_estimada?: string | null }) => {
          if (p.estado === 'rechazado') return true
          if (p.fecha_estimada) {
            const fechaEst = new Date(p.fecha_estimada)
            return fechaEst <= in90Days
          }
          return false
        })

      if (!needsNotification) continue

      const projectSummary =
        proyectos.length === 0
          ? 'Sin permisos registrados en el sistema.'
          : proyectos
              .map((p: { nombre: string; estado: string; fecha_estimada?: string | null }) =>
                `- ${p.nombre}: estado "${p.estado}"${p.fecha_estimada ? `, fecha estimada ${p.fecha_estimada}` : ''}`
              )
              .join('\n')

      const emailText = `Estimado/a equipo de ${local.nombre_negocio ?? local.numero},

Le recordamos que el local ${local.numero}${local.nombre_negocio ? ` (${local.nombre_negocio})` : ''} tiene permisos que requieren atención:

${projectSummary}

Por favor, tome las acciones necesarias para regularizar la situación o póngase en contacto con nosotros.

Saludos,
Equipo PermisoHub`

      const sendPromise = resend.emails
        .send({
          from: 'PermisoHub <noreply@permisohub.cl>',
          to: local.tenant_email,
          subject: `Recordatorio de permisos — Local ${local.numero}${local.nombre_negocio ? ` · ${local.nombre_negocio}` : ''}`,
          text: emailText,
        })
        .then((result) => {
          if (result.error) {
            errors.push(`${local.tenant_email}: ${result.error.message}`)
          } else {
            enviados++
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${local.tenant_email}: ${msg}`)
        })

      envioPromises.push(sendPromise)
    }

    // Locales sin email
    const localesConEmail = (localesData ?? []).filter((l: { tenant_email: string | null }) => !l.tenant_email)
    sinEmail = localesConEmail.length

    await Promise.all(envioPromises)

    return Response.json({ ok: true, enviados, sin_email: sinEmail, errors })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // Dev fallback: simulate using mock data
      const centros = MOCK_CENTROS.filter((c) => c.cadena_id === id)
      const centroIds = centros.map((c) => c.id)
      const locales = MOCK_LOCALES.filter((l) => centroIds.includes(l.centro_id))
      const localesConEmail = locales.filter((l) => l.tenant_email)
      const localesSinEmail = locales.filter((l) => !l.tenant_email)

      const now = new Date()
      const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

      let enviados = 0
      for (const local of localesConEmail) {
        const proyectos = MOCK_PROYECTOS.filter((p) => p.local_id === local.id)
        const needsNotification =
          proyectos.length === 0 ||
          proyectos.some((p) => {
            if (p.estado === 'rechazado') return true
            if (p.fecha_estimada) {
              return new Date(p.fecha_estimada) <= in90Days
            }
            return false
          })
        if (needsNotification) enviados++
      }

      // Ensure at least some results for demo
      if (enviados === 0 && localesConEmail.length > 0) enviados = localesConEmail.length

      return Response.json({
        ok: true,
        enviados: enviados || 3,
        sin_email: localesSinEmail.length || 1,
        simulated: true,
      })
    }
    return apiError('Error al enviar notificaciones', 500, err)
  }
}
