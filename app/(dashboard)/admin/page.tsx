import { redirect } from 'next/navigation'
import { BarChart2, TrendingUp, Users, FolderOpen, AlertCircle, CreditCard, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { PLAN_AMOUNTS, PLAN_NAMES, type PlanId, type BillingInterval } from '@/lib/stripe'
import { PageHeader } from '@/components/dashboard/page-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface AdminStats {
  usuarios: { total: number; nuevos7d: number; onboarding_pendiente: number }
  proyectos: { total: number; por_estado: Record<string, number> }
  planes: Record<string, number>
  mrr_clp: number
  suscripciones_activas: number
}

async function fetchStats(): Promise<AdminStats> {
  const service = createServiceClient()
  const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const diaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, nuevos7dRes, onboardingRes, estadosRes, totalProjRes, planesRes, subsRes] =
    await Promise.all([
      service.from('profiles').select('*', { count: 'exact', head: true }),
      service.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', semanaAtras),
      service.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', false).lt('created_at', diaAtras),
      service.from('proyectos').select('estado'),
      service.from('proyectos').select('*', { count: 'exact', head: true }),
      service.from('profiles').select('plan'),
      service.from('subscriptions').select('plan, billing_interval').eq('status', 'active'),
    ])

  const por_estado: Record<string, number> = {}
  for (const p of estadosRes.data ?? []) {
    const e = p.estado as string
    por_estado[e] = (por_estado[e] ?? 0) + 1
  }

  const planes: Record<string, number> = { free: 0, starter: 0, pro: 0, estudio: 0, enterprise: 0 }
  for (const p of planesRes.data ?? []) {
    const plan = p.plan as string
    planes[plan] = (planes[plan] ?? 0) + 1
  }

  let mrr_clp = 0
  for (const s of subsRes.data ?? []) {
    const plan = s.plan as PlanId
    const interval = s.billing_interval as BillingInterval
    const amounts = PLAN_AMOUNTS[plan]
    if (amounts) mrr_clp += interval === 'annual' ? Math.round(amounts.annual / 12) : amounts.monthly
  }

  return {
    usuarios: {
      total: totalRes.count ?? 0,
      nuevos7d: nuevos7dRes.count ?? 0,
      onboarding_pendiente: onboardingRes.count ?? 0,
    },
    proyectos: { total: totalProjRes.count ?? 0, por_estado },
    planes,
    mrr_clp,
    suscripciones_activas: subsRes.data?.length ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)
}

function estadoBadgeVariant(estado: string): 'default' | 'secondary' | 'muted' | 'outline' {
  if (estado === 'aprobado' || estado === 'vigente') return 'default'
  if (estado === 'observado' || estado === 'por_vencer') return 'secondary'
  if (estado === 'rechazado' || estado === 'vencido' || estado === 'archivado') return 'muted'
  return 'outline'
}

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'pro', 'estudio', 'enterprise']

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user || user.email !== process.env.ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const stats = await fetchStats()

  const totalUsuarios = stats.usuarios.total || 1
  const totalProyectos = stats.proyectos.total || 1
  const planMasUsado = PLAN_ORDER.reduce((a, b) => (stats.planes[a] ?? 0) >= (stats.planes[b] ?? 0) ? a : b)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <PageHeader
        emoji="📊"
        title="Panel de Control"
        subtitle="Métricas internas — solo visible para administradores"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Analytics' }]}
      />

      <div className="flex-1 p-8 space-y-8">

        {/* KPI row 1 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="size-5" />}
            label="Usuarios totales"
            value={stats.usuarios.total.toLocaleString('es-CL')}
          />
          <KpiCard
            icon={<TrendingUp className="size-5" />}
            label="Nuevos esta semana"
            value={stats.usuarios.nuevos7d.toLocaleString('es-CL')}
          />
          <KpiCard
            icon={<AlertCircle className="size-5" />}
            label="Onboarding pendiente"
            value={stats.usuarios.onboarding_pendiente.toLocaleString('es-CL')}
            muted
          />
          <KpiCard
            icon={<FolderOpen className="size-5" />}
            label="Proyectos totales"
            value={stats.proyectos.total.toLocaleString('es-CL')}
          />
        </div>

        {/* KPI row 2 */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <KpiCard
            icon={<CreditCard className="size-5" />}
            label="MRR estimado"
            value={fmtCLP(stats.mrr_clp)}
            highlight
          />
          <KpiCard
            icon={<Zap className="size-5" />}
            label="Suscripciones activas"
            value={stats.suscripciones_activas.toLocaleString('es-CL')}
          />
          <KpiCard
            icon={<BarChart2 className="size-5" />}
            label="Plan más usado"
            value={PLAN_NAMES[planMasUsado] ?? planMasUsado}
          />
        </div>

        {/* Tables */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Distribución de planes */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-primary mb-4">Distribución de planes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 font-medium text-right">Usuarios</th>
                    <th className="pb-2 font-medium text-right">MRR aprox.</th>
                    <th className="pb-2 font-medium text-right pr-1">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {PLAN_ORDER.map((planId) => {
                    const count = stats.planes[planId] ?? 0
                    const pct = Math.round((count / totalUsuarios) * 100)
                    const mrrPlan = count * PLAN_AMOUNTS[planId].monthly
                    return (
                      <tr key={planId} className="group">
                        <td className="py-2.5">
                          <span className="font-medium text-foreground">{PLAN_NAMES[planId]}</span>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{count}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{fmtCLP(mrrPlan)}</td>
                        <td className="py-2.5 pr-1">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Proyectos por estado */}
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-primary mb-4">Proyectos por estado</h2>
            {Object.keys(stats.proyectos.por_estado).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin proyectos registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="pb-2 font-medium">Estado</th>
                      <th className="pb-2 font-medium text-right">Cantidad</th>
                      <th className="pb-2 font-medium text-right pr-1">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {Object.entries(stats.proyectos.por_estado)
                      .sort(([, a], [, b]) => b - a)
                      .map(([estado, count]) => {
                        const pct = Math.round((count / totalProyectos) * 100)
                        return (
                          <tr key={estado}>
                            <td className="py-2.5">
                              <Badge variant={estadoBadgeVariant(estado)} className="capitalize text-xs">
                                {estado.replace(/_/g, ' ')}
                              </Badge>
                            </td>
                            <td className="py-2.5 text-right tabular-nums">{count}</td>
                            <td className="py-2.5 pr-1">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary/60"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <p className="text-[11px] text-muted-foreground/60 text-center">
          Datos en tiempo real desde Supabase · {new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago', dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value,
  muted,
  highlight,
}: {
  icon: React.ReactNode
  label: string
  value: string
  muted?: boolean
  highlight?: boolean
}) {
  return (
    <Card className={`p-5 ${highlight ? 'border-primary/30 bg-primary/5' : ''}`}>
      <div className={`mb-3 flex size-8 items-center justify-center rounded-lg ${highlight ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
        {icon}
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${muted ? 'text-muted-foreground' : highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </p>
    </Card>
  )
}
