import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/subscription'
import { getLimits, isWithinLimit } from '@/lib/plan-limits'
import { getUsageThisMonth } from '@/lib/usage'
import type { PlanId } from '@/lib/stripe'

export interface AIGuardResult {
  userId: string
  userPlan: PlanId
}

export async function aiAuthGuard(): Promise<AIGuardResult | Response> {
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
