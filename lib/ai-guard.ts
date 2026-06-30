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
  if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    return { userId: DEMO_USER_ID, userPlan: 'pro' as PlanId }
  }

  if (process.env.DEMO_MODE === 'true') {
    return { userId: DEMO_USER_ID, userPlan: 'pro' as PlanId }
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
