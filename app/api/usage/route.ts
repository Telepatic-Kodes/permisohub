import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUsageThisMonth, type UsageMetric } from '@/lib/usage'
import { getUserPlan } from '@/lib/subscription'
import { getLimits } from '@/lib/plan-limits'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const metric = searchParams.get('metric') as UsageMetric | null

  if (!metric || !['ai_chats', 'pdf_extractions'].includes(metric)) {
    return NextResponse.json({ error: 'metric inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`general:${user.id}`)
  if (rateLimit) return rateLimit

  const [plan, used] = await Promise.all([
    getUserPlan(user.id),
    getUsageThisMonth(user.id, metric),
  ])

  const limits = getLimits(plan)
  const limit = metric === 'ai_chats' ? limits.aiChatsPerMonth : limits.pdfExtractionsPerMonth

  return NextResponse.json({
    metric,
    plan,
    used,
    limit: limit === Infinity ? null : limit,
  })
}
