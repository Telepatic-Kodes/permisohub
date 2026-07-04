import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { getLimits, isWithinLimit } from '@/lib/plan-limits'
import { getUsageThisMonth } from '@/lib/usage'
import type { PlanId } from '@/lib/stripe'

export interface AIGuardResult {
  userId: string
  userPlan: PlanId
}

const DEMO_USER_ID = 'demo-bypass-user'

export async function aiAuthGuard(): Promise<AIGuardResult | Response> {
  const bypass =
    process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production'
  const demo =
    (process.env.DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') &&
    process.env.NODE_ENV !== 'production'

  // En bypass/demo saltamos límites de plan, pero si existe una sesión real
  // (p. ej. el auto-login dev vía /auth/dev-login) usamos SU userId — así los
  // chequeos de propiedad de proyecto funcionan. Solo caemos al usuario demo
  // si no hay ninguna sesión.
  if (bypass || demo) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return { userId: user?.id ?? DEMO_USER_ID, userPlan: 'pro' as PlanId }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const userPlan: PlanId = await getUserPlan(user.id)
  const limits = getLimits(userPlan)
  const usage = await getUsageThisMonth(user.id, 'ai_chats')

  if (!isWithinLimit(usage, limits.aiChatsPerMonth)) {
    return Response.json(
      { error: 'LIMIT_EXCEEDED', metric: 'ai_chats', plan: userPlan },
      { status: 402 }
    )
  }

  return { userId: user.id, userPlan }
}
