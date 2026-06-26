import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_AMOUNTS, type PlanId, type BillingInterval } from '@/lib/stripe'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || user.email !== process.env.ADMIN_EMAIL) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const service = createServiceClient()
    const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const diaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      totalRes,
      nuevos7dRes,
      onboardingRes,
      estadosRes,
      totalProjRes,
      planesRes,
      subsRes,
    ] = await Promise.all([
      service.from('profiles').select('*', { count: 'exact', head: true }),
      service.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', semanaAtras),
      service.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', false).lt('created_at', diaAtras),
      service.from('proyectos').select('estado'),
      service.from('proyectos').select('*', { count: 'exact', head: true }),
      service.from('profiles').select('plan'),
      service.from('subscriptions').select('plan, billing_interval').eq('status', 'active'),
    ])

    const por_estado: Record<string, number> = {}
    for (const p of (estadosRes.data ?? [])) {
      const e = p.estado as string
      por_estado[e] = (por_estado[e] ?? 0) + 1
    }

    const planes: Record<string, number> = { free: 0, starter: 0, pro: 0, estudio: 0, enterprise: 0 }
    for (const p of (planesRes.data ?? [])) {
      const plan = p.plan as string
      planes[plan] = (planes[plan] ?? 0) + 1
    }

    let mrr_clp = 0
    for (const s of (subsRes.data ?? [])) {
      const plan = s.plan as PlanId
      const interval = s.billing_interval as BillingInterval
      const amounts = PLAN_AMOUNTS[plan]
      if (amounts) {
        mrr_clp += interval === 'annual' ? Math.round(amounts.annual / 12) : amounts.monthly
      }
    }

    return Response.json({
      usuarios: {
        total: totalRes.count ?? 0,
        nuevos7d: nuevos7dRes.count ?? 0,
        onboarding_pendiente: onboardingRes.count ?? 0,
      },
      proyectos: {
        total: totalProjRes.count ?? 0,
        por_estado,
      },
      planes,
      mrr_clp,
      suscripciones_activas: subsRes.data?.length ?? 0,
    })
  } catch (err) {
    console.error('[admin/stats]', err)
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
