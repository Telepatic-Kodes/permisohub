import { validateCronSecret } from '@/lib/scraper'
import { createServiceClient } from '@/lib/supabase/service'
import {
  sendDeadlineAlert,
  sendObservacionAlert,
} from '@/lib/email'
import { enviarWhatsApp, isWhatsAppAvailable } from '@/lib/whatsapp'
import { reportError } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

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
    domStatusChanges: 0,
    whatsappSent: 0,
    errors: [] as string[],
  }

  // Todo el cuerpo del cron corre dentro de este try/catch (C8): antes, si
  // cualquier query lanzaba, todo lo que seguía (alertas, scraper DOM,
  // WhatsApp) dejaba de correr ese día de forma invisible — el cron
  // reportaba éxito en Vercel porque nada capturaba el throw. Ahora un fallo
  // se reporta y el run queda visiblemente fallido (500).
  try {
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

    // 4. DOM scraper loop + WhatsApp auto-trigger on state change
    const { data: activeProjects } = await supabase
      .from('proyectos')
      .select('*, clientes(*)')
      .not('numero_expediente', 'is', null)
      .not('estado', 'in', '("aprobado","rechazado","borrador")')

    if (activeProjects) {
      for (const p of activeProjects) {
        if (!p.numero_expediente || !p.municipio) continue
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
          // expedienteNumero, no "expediente" — el nombre real que exige
          // /api/scraper/dom-en-linea (ver los otros 2 callers,
          // check-status/[proyectoId] y permisos/page.tsx). Con el nombre
          // equivocado la ruta siempre devolvía 400 "expedienteNumero is
          // required", `!scraperRes.ok` caía en el `continue` de abajo, y
          // todo el loop de tracking DOM + WhatsApp corría en silencio sin
          // hacer nada — nunca se contaba como error en `results.errors`.
          const scraperRes = await fetch(`${baseUrl}/api/scraper/dom-en-linea`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
            },
            body: JSON.stringify({ expedienteNumero: p.numero_expediente, municipio: p.municipio }),
          })
          if (!scraperRes.ok) {
            results.errors.push(`scraper ${p.numero_expediente}: HTTP ${scraperRes.status}`)
            continue
          }
          const scraperData = await scraperRes.json() as {
            ok: boolean
            estado?: string
            descripcion?: string
          }
          if (!scraperData.ok || !scraperData.estado) continue
          const estadoNuevo = scraperData.estado
          if (estadoNuevo === p.estado) continue
          // .select('id') para saber si el update REALMENTE afectó una fila
          // — sin esto, dos invocaciones del cron superpuestas (retry de
          // Vercel, disparo manual) leen el mismo `p.estado` viejo, ambas
          // pasan el chequeo de arriba, y ambas mandan el WhatsApp aunque
          // solo una haya escrito de verdad.
          const { data: actualizados } = await supabase
            .from('proyectos')
            .update({
              estado: estadoNuevo,
              etapa_actual: scraperData.descripcion ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', p.id)
            .neq('estado', estadoNuevo)
            .select('id')

          if (!actualizados || actualizados.length === 0) continue
          results.domStatusChanges++
          if (isWhatsAppAvailable()) {
            const telefono = p.clientes?.telefono
            if (!telefono) continue
            const tipoWA = estadoNuevo === 'aprobado' ? 'aprobado'
              : estadoNuevo === 'con_observaciones' ? 'con_observaciones'
              : estadoNuevo === 'en_revision' ? 'en_revision'
              : null
            if (!tipoWA) continue
            const waResult = await enviarWhatsApp(telefono, tipoWA, {
              proyectoNombre: p.nombre,
              municipio: p.municipio,
              etapa: scraperData.descripcion,
              arquitecta: 'Estefanía Parada',
            })
            if (waResult.ok) results.whatsappSent++
            else results.errors.push(`WA for ${p.id}: ${waResult.error}`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'scraper error'
          results.errors.push(`scraper ${p.numero_expediente}: ${msg}`)
        }
      }
    }

    // 5. Alertas de vencimiento de permisos otorgados (fecha_vencimiento_permiso en próximos 30 días)
    const in30Days = new Date(today)
    in30Days.setDate(in30Days.getDate() + 30)
    const in30DaysISO = in30Days.toISOString().split('T')[0]

    const { data: permisosVenciendo } = await supabase
      .from('proyectos')
      .select('*, clientes(*)')
      .eq('estado', 'aprobado')
      .not('fecha_vencimiento_permiso', 'is', null)
      .gte('fecha_vencimiento_permiso', todayISO)
      .lte('fecha_vencimiento_permiso', in30DaysISO)

    if (permisosVenciendo) {
      for (const p of permisosVenciendo) {
        const clientEmail = (p.clientes as Record<string, unknown>)?.email as string | undefined
        if (!clientEmail) continue
        const diasRestantes = Math.ceil(
          (new Date(p.fecha_vencimiento_permiso as string).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )
        const result = await sendDeadlineAlert({
          to: clientEmail,
          clienteNombre: ((p.clientes as Record<string, unknown>)?.nombre as string | undefined) ?? 'Cliente',
          proyectoNombre: `Permiso ${(p.numero_permiso as string | null) ?? (p.nombre as string)}`,
          municipio: (p.municipio as string | null) ?? '',
          diasRestantes,
          fechaEstimada: p.fecha_vencimiento_permiso as string,
        })
        if (result.success) results.deadlineAlerts++
        else results.errors.push(`permiso vencimiento email for ${p.id as string}: ${result.error}`)
      }
    }

    // 6. Alertas de renovación de patentes (solo en noviembre y diciembre)
    const mesActual = today.getMonth() // 0-indexed; noviembre=10, diciembre=11
    if (mesActual >= 10) {
      const añoActual = today.getFullYear()
      const { data: patentesPendientes } = await supabase
        .from('proyectos')
        .select('*, clientes(*)')
        .eq('tipo', 'patente_comercial')
        .eq('año_ejercicio', añoActual)
        .not('estado', 'eq', 'borrador')

      if (patentesPendientes && patentesPendientes.length > 0) {
        // Verificar cuáles no tienen renovación (no hay hijo con año+1)
        const { data: renovaciones } = await supabase
          .from('proyectos')
          .select('patente_anterior_id')
          .eq('año_ejercicio', añoActual + 1)
          .not('patente_anterior_id', 'is', null)

        const renovadas = new Set((renovaciones ?? []).map((r) => r.patente_anterior_id as string))
        const sinRenovar = patentesPendientes.filter((p) => !renovadas.has(p.id as string))

        const adminEmail = process.env.ADMIN_EMAIL ?? 'estefania@epgestion.cl'
        if (sinRenovar.length > 0) {
          await sendDeadlineAlert({
            to: adminEmail,
            clienteNombre: 'Equipo EP Gestión',
            proyectoNombre: `${sinRenovar.length} patente(s) sin renovar para ${añoActual + 1}`,
            municipio: 'Múltiples municipios',
            diasRestantes: 31 - today.getDate(),
            fechaEstimada: `${añoActual}-12-31`,
          })
        }
      }
    }

    // 7. Weekly plan_reguladores sync from datos.gob.cl (Mondays only — data changes infrequently)
    if (today.getDay() === 1) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'
        const syncRes = await fetch(`${baseUrl}/api/scraper/plan-reguladores`, {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
        })
        if (!syncRes.ok) {
          results.errors.push(`plan-reguladores sync: HTTP ${syncRes.status}`)
        }
      } catch (err) {
        results.errors.push(
          `plan-reguladores sync: ${err instanceof Error ? err.message : 'failed'}`
        )
      }
    }

    // Fallos acumulados por proyecto (queries que devolvieron `error` sin
    // lanzar, emails/WhatsApp individuales fallidos, etc.) ya no quedan solo
    // en `results.errors` de la respuesta JSON que nadie lee — se reportan
    // una vez, agregados, para que dejen de ser invisibles.
    if (results.errors.length > 0) {
      reportError(new Error(`daily-check terminó con ${results.errors.length} error(es) parcial(es)`), {
        scope: 'cron.daily-check.partial',
        extra: { errors: results.errors },
      })
    }

    return Response.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (err) {
    reportError(err, { scope: 'cron.daily-check', extra: { partialResults: results } })
    return Response.json(
      {
        ok: false,
        error: 'daily-check falló antes de completar',
        timestamp: new Date().toISOString(),
        ...results,
      },
      { status: 500 }
    )
  }
}
